import assert from 'node:assert/strict';
import {test} from 'node:test';
import {motionWindows} from './timeline.mjs';
test('motion windows plus still holds cover the exact narration timeline',()=>{
  const windows=motionWindows({cues:[{seconds:1,action:'reveal'},{seconds:8,action:'compare'},{seconds:10,action:'emphasize'}]},0,480,24);
  assert.equal(windows[0].start,0);assert.equal(windows.at(-1).holdUntil,480);
  assert.equal(windows.length,2,'Overlapping actions remain continuous.');
  assert(windows.every(w=>w.end<=w.holdUntil));
  assert.equal(windows.reduce((sum,w)=>sum+w.holdUntil-w.start,0),480);
  assert(windows.reduce((sum,w)=>sum+w.end-w.start,0)<480);
});
test('fractional cue times are bounded by the actual chapter frames',()=>{
  const windows=motionWindows({cues:[{seconds:2.03,action:'reveal'},{seconds:3.99,action:'change'}]},48,96,24);
  assert.equal(windows[0].start,48);assert.equal(windows.at(-1).end,96);
  assert.equal(windows.reduce((sum,w)=>sum+w.holdUntil-w.start,0),48);
});
