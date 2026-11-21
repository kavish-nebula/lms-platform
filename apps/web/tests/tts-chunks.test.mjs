import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationChunks, synthesizeNarration } from '../scripts/tts-chunks.mjs';

test('long narration keeps every sentence and word within bounded speech chunks', () => {
  const text = Array.from({ length: 900 }, (_, i) => i % 15 === 14 ? `word${i}.\n` : `word${i}`).join(' ');
  const chunks = narrationChunks(text);
  assert(chunks.length > 20); assert(chunks.every(c => c.length <= 240));
  assert.equal(chunks.join(' '), text.trim().replace(/\s+/g, ' '));
  assert.throws(() => narrationChunks('x'.repeat(241)), /oversized/);
});
test('speech segments are concatenated without added silence or losing the final segment', async () => {
  const spoken = []; const tts = { generate: async (text, { voice }) => { assert.equal(voice, 'am_michael'); spoken.push(text); return { audio: new Float32Array([0.25, -0.25]), sampling_rate: 24000 }; } };
  const text = 'A source-supported explanation. '.repeat(100) + 'Final evidence marker.';
  const result = await synthesizeNarration(tts, text, 'am_michael');
  assert.equal(spoken.join(' '), text.trim()); assert.equal(result.audio.length, spoken.length * 2); assert.equal(result.audio.at(-1), -0.25);
});
test('topic delivery applies Heart speed and pauses to each spoken sentence', async () => {
  const calls = [];
  const tts = {generate: async (text, options) => {
    calls.push([text, options]); return {audio:Float32Array.of(1),sampling_rate:24000};
  }};
  const result = await synthesizeNarration(tts,'Ready? It moved. Next.', 'af_heart', 0.84, true);
  assert.deepEqual(calls.map(c=>c[0]), ['Ready?', 'It moved.', 'Next.']);
  assert(calls.every(([,options])=>options.voice==='af_heart' && options.speed===0.84));
  assert.deepEqual([...result.audio.keys()].filter(i=>result.audio[i]===1),[0,11041,18242]);
  assert.equal(result.audio.length,33843);
});
