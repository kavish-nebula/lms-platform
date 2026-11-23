import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'adaptive_api'))
from chalkboard_alignment import align_source, phrase_time, phrase_anchor, adjacent_layers, tokens, optional_bridge_cue


class AlignmentTests(unittest.TestCase):
    def test_unrecognized_optional_bridge_cannot_block_required_teaching(self):
        scene={'bridge':'Like reviewing finance and audit reports before presenting data.'}
        cue={'target':'result','phrase':'Like reviewing finance and audit reports'}
        self.assertTrue(optional_bridge_cue(cue,scene))
        self.assertFalse(optional_bridge_cue({**cue,'target':'primary'},scene))
        self.assertFalse(optional_bridge_cue({**cue,'target':'secondary'},scene))
        self.assertFalse(optional_bridge_cue({**cue,'phrase':'Review the supplied source record'},scene))
    def test_spoken_measurements_match_digit_transcriptions_without_changing_values(self):
        self.assertEqual(tokens('sixty-eight degrees Celsius; nine point two'),tokens('68 degrees Celsius; 9.2'))
        source='The reading rises from sixty-eight to seventy-one degrees. The ratio is nine point two.'
        recognized='The reading rises from 68 to 71 degrees. The ratio is 9 .2.'
        words=[{'word':word,'start':i,'end':i+.3} for i,word in enumerate(recognized.split())]
        expected,mapping,coverage=align_source(source,words)
        self.assertEqual(coverage,1)
        self.assertEqual(phrase_time('nine point two',expected,mapping)[0],11)
        self.assertNotEqual(tokens('9.2'),tokens('9.1'))
        self.assertNotEqual(tokens('0007'),tokens('7'))
        self.assertEqual(tokens('SKU10482'),['sku10482'])

    def test_acronym_repair_requires_a_fully_recognized_source_subphrase(self):
        expected=['with','ollama','a','single','command','can']
        mapping={0:(0,.2),3:(1.4,1.7),4:(1.8,2.1),5:(2.2,2.5)}
        with self.assertRaisesRegex(ValueError,'reliable'):
            phrase_time('With Ollama a single command can',expected,mapping)
        self.assertEqual(phrase_anchor('With Ollama a single command can',expected,mapping,allow_subphrase=True),(1.4,3,'single command can'))
        with self.assertRaisesRegex(ValueError,'reliable'):
            phrase_anchor('With Ollama a single command can',expected,{4:(1,2),5:(2,3)},allow_subphrase=True)

    def test_adjacent_additive_layers_can_share_a_later_spoken_anchor(self):
        ranges = [(0, 5, 'First.'), (5, 11, 'Second.'), (11, 15, 'Third.')]
        a = {'target':'primary','action':'reveal','sourceWord':0}
        b = {'target':'secondary','action':'compare','sourceWord':5}
        self.assertTrue(adjacent_layers(a,b,ranges))
        self.assertFalse(adjacent_layers(a,{**b,'sourceWord':11},ranges))
        self.assertFalse(adjacent_layers(a,{**b,'target':'primary'},ranges))
        self.assertFalse(adjacent_layers(a,{**b,'action':'change'},ranges))

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
