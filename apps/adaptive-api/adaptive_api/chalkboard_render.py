"""Render approved LMS narration with the pinned nicglazkov/Chalkboard runtime.

Only data is accepted. No generated Python, remote URLs or shell commands.
Run in a separate process so a video render never blocks the adaptive worker.
"""
import json
import os
import sys
import time
from pathlib import Path

RUNTIME = Path(__file__).resolve().parents[1] / 'chalkboard_runtime'
sys.path.insert(0, str(RUNTIME))


def atomic_json(file, value):
    temporary = file.with_suffix('.tmp')
    temporary.write_text(json.dumps(value), encoding='utf-8')
    os.replace(temporary, file)


def render(manifest):
    import subprocess
    import av
    from manim import (Scene, Text, VGroup, Circle, Line, Arrow, Rectangle,
                       Polygon, Create, FadeIn, FadeOut, Transform, Dot,
                       Rotate, config, tempconfig, UP, DOWN, LEFT, RIGHT)
    from chalkboard_base import ChalkboardSceneBase
    from chalkboard_components import ChalkBox
    from chalkboard_tokens import T

    directory = manifest.parent.resolve()
    data = json.loads(manifest.read_text(encoding='utf-8'))
    status_file = directory / 'status.json'
    plan = data['plan']
    if len(plan['beats']) > 160 or not 0 < plan['duration'] <= 420.05:
        raise ValueError('Unsupported lesson length')
    allowed = {'rule', 'patterns', 'language', 'retrieval', 'verify', 'deployment'}
    if any(b['kind'] not in allowed or not 0 <= b['start'] < b['end'] <= plan['duration'] + .01
           or len(b['labels']) > 4 or any(len(s) > 45 for s in b['labels']) for b in plan['beats']):
        raise ValueError('Invalid visual plan')
    # The adapter supplies local files only; the renderer has no HTTP client.
    audio = Path(data['audio']).resolve()
    if audio.suffix != '.wav' or not audio.is_file():
        raise ValueError('Local narration required')
    t = T(theme='chalkboard')
    started = time.monotonic()

    class PersonalizedBoard(ChalkboardSceneBase, Scene):
        _REPORT_DIR = str(directory)

        def text(self, label, size=26, role='body'):
            value = Text(label, font='Arial', font_size=size, color=t.role(role))
            if value.width > 11.5:
                value.scale_to_fit_width(11.5)
            return value

        def card(self, label, at, role='body'):
            box = ChalkBox(label, role=role, size='caption', width=2.7, height=1.0)
            if box.width > 3.1:
                box.scale_to_fit_width(3.1)
            return box.move_to(at)

        def document(self, at):
            outline = Rectangle(width=.65, height=.85, color=t.role('focus_secondary'))
            marks = VGroup(*[Line(LEFT * .2 + UP * y, RIGHT * .2 + UP * y, color=t.role('stroke')) for y in (.2, 0, -.2)])
            return VGroup(outline, marks).move_to(at)

        def construct(self):
            self.camera.background_color = t.bg
            self._cues = {i: [0] for i in range(len(plan['beats']))}
            for index, beat in enumerate(plan['beats']):
                length = beat['end'] - beat['start']
                self.begin_segment(index, length)
                self.clear()
                self.cue(1)
                atomic_json(status_file, {'status': 'rendering', 'section': index + 1,
                                         'sections': len(plan['beats'])})
                title = self.text(data['title'][:85], 30, 'focus_primary').move_to(UP * 3.35)
                beat_domain = beat.get('domain', plan['domain'])
                context_label = ('Fictional ' + beat_domain + ' learning illustration') if beat_domain == plan['domain'] else ('Source illustration: ' + beat_domain)
                domain = self.text(context_label, 18, 'context_muted').move_to(DOWN * 3.3)
                self.add(title, domain)
                labels = beat['labels']
                kind = beat['kind']
                rotor = None
                # One clear visual mechanism, not a paragraph or bullet slide.
                if kind in ('rule', 'language', 'retrieval', 'deployment'):
                    left = self.card(labels[0], LEFT * 4)
                    middle = self.card(labels[1], UP * .25, 'focus_primary')
                    right = self.card(labels[2], RIGHT * 4)
                    a = Arrow(left.get_right(), middle.get_left(), buff=.16, color=t.role('stroke'))
                    b = Arrow(middle.get_right(), right.get_left(), buff=.16, color=t.role('stroke'))
                    objects = [left, middle, right, a, b]
                    if kind == 'rule':
                        # Draw the conditional branch and visibly route one form.
                        reject = self.text('Needs review', 22, 'accent_warm').move_to(DOWN * 1.8)
                        branch = Arrow(middle.get_bottom(), reject.get_top(), buff=.18, color=t.role('accent_warm'))
                        objects += [branch, reject]
                        document = self.document(LEFT * 4 + UP * 1.5)
                        objects += [document]
                        if labels[2] == 'Cooling fan':
                            center = RIGHT * 4 + UP * 1.5
                            rotor = VGroup(*[Line(center, center + .7 * direction, color=t.role('focus_secondary')) for direction in (UP, LEFT, DOWN, RIGHT)])
                            objects += [Circle(radius=.75, color=t.role('stroke')).move_to(center), rotor]
                        else:
                            queue = VGroup(*[self.document(RIGHT * (3.5 + j * .45) + UP * 1.5) for j in range(3)])
                            objects += [queue]
                    elif kind == 'language':
                        tokens = VGroup(*[Rectangle(width=.7, height=.45, color=t.role('focus_primary')) for _ in range(4)]).arrange(RIGHT, buff=.15).move_to(DOWN * 1.8)
                        objects += [tokens]
                        nodes = [Dot(LEFT * .55 + UP * y, radius=.07, color=t.role('focus_secondary')) for y in (1.1, 1.65, 2.2)] + [Dot(RIGHT * .55 + UP * y, radius=.07, color=t.role('focus_primary')) for y in (1.35, 1.95)]
                        edges = VGroup(*[Line(a.get_center(), b.get_center(), color=t.role('stroke_muted')) for a in nodes[:3] for b in nodes[3:]])
                        objects += [edges, VGroup(*nodes)]
                    elif kind == 'retrieval':
                        docs = VGroup(*[self.document(RIGHT * x + DOWN * 1.8) for x in (-1.2, 0, 1.2)])
                        objects += [docs]
                    else:
                        boundary = Line(UP * 1.8 + RIGHT * 2, DOWN * 2.1 + RIGHT * 2, color=t.role('accent_warm'))
                        objects += [boundary]
                        monitor = VGroup(Rectangle(width=1.1, height=.65), Line(DOWN * .35, DOWN * .65)).set_color(t.role('focus_secondary')).move_to(LEFT * 4 + UP * 1.5)
                        cloud = VGroup(*[Circle(radius=.32).move_to(RIGHT * x) for x in (-.4, 0, .4)]).set_color(t.role('focus_secondary')).move_to(RIGHT * 4 + UP * 1.5)
                        objects += [monitor, cloud]
                    moving_path = [left.get_center() + DOWN * .7, middle.get_center() + DOWN * .9, right.get_center() + DOWN * .7]
                elif kind == 'patterns':
                    # A historical-data plot becomes a learned trend, then an
                    # estimate; no invented numeric axes or proficiency score.
                    axis_x = Line(LEFT * 5 + DOWN * 1.7, RIGHT * .3 + DOWN * 1.7, color=t.role('stroke'))
                    axis_y = Line(LEFT * 5 + DOWN * 1.7, LEFT * 5 + UP * 1.8, color=t.role('stroke'))
                    positions = [LEFT * (4.5 - i * .65) + UP * (-1.2 + i * .32 + (.2 if i % 2 else -.12)) for i in range(7)]
                    dots = VGroup(*[Dot(p, radius=.07, color=t.role('focus_primary')) for p in positions])
                    trend = Line(positions[0], positions[-1], color=t.role('accent_cool'))
                    estimate = self.card(labels[2], RIGHT * 3.3, 'focus_primary')
                    history = self.text(labels[0], 24).move_to(LEFT * 2.5 + UP * 2.15)
                    objects = [axis_x, axis_y, dots, trend, estimate, history]
                    moving_path = [positions[0], positions[-1], estimate.get_center() + DOWN * .9]
                else:
                    claim = self.card(labels[0], LEFT * 3.6)
                    source = self.card(labels[1], RIGHT * 3.6, 'focus_primary')
                    line = Arrow(claim.get_right(), source.get_left(), buff=.2, color=t.role('stroke'))
                    tick = VGroup(Line(LEFT * .5, DOWN * .4), Line(DOWN * .4, RIGHT * .7 + UP * .7)).set_color(t.role('accent_cool')).move_to(DOWN * 1.9 + LEFT * 2)
                    cross = VGroup(Line(LEFT * .5 + UP * .5, RIGHT * .5 + DOWN * .5), Line(LEFT * .5 + DOWN * .5, RIGHT * .5 + UP * .5)).set_color(t.role('accent_warm')).move_to(DOWN * 1.9 + RIGHT * 2)
                    objects = [claim, source, line, tick, cross]
                    objects += [self.document(RIGHT * 3.6 + UP * 1.5)]
                    moving_path = [claim.get_center() + DOWN * .8, source.get_center() + DOWN * .8]
                reveal = min(.35, length / 14)
                for obj in objects:
                    self.play(Create(obj), run_time=reveal)
                # Movement depicts the operation under discussion. Replays
                # remain bounded by the narration budget, never extend audio.
                remaining = self.segment_time_left()
                if remaining > .9:
                    marker = Dot(moving_path[0], radius=.13, color=t.role('focus_secondary'))
                    self.add(marker)
                    travel = min(1.1, (remaining - .3) / len(moving_path))
                    for point in moving_path[1:]:
                        self.play(marker.animate.move_to(point), run_time=travel)
                    if rotor is not None and self.segment_time_left() > .6:
                        self.play(Rotate(rotor, angle=3.14), run_time=.5)
                    if kind == 'language' and 'tokens' in locals():
                        self.play(tokens[-1].animate.set_fill(t.role('focus_secondary'), opacity=.8), run_time=min(.4, self.segment_time_left() / 2))
                # Chalkboard synchronizes to the measured audio segment end.
            self.end_layout_check()

    movie = directory / 'visual.mp4'
    with tempconfig({'pixel_width': 1280, 'pixel_height': 720, 'frame_rate': 24,
                     'media_dir': str(directory / 'media'), 'output_file': str(movie),
                     'disable_caching': True, 'verbosity': 'ERROR', 'progress_bar': 'none'}):
        scene = PersonalizedBoard()
        scene.render()
        rendered = Path(scene.renderer.file_writer.movie_file_path)
    report = json.loads((directory / 'layout_report.json').read_text())
    # Off-screen elements and timing drift are release blockers. Some deliberate
    # plotted/connected geometry is intentionally overlapping; retain all QA.
    violations = report.get('violations', [])
    if any(v.get('type') in ('off_screen', 'timing_overrun', 'sync_drift', 'cue_late') for v in violations):
        raise ValueError('Chalkboard layout or narration timing failed')
    temporary = directory / 'final.tmp.mp4'
    subprocess.run([data['ffmpeg'], '-v', 'error', '-i', str(rendered), '-i', str(audio),
                    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac',
                    '-b:a', '128k', '-t', str(plan['duration']), '-movflags', '+faststart',
                    '-y', str(temporary)], check=True, timeout=120)
    with av.open(str(temporary)) as container:
        duration = float(container.duration / av.time_base)
        if not any(s.type == 'audio' for s in container.streams) or abs(duration - plan['duration']) > .2:
            raise ValueError('Rendered narration duration mismatch')
    os.replace(temporary, directory / 'final.mp4')
    atomic_json(status_file, {'status': 'ready', 'durationSeconds': duration,
                             'renderSeconds': round(time.monotonic() - started, 2),
                             'visualBeats': len(plan['beats']), 'renderer': plan['version'],
                             'timing': plan['timing']})


if __name__ == '__main__':
    manifest = Path(sys.argv[1]).resolve()
    try:
        render(manifest)
    except Exception as error:
        atomic_json(manifest.parent / 'status.json', {'status': 'failed', 'message': str(error)[:350]})
        raise
