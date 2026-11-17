"""Local-only word timing and source-text matching for directed visuals.

Recognition supplies timing, never replacement teaching. Low coverage blocks a
render; proportional word-count timing is deliberately not a fallback.
"""
import difflib
import hashlib
import json
import re
from pathlib import Path


def tokens(text):
    return re.findall(r'[a-z0-9]+', text.lower())


def align_source(source, recognized):
    expected = tokens(source)
    words = [piece for w in recognized for piece in [(token, w['start'], w['end']) for token in tokens(w['word'])]]
    matcher = difflib.SequenceMatcher(None, expected, [w[0] for w in words], autojunk=False)
    mapping = {}
    for block in matcher.get_matching_blocks():
        for offset in range(block.size):
            mapping[block.a + offset] = words[block.b + offset][1:]
    coverage = len(mapping) / max(1, len(expected))
    if coverage < .82:
        raise ValueError(f'Audio/source alignment coverage {coverage:.1%}; review narration before rendering')
    return expected, mapping, coverage


def phrase_time(phrase, expected, mapping, after=-1):
    parts = tokens(phrase)
    for i in range(max(0, after + 1), len(expected) - len(parts) + 1):
        if expected[i:i + len(parts)] == parts:
            positions = [mapping[n] for n in range(i, i + len(parts)) if n in mapping]
            if len(positions) < len(parts) * .7:
                raise ValueError('Cue phrase lacks reliable audio word timing: ' + phrase)
            return positions[0][0], i
    raise ValueError('Cue phrase not found in source narration: ' + phrase)


def align_manifest(data, directory):
    from faster_whisper import WhisperModel
    audio = Path(data['audio'])
    cache_root = Path(data['alignmentRoot'])
    cache_root.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(audio.read_bytes()).hexdigest()
    cached = cache_root / (key + '-base-en-v1.json')
    if cached.exists():
        recognized = json.loads(cached.read_text(encoding='utf-8'))
    else:
        model = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=4,
                             download_root=data['modelRoot'], local_files_only=True)
        # The LMS combined track is normalized mono PCM; decode in memory to
        # avoid incompatible PyAV demuxer keyword changes between dependencies.
        import wave
        import numpy as np
        from scipy.signal import resample_poly
        with wave.open(str(audio), 'rb') as wav:
            if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                raise ValueError('Normalized mono narration required')
            samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32) / 32768
            if wav.getframerate() != 16000:
                samples = resample_poly(samples, 16000, wav.getframerate()).astype(np.float32)
        segments, _ = model.transcribe(samples, language='en', beam_size=5,
                                       word_timestamps=True, condition_on_previous_text=False,
                                       vad_filter=False)
        recognized = [{'word': w.word, 'start': float(w.start), 'end': float(w.end)}
                      for segment in segments for w in (segment.words or [])]
        temporary = cached.with_suffix('.tmp')
        temporary.write_text(json.dumps(recognized), encoding='utf-8')
        temporary.replace(cached)
    aligned = []
    captions = []
    coverages = []
    adjustments = []
    for i, chapter in enumerate(data['plan']['chapters']):
        scene = data['scenes'][i]
        section = data['playback']['segments'][i]
        start, end = section['startSeconds'], section['endSeconds']
        relevant = [w for w in recognized if start - .15 <= w['start'] < end]
        narration = (scene['narration'] + ' ' + scene.get('bridge', '')).strip()
        expected, mapping, coverage = align_source(narration, relevant)
        coverages.append(coverage)
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z“\"\'])', narration)
        sentence_ranges = []; offset = 0
        for sentence in sentences:
            count = len(tokens(sentence)); sentence_ranges.append((offset, offset+count, sentence)); offset += count
        cues = []
        last = -1
        for cue in chapter['cues']:
            when, last = phrase_time(cue['phrase'], expected, mapping, last)
            cues.append({**cue, 'seconds': max(start, when), 'sourceWord': last})
        # Too many closely spaced cues caused the original readability issue.
        # Block instead of speeding up motion or guessing replacement timing.
        cursor = 1
        while cursor < len(cues):
            a, b = cues[cursor-1], cues[cursor]
            if b['seconds'] - a['seconds'] < 4.0:
                # A sentence's lead-in introduces the same teaching idea. It
                # can be a better cue than a late word in that sentence; this
                # remains audio-word aligned, never a guessed time offset.
                low, high, sentence = next(r for r in sentence_ranges if r[0] <= a['sourceWord'] < r[1])
                first = next((n for n in range(low, high) if n in mapping), None)
                earlier = mapping[first][0] if first is not None else a['seconds']
                minimum = cues[cursor-2]['seconds'] + 4.0 if cursor > 1 else start
                if earlier >= minimum and b['seconds'] - earlier >= 4.0:
                    old = a['phrase']; a['seconds'] = earlier; a['sourceWord'] = first
                    a['phrase'] = ' '.join(sentence.split()[:5])
                    adjustments.append({'sceneId': chapter['sceneId'], 'from': old, 'to': a['phrase'], 'reason': 'Use the spoken sentence lead-in to leave reading time.'})
                elif b['target'] == 'result' and scene.get('bridge') and ' '.join(tokens(b['phrase'])) in ' '.join(tokens(scene['bridge'])):
                    adjustments.append({'sceneId': chapter['sceneId'], 'from': b['phrase'], 'reason': 'Omit a redundant analogy badge; retain the full narration and captions.'})
                    cues.pop(cursor); continue
                elif low <= b['sourceWord'] < high:
                    # Ideas introduced in the same spoken sentence belong in
                    # one reveal, not two hurried animations. Wait until both
                    # are named; never invent an earlier audio timestamp.
                    b['withTargets'] = list(dict.fromkeys(a.get('withTargets', []) + [a['target']] + b.get('withTargets', [])))
                    adjustments.append({'sceneId': chapter['sceneId'], 'from': a['phrase'], 'to': b['phrase'], 'reason': 'Co-introduce same-sentence layers at the later spoken cue.'})
                    cues.pop(cursor-1); cursor = max(1, cursor-1); continue
                else:
                    raise ValueError('Visual cues are too close to read: ' + a['phrase'] + ' / ' + b['phrase'])
            cursor += 1
        if cues[-1]['seconds'] > end - 2.0:
            raise ValueError('Final visual needs at least two seconds to settle: ' + chapter['sceneId'])
        aligned.append({**chapter, 'start': start, 'end': end, 'cues': cues})
        cursor = 0
        for sentence in sentences:
            count = len(tokens(sentence))
            available = [mapping[n] for n in range(cursor, cursor + count) if n in mapping]
            if available:
                captions.append({'start': max(start, available[0][0]), 'end': min(end, available[-1][1]), 'caption': sentence})
            cursor += count
    for i, caption in enumerate(captions):
        caption['end'] = captions[i + 1]['start'] if i + 1 < len(captions) else data['playback']['durationSeconds']
    report = {'method': 'local faster-whisper base.en word alignment', 'minimumSourceCoverage': min(coverages),
              'chapters': len(aligned), 'cueCount': sum(len(c['cues']) for c in aligned),
              'repeatedCompositions': len(aligned) - len({c['visualKey'] for c in aligned}), 'cueAdjustments': adjustments, 'captions': captions}
    (directory / 'alignment-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return aligned, captions, report
