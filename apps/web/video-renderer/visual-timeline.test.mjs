import assert from 'node:assert/strict';
import {test} from 'node:test';
import {alignedVisualWav,visualWindows} from './visual-timeline.mjs';
const props={scenes:[{from:0,durationInFrames:144,beats:[{from:0,durationInFrames:48,audio:'asset:first'},{from:48,durationInFrames:48,audio:'asset:second'}]}]};
test('motion captures and frozen holds cover the exact beat timeline',()=>{const w=visualWindows(props,24);assert.deepEqual(w.map(({start,end,until})=>({start,end,until})),[{start:0,end:37,until:48},{start:48,end:85,until:144}]);assert.equal(w.reduce((n,s)=>n+s.until-s.start,0),144);});
test('reference-style export captures slower motion before holding the settled frame',()=>{const classic=visualWindows(props,24),reference=visualWindows({...props,style:'reference-cinema'},24);assert(reference[1].end>classic[1].end);assert.equal(reference[0].end,reference[0].until,'A short beat must not run into the next narration.');assert.equal(reference.reduce((n,s)=>n+s.until-s.start,0),144,'Slower visuals do not change measured audio or total playback.');});
test('PCM audio keeps sample order and places silence only in rounding/holds',()=>{const wav=value=>{const h=Buffer.alloc(44),pcm=Buffer.alloc(96000,value);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(24000,24);h.writeUInt32LE(48000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);};const out=alignedVisualWav(visualWindows(props,24),new Map([['first',wav(1)],['second',wav(2)]]),24);assert.equal(out.length,44+6*48000);assert.equal(out[44],1);assert.equal(out[44+96000],2);assert.equal(out[44+192000],0);assert.throws(()=>alignedVisualWav(visualWindows(props,24),new Map(),24));});

test('topic motion can continue until the end of a spoken beat', () => {
  const demo={...props.scenes[0],motion:[{}],durationInFrames:300,
    beats:[{from:0,durationInFrames:216},{from:216,durationInFrames:48}]};
  const windows=visualWindows({style:'topic-animation',scenes:[demo]},24);
  assert.deepEqual(windows.map(w=>[w.start,w.end,w.until]),[[0,216,216],[216,264,300]]);
});
