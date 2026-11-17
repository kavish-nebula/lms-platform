import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { profileProductionHook, validateProfileProductionHook } from '@/lib/profile-production-hook';
import { hookScenes, hookNarration, hookTeachingScene, hookTeachingClock, type VideoHook } from '@/lib/video-first-hook';
import { conceptSlides, conceptSlideAt } from '@/lib/concept-slides';
const course = 'dd1fec93-8c51-4f2d-9e0c-943823062c76';
const source: VideoHook = { title: 'Inspect the cooler', situation: 'The coolant has aged. The cooler still switches on at its programmed 70-degree threshold.', question: 'What is missing?', sourceIds: ['M1S1'], objectiveIds: ['O1'] };
const original = JSON.stringify(source);
for (const field of ['finance', 'healthcare']) {
  const result = profileProductionHook(source, course, { profile: { field } });
  validateProfileProductionHook(result, result);
  assert.deepEqual(result.sourceIds, source.sourceIds);
  assert.deepEqual(result.objectiveIds, source.objectiveIds);
  assert.match(result.situation, /original recording/);
  assert.match(result.title, field === 'finance' ? /payables/ : /clinic/);
  assert.throws(() => validateProfileProductionHook(result, source));
  const scenes = hookScenes(result);
  assert.equal(hookNarration(result), `${result.situation} ${result.question}`.replace(/\s+/g, ' '));
  for (const scene of scenes) {
    const visual = hookTeachingScene(scene, result.title);
    const slides = conceptSlides(visual);
    assert.equal(slides.map(s => s.text).join(' '), scene.text.replace(/\s+/g, ' '));
    assert.ok(!visual.bridge, 'Do not append unspoken bridge content.');
    assert.equal(conceptSlideAt(slides, 30, 30), slides.length - 1);
  }
  const scene = scenes[1];
  assert.deepEqual(hookTeachingClock(scene, 4, 12, true), { seconds: 4, duration: 12 });
  const whole = hookTeachingClock(scene, scene.start * 100 + 2, 100, false);
  assert.ok(Math.abs(whole.seconds - 2) < .001);
  assert.equal(whole.duration, (scene.end - scene.start) * 100);
}
assert.equal(profileProductionHook(source, 'another-course', { profile: { field: 'finance' } }), source);
assert.equal(profileProductionHook(source, course, { profile: { field: 'education' } }), source);
assert.equal(profileProductionHook({ ...source, sourceIds: ['M2S1'] }, course, { profile: { field: 'finance' } }).title, source.title);
assert.equal(JSON.stringify(source), original, 'Approved source remains unchanged.');
const folder = path.resolve('../../fixtures/authored-courses/ai-for-production-module1/finance-hook');
const saved = JSON.parse(fs.readFileSync(path.join(folder, 'lesson.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'audio-manifest.json'), 'utf8'));
assert.deepEqual(saved.scenes.map((s: { text: string }) => s.text), hookScenes(saved.problemHook).map(s => s.text));
assert.equal(manifest.clips.length, saved.scenes.length);
let seconds = 0;
for (const [i, clip] of manifest.clips.entries()) {
  assert.equal(clip.file, `audio/section-${i + 1}.wav`);
  const bytes = fs.readFileSync(path.join(folder, clip.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256);
  assert.equal(bytes.length, clip.bytes);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  let rate = 0, duration = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (kind === 'fmt ') rate = bytes.readUInt32LE(offset + 16);
    if (kind === 'data') { assert(rate > 0); duration = size / rate; assert(bytes.subarray(offset + 8, offset + 8 + size).some(b => b !== 0), 'Narration is not silent.'); }
    offset += 8 + size + size % 2;
  }
  assert.equal(duration, clip.durationSeconds);
  seconds += duration;
}
assert.equal(seconds, manifest.measuredDurationSeconds);
console.log('Profile hook cases, source isolation, narration/slide parity and both playback clocks passed.');
