/* node --test apps/web/tests/course-reader.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
const code=ts.transpileModule(fs.readFileSync(path.join(root,'apps/web/src/lib/course-reader.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('require','module','exports',code)(require,mod,mod.exports);
const {readerModule,readerAudioSources,parseReader,readerHref,readingDetails}=mod.exports;
const source=JSON.parse(fs.readFileSync(path.join(root,'fixtures/videos-ai-agent.json'),'utf8'));
test('all AI-agent chapters preserve narration and audio without assessment payloads',()=>{
  for(const id of ['m1','m2','m3','m4','m5','m6']){
    const videos=source.videos.filter(v=>v.module===id);
    const result=readerModule({module_id:id,title:id,blocks:[{stage:'explainer',videos},{stage:'gate',items:[{correct:'secret'}]}]});
    assert.equal(result.chapters.length,videos.length);
    result.chapters.forEach((v,i)=>{
      assert.equal('midQuiz' in v,false);assert.equal('endQuiz' in v,false);assert.equal('quizAfter' in v,false);
      assert.deepEqual(v.slides,videos[i].slides);assert.deepEqual(v.audio,videos[i].audio);
      v.slides.forEach(s=>{assert(s.narration.length>0);assert(Array.isArray(readingDetails(s)));});
    });
  }
});
test('reading state is versioned and safely recovers malformed browser data',()=>{
  for(const value of ['bad','null','{"version":99}','[]'])assert.equal(parseReader(value).version,1);
  const state=parseReader(JSON.stringify({version:1,read:['m1-1','m1-1',7],starred:['m2-1'],pages:{'m1-1':4,'m1-2':-2,'m1-3':'x'},font:500}));
  assert.deepEqual(state.read,['m1-1']);assert.deepEqual(state.pages,{'m1-1':4});assert.equal(state.font,18);
  assert.equal('grades' in state,false);assert.equal('watched' in state,false);
});
test('reader links retain stable chapter identity and book mode across modules',()=>{
  assert.equal(readerHref('ai-agent','m2','m2-1',true),'/learn/courses/ai-agent/m2/reader?chapter=m2-1&book=1');
  assert(!readerHref('ai-agent','m1','m1-1').includes('book='));
  assert(readerHref('ai-agent','m1','m1-1').includes('view=article'));
  assert.equal(readerHref('ai-agent','m1','m1-1',false,true),'/learn/courses/ai-agent/m1/reader?chapter=m1-1');
});

test('reference narration uses original clips for every course slide',()=>{
  for(const video of source.videos){
    const clips=readerAudioSources(video);
    assert.equal(clips.length,video.slides.length);
    clips.forEach((clip,i)=>assert.equal(clip,video.audio?video.audio[i]??'':`/audio/video-${video.id}-s${i}.mp3`));
  }
  const video={id:'reference',slides:[{},{}]};
  assert.deepEqual(readerAudioSources(video),['/audio/video-reference-s0.mp3','/audio/video-reference-s1.mp3']);
  assert.deepEqual(readerAudioSources({...video,audio:['/authored.wav']}),['/authored.wav','']);
});
