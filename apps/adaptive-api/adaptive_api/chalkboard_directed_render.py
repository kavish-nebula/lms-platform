"""Persistent, word-cued Chalkboard compositions with release quality gates."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'chalkboard_runtime'))
sys.path.insert(0, str(ROOT / 'adaptive_api'))
from chalkboard_alignment import align_manifest


def atomic(file, data):
    temporary = file.with_suffix('.tmp')
    temporary.write_text(json.dumps(data), encoding='utf-8')
    os.replace(temporary, file)


def render(manifest):
    import av
    from manim import Scene, Text, Group, FadeIn, FadeOut, Indicate, Rotate, tempconfig, UP, DOWN, RIGHT
    from chalkboard_base import ChalkboardSceneBase
    from chalkboard_visuals import VisualLibrary
    directory = manifest.parent
    data = json.loads(manifest.read_text(encoding='utf-8'))
    status = directory / 'status.json'
    started = time.monotonic()
    atomic(status, {'status': 'rendering', 'stage': 'Aligning narration words locally'})
    chapters, captions, alignment = align_manifest(data, directory)
    duration = data['playback']['durationSeconds']
    if not chapters or not 0 < duration <= 420.05 or alignment['repeatedCompositions']:
        raise ValueError('Directed storyboard has missing/repeated compositions or exceeds duration')
    atomic(directory / 'aligned.json', {'chapters': chapters, 'captions': captions, 'durationSeconds': duration})
    library = VisualLibrary(data.get('illustration'))
    first_times = [chapter['cues'][0]['seconds'] for chapter in chapters]
    quality = {'version': data['plan']['version'], 'compositions': len(chapters),
               'uniqueCompositions': len({chapter['visualKey'] for chapter in chapters}),
               'fullCompositionReplays': 0, 'motionSeconds': .95,
               'minimumCueGap': min((b['seconds']-a['seconds'] for c in chapters for a,b in zip(c['cues'],c['cues'][1:])), default=duration),
               'alignmentMethod': alignment['method'], 'minimumSourceCoverage': alignment['minimumSourceCoverage'],
               'semanticReview': data['plan'].get('review')}

    class DirectedBoard(ChalkboardSceneBase, Scene):
        _REPORT_DIR = str(directory)

        def check_labels(self, chapter):
            texts = []; seen = set()
            for root in self.mobjects:
                for item in root.get_family():
                    if isinstance(item, Text) and id(item) not in seen:
                        seen.add(id(item)); texts.append(item)
            for i, a in enumerate(texts):
                for b in texts[i+1:]:
                    overlap_x = min(a.get_right()[0], b.get_right()[0]) - max(a.get_left()[0], b.get_left()[0])
                    overlap_y = min(a.get_top()[1], b.get_top()[1]) - max(a.get_bottom()[1], b.get_bottom()[1])
                    if overlap_x > .06 and overlap_y > .06:
                        raise ValueError('Overlapping visual labels in ' + chapter['sceneId'] + ': ' + a.text + ' / ' + b.text)

        def construct(self):
            self.camera.background_color = library.t.bg
            self._cues = {i: [cue['seconds'] - first_times[i] for cue in chapter['cues']] for i, chapter in enumerate(chapters)}
            # Earlier context remains visible until the new idea is actually
            # spoken. Arbitrary TTS clip boundaries never reset the canvas.
            if first_times[0] > 0:
                self.wait(first_times[0])
            self._sync_target = first_times[0]
            for i, chapter in enumerate(chapters):
                next_start = first_times[i + 1] if i + 1 < len(chapters) else duration
                self.begin_segment(i, next_start - first_times[i])
                self.cue(1)
                if self.mobjects:
                    self.play(*[FadeOut(item) for item in list(self.mobjects)], run_time=.25)
                self.clear()
                atomic(status, {'status': 'rendering', 'stage': 'Drawing directed chapters', 'section': i+1, 'sections': len(chapters)})
                if data.get('hybrid') and chapter['kind'] in data.get('remotionKinds', []):
                    # Remotion owns this section. Keep exact timing in the Manim
                    # track without spending time drawing an unused duplicate.
                    continue
                title = library.text(chapter['title'], UP * 3.35, 32, 'focus_primary', 11.5)
                context = 'Fictional learning illustration · inspect the narrated evidence'
                if chapter['kind'] in ('conveyor', 'variables', 'cooling', 'pattern-chart', 'system-layers', 'control-room'):
                    context = 'Source-linked illustration · diagrams are not measured operational data'
                footer = library.text(context, DOWN * 3.6, 17, 'context_muted', 12)
                self.add(title, footer)
                narration = data['scenes'][i]['narration'] + ' ' + data['scenes'][i].get('bridge', '')
                layers = library.layers(chapter, narration)
                visible = set()
                for number, cue in enumerate(chapter['cues'], 1):
                    if number > 1:
                        self.cue(number)
                    target = cue['target']
                    extra = [t for t in cue.get('withTargets', []) if t not in visible and t != target]
                    if extra:
                        self.add(*[layers[t] for t in extra]); visible.update(extra)
                    if target not in visible:
                        self.play(FadeIn(layers[target], shift=UP * .08), run_time=.95)
                        visible.add(target)
                        # One source-matched operation, never a looping replay.
                        if chapter['kind'] == 'workbench' and target == 'secondary':
                            self.play(layers[target][-1].animate.move_to(RIGHT*3.5+UP*.3), run_time=1.1)
                        if chapter['kind'] in ('cooling', 'comparison') and target == ('detail' if chapter['kind']=='cooling' else 'secondary'):
                            # The fan layer is shown only on its narrated cue.
                            fan = layers[target][0] if chapter['kind']=='cooling' else layers[target][-1]
                            self.play(Rotate(fan, angle=1.57), run_time=.95)
                    else:
                        # Focus an existing object; never replay its reveal.
                        self.play(Indicate(layers[target], scale_factor=1.025), run_time=.95)
                self.check_labels(chapter)
                # begin_segment/end_layout_check hold the completed picture
                # still until the next aligned idea. No decorative loop.
            self.end_layout_check()

    with tempconfig({'pixel_width': 1280, 'pixel_height': 720, 'frame_rate': 24,
                     'media_dir': str(directory / 'media-directed'), 'output_file': str(directory / 'visual.mp4'),
                     'disable_caching': True, 'verbosity': 'ERROR', 'progress_bar': 'none'}):
        scene = DirectedBoard()
        scene.render()
        rendered = scene.renderer.file_writer.movie_file_path
    report = json.loads((directory / 'layout_report.json').read_text())
    blockers = [v for v in report['violations'] if v['type'] in ('off_screen', 'sync_drift', 'timing_overrun', 'cue_late', 'label_on_curve')]
    if blockers:
        raise ValueError('Directed layout/sync check failed: ' + json.dumps(blockers)[:800])
    if data.get('hybrid'):
        import shutil
        shutil.copyfile(rendered, directory / 'manim.mp4')
        atomic(directory / 'playback.json', {**data['playback'], 'captions': captions})
        atomic(directory / 'visual-quality.json', {**quality, 'layoutPassed': True, 'textLayoutPassed': True})
        return
    temporary = directory / 'final.tmp.mp4'
    subprocess.run([data['ffmpeg'], '-v', 'error', '-i', rendered, '-i', data['audio'],
                    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
                    '-t', str(duration), '-movflags', '+faststart', '-y', str(temporary)], check=True, timeout=120)
    with av.open(str(temporary)) as container:
        measured = container.duration / av.time_base
        if abs(measured - duration) > .2 or not any(s.type == 'audio' for s in container.streams):
            raise ValueError('Audio/video duration or stream mismatch')
    os.replace(temporary, directory / 'final.mp4')
    atomic(directory / 'playback.json', {**data['playback'], 'captions': captions})
    atomic(directory / 'visual-quality.json', {**quality, 'layoutPassed': True, 'textLayoutPassed': True, 'vendorLayoutPassed': report['passed'], 'geometryWarnings': report['violations']})
    atomic(status, {'status': 'ready', 'durationSeconds': duration,
                    'renderSeconds': round(time.monotonic() - started, 2),
                    'visualChapters': len(chapters), 'visualCues': alignment['cueCount'],
                    'renderer': data['plan']['version'], 'timing': alignment['method']})


if __name__ == '__main__':
    manifest = Path(sys.argv[1]).resolve()
    try:
        render(manifest)
    except Exception as error:
        atomic(manifest.parent / 'status.json', {'status': 'failed', 'message': str(error)[:600]})
        raise
