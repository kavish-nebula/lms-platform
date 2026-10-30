import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {narrationChunks,synthesizeNarration} from '../../scripts/tts-chunks.mjs';
const lesson=JSON.parse(await readFile(new URL('../../../../fixtures/module-production/ai-essentials-m1.json',import.meta.url),'utf8'));
for(const slide of lesson.slides){
  const chunks=narrationChunks(slide.narration);
  assert.equal(chunks.join(' '),slide.narration.trim().replace(/\s+/g,' '));
  assert(chunks.every(c=>c.length<=240));
  const spoken=[];
  const result=await synthesizeNarration({generate:async text=>{spoken.push(text);return {audio:new Float32Array(text.length),sampling_rate:24000};}},slide.narration,'am_michael');
  assert.deepEqual(spoken,chunks);
  assert.equal(result.audio.length,chunks.reduce((n,c)=>n+c.length,0));
}
console.log('PASS full lesson narration: every source sentence retained in bounded speech chunks and concatenated in order.');
