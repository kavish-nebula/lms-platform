import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { conceptSlides, conceptSlideAt, conceptSlideDuration } from '@/lib/concept-slides';
import { conceptNarration, type ConceptScene } from '@/lib/personalized-concept';
const fixture = JSON.parse(fs.readFileSync(path.resolve('../../fixtures/authored-courses/ai-for-production-module1/healthcare-automation/lesson.json'), 'utf8'));
const scenes: ConceptScene[] = fixture.scenes;
assert.ok(scenes.length > 1);
for (const scene of scenes) {
  const before = JSON.stringify(scene);
  const slides = conceptSlides(scene);
  assert.ok(slides.length >= 3);
  assert.equal(slides.map(s => s.text).join(' '), conceptNarration(scene).replace(/\s+/g, ' ').trim(), 'Preserve every word and its order.');
  assert.ok(slides.every(s => s.text.split(/\s+/).length <= 34));
  assert.equal(conceptSlideAt(slides, 0, 60), 0);
  assert.equal(conceptSlideAt(slides, -10, 60), 0);
  assert.equal(conceptSlideAt(slides, 60, 60), slides.length - 1);
  assert.equal(conceptSlideAt(slides, Infinity, 60), 0);
  for (const [i, slide] of slides.entries()) {
    const time = 60 * (slide.startWord + .01) / slides.at(-1)!.endWord;
    assert.equal(conceptSlideAt(slides, time, 60), i, 'Audio clock advances each slide; seeking restores it.');
    assert.equal(conceptSlideAt(slides, time * 2, 120), i, 'Use measured duration rather than fixed timers.');
  }
  assert.equal(slides.at(-1)!.context, true);
  assert.equal(conceptSlideDuration(scene, 51.5), 51.5);
  assert.ok(conceptSlideDuration(scene, 0) > 0);
  assert.equal(JSON.stringify(scene), before, 'Preserve narration, IDs, source mappings and check phases.');
}
assert.equal(conceptSlideAt([], 0, 0), 0);
console.log('Concept slide timing, source preservation, seek and measured-duration tests passed.');
