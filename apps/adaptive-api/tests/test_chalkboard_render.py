"""Remotion-only lessons must not acquire native drawing dependencies."""
import builtins
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'adaptive_api'))
import chalkboard_directed_render as renderer


class RenderRoutingTests(unittest.TestCase):
    def test_remotion_alignment_preserves_audio_captions_without_loading_manim(self):
        chapters = [{'sceneId': 'a', 'visualKey': 'rule-example', 'kind': 'rule-router',
                     'cues': [{'seconds': 1}, {'seconds': 8}]}]
        captions = [{'start': 0, 'end': 20, 'text': 'The reviewed narration.'}]
        alignment = {'repeatedCompositions': False, 'method': 'whisper-word-timing',
                     'minimumSourceCoverage': .99}
        imports = builtins.__import__

        def without_native(name, *args, **kwargs):
            if name in ('manim', 'cairo', 'chalkboard_base', 'chalkboard_visuals'):
                raise AssertionError('Unexpected native dependency: ' + name)
            return imports(name, *args, **kwargs)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / 'manifest.json'
            manifest.write_text(json.dumps({'hybrid': True, 'remotionKinds': ['rule-router'],
                'playback': {'durationSeconds': 20, 'audio': '/private/existing.wav'},
                'plan': {'version': 3}}))
            with patch.object(renderer, 'align_manifest', return_value=(chapters, captions, alignment)), \
                 patch('builtins.__import__', side_effect=without_native):
                renderer.render(manifest)
            playback = json.loads((root / 'playback.json').read_text())
            self.assertEqual(playback['audio'], '/private/existing.wav')
            self.assertEqual(playback['captions'], captions)
            self.assertEqual(json.loads((root / 'aligned.json').read_text())['chapters'], chapters)
            self.assertFalse(json.loads((root / 'visual-quality.json').read_text())['manimRequired'])
            self.assertFalse((root / 'final.mp4').exists(), 'Alignment alone never publishes a video')

    def test_unsupported_visual_still_requires_native_renderer(self):
        chapters = [{'kind': 'conveyor', 'visualKey': 'belt', 'cues': [{'seconds': 1}]}]
        alignment = {'repeatedCompositions': False, 'method': 'word-timing', 'minimumSourceCoverage': 1}
        imports = builtins.__import__

        def unavailable(name, *args, **kwargs):
            if name == 'manim':
                raise ImportError('Native renderer unavailable')
            return imports(name, *args, **kwargs)

        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'manifest.json'
            manifest.write_text(json.dumps({'hybrid': True, 'remotionKinds': ['rule-router'],
                'playback': {'durationSeconds': 20}, 'plan': {'version': 3}}))
            with patch.object(renderer, 'align_manifest', return_value=(chapters, [], alignment)), \
                 patch('builtins.__import__', side_effect=unavailable), \
                 self.assertRaisesRegex(ImportError, 'Native renderer unavailable'):
                renderer.render(manifest)


if __name__ == '__main__':
    unittest.main()
