"""Local-only audio verification using the already cached Whisper model."""
import json
import os
import re
import subprocess
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

os.environ['HF_HUB_OFFLINE'] = '1'
root = Path(__file__).resolve().parents[3]
web = root / 'apps' / 'web'
audit = json.loads((root / 'outputs/course-media-brand-audit.json').read_text(encoding='utf-8'))
ffmpeg = subprocess.check_output(['node', '-p', "require('ffmpeg-static')"], cwd=web, text=True).strip()
model = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=4,
                     download_root=str(web / '.data/chalkboard-models'), local_files_only=True)
results = []
for video in audit['originalMedia']:
    if not video.get('uploadedVideo'):
        continue
    asset = video['uploadedVideo']['assetId']
    source = web / '.data/concept-videos' / video['courseId'] / asset / 'video'
    pcm = subprocess.check_output([ffmpeg, '-v', 'error', '-i', str(source), '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'])
    segments, _ = model.transcribe(np.frombuffer(pcm, dtype=np.float32), language='en', beam_size=1, vad_filter=True)
    transcript = [{'start': s.start, 'end': s.end, 'text': s.text} for s in segments]
    matches = [s for s in transcript if re.search(r'nebula|nebul|know[\s-]*lab', s['text'], re.I)]
    results.append({'assetId': asset, 'title': video['title'], 'matches': matches, 'transcript': transcript})
    (root / 'outputs/original-video-audio-audit.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps({'assetId': asset, 'segments': len(transcript), 'companyReferences': len(matches)}), flush=True)
if any(item['matches'] for item in results):
    raise SystemExit(1)
