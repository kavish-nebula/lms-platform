import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'adaptive_api'))
from chalkboard_alignment import align_source, phrase_time


class AlignmentTests(unittest.TestCase):
    def test_audio_words_anchor_visual_not_word_proportions(self):
        words = [{'word': w, 'start': t, 'end': t+.2} for w,t in
                 [('A',.2),('fixed',.4),('rule',1.0),('routes',3.2),('the',3.5),('request',3.7)]]
        expected, mapping, coverage = align_source('A fixed rule routes the request.', words)
        self.assertEqual(coverage, 1)
        self.assertEqual(phrase_time('rule routes the request', expected, mapping)[0], 1.0)
        self.assertEqual(phrase_time('routes the request', expected, mapping)[0], 3.2)

    def test_missing_evidence_never_silently_uses_estimated_time(self):
        with self.assertRaisesRegex(ValueError, 'coverage'):
            align_source('The cooler follows a fixed programmed condition.', [{'word': 'unrelated', 'start': 0, 'end': 1}])
        expected, mapping, _ = align_source('Review the supplied source.', [{'word': w,'start':i,'end':i+.5} for i,w in enumerate(['Review','the','supplied','source'])])
        with self.assertRaisesRegex(ValueError, 'not found'):
            phrase_time('invented missing phrase', expected, mapping)

    def test_missed_leading_word_uses_first_recognized_word_not_a_guess(self):
        source = 'You inspect the source record before deciding what happens next.'
        recognized = [{'word':w,'start':i+.5,'end':i+.8} for i,w in enumerate(source.split()[1:])]
        expected,mapping,_ = align_source(source,recognized)
        when,_ = phrase_time('You inspect the source',expected,mapping)
        self.assertEqual(when,.5)
        with self.assertRaisesRegex(ValueError,'reliable'):
            phrase_time('You inspect the source',expected,{2:(1,2)})


if __name__ == '__main__':
    unittest.main()
