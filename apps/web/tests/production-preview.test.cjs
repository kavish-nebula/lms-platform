/* node --test apps/web/tests/production-preview.test.cjs */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'../../..');const cache=new Map();
function load(file){const p=path.resolve(root,file);if(cache.has(p))return cache.get(p).exports;const mod={exports:{}};cache.set(p,mod);const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const local=id=>{if(id.endsWith('.css'))return {};if(id.startsWith('.')||id.startsWith('@/')){const base=id.startsWith('@/')?path.join(root,'apps/web/src',id.slice(2)):path.resolve(path.dirname(p),id);const source=['.ts','.tsx','.js'].map(ext=>base+ext).find(f=>fs.existsSync(f));if(!source)throw Error('Missing '+id);return load(path.relative(root,source));}return require(id);};new Function('require','module','exports',code)(local,mod,mod.exports);return mod.exports;}
const {ProductionVideoPreview}=load('apps/web/src/components/content/production-video-preview.tsx');
const slide=(id,title)=>({id,title,step:'concept',layout:'bullets',subtitle:'',content:['Source-grounded concept'],otherContent:[],leftLabel:'',rightLabel:'',takeaway:'Check the evidence',narration:`Matching script for ${id}.`,pronunciationNotes:'',activityNotes:'',activityMinutes:0,objectiveIds:['O1'],sourceIds:['S1'],uncertainties:[]});
const content={title:'Creator video',slides:[slide('s1','First concept'),slide('s2','Second concept')],reviewNotes:[]};
const clips=[{slideId:'s2',key:'clip-two',seconds:380,narrationHash:'two',reused:false},{slideId:'s1',key:'clip-one',seconds:330,narrationHash:'one',reused:false}];
const render=props=>renderToStaticMarkup(React.createElement(ProductionVideoPreview,{content,clips,audioUrl:'/owner/audio?jobId=job&audioId=audio',ready:true,disabled:false,...props}));
test('creator video aligns slide, narration and clip by stable ID even when clips arrive out of order',()=>{const html=render();assert.match(html,/Narrated slide preview: First concept/);assert.match(html,/Matching script for s1/);assert.match(html,/<audio[^>]+slideId=s1/);assert.doesNotMatch(html,/<audio[^>]+slideId=s2/);assert.match(html,/5:30 measured narration/);assert.doesNotMatch(html,/<audio[^>]*autoPlay/i);});
test('incomplete video cannot start continuous playback while completed individual clips remain available',()=>{const html=render({ready:false});assert.match(html,/<button[^>]*disabled[^>]*>Play video/);assert.match(html,/<audio/);assert.match(html,/Continuous playback requires the complete current approved video audio/);});
test('unsaved authoring changes remove playable audio from the preview',()=>{const html=render({disabled:true});assert.doesNotMatch(html,/<audio/);assert.match(html,/Save your changes before previewing audio/);assert.match(html,/<button[^>]*disabled[^>]*>Play video/);});
test('clips over seven minutes cannot start continuous playback even if an older job says ready',()=>{const html=render({clips:clips.map(c=>({...c,seconds:420.01}))});assert.match(html,/<button[^>]*disabled[^>]*>Play video/);assert.match(html,/Outside 5–7 minute range/);});

const {LongformWorkspace}=load('apps/web/src/components/content/longform-workspace.tsx');
const {CourseDeliveryFlow}=load('apps/web/src/components/content/course-delivery-flow.tsx');
const {moduleDeliverySteps}=load('apps/web/src/lib/course-delivery.ts');
const {crossesVideoCheckpoint}=load('apps/web/src/lib/longform-production.ts');
const {VideoMidpointCheck}=load('apps/web/src/components/content/video-midpoint-check.tsx');
test('midpoint gates slide four end and forward skips, but not earlier slides or completed checks',()=>{
 assert.equal(crossesVideoCheckpoint(3,4,3,false),true);assert.equal(crossesVideoCheckpoint(0,7,3,false),true);
 assert.equal(crossesVideoCheckpoint(2,3,3,false),false);assert.equal(crossesVideoCheckpoint(3,4,3,true),false);assert.equal(crossesVideoCheckpoint(0,1,-1,false),false);
});
test('two-question check starts paused with progression disabled and explicit retry guidance',()=>{
 const q=id=>({id,prompt:'Source question '+id,choices:['A','B','C'],correct:1,hint:'Consider the available evidence.',explanation:'The source supports B.',sourceIds:['S1'],objectiveIds:['O1']});
 const html=renderToStaticMarkup(React.createElement(VideoMidpointCheck,{questions:[q('one'),q('two')],onContinue:()=>{}}));
 assert.match(html,/Question 1 of 2/);assert.match(html,/wrong answer shows a hint/);assert.match(html,/previous correct answers are retained/);assert.match(html,/<button[^>]*disabled[^>]*>Continue video/);assert.doesNotMatch(html,/<audio/);
});
test('six-stage delivery keeps module quiz local and places the three final stages after M4',()=>{
 const html=renderToStaticMarkup(React.createElement(CourseDeliveryFlow,{structure:'six-stage-v1',lastModule:'M4'}));
 const stages=['Problem Hook','Concept Explainer','Worked Example','Guided Practice','Scenario Lab','Quiz','After completing M4','Mastery Gate','Reflection','Spaced Review'];let position=-1;for(const stage of stages){const next=html.indexOf(stage,position+1);assert.ok(next>position,stage);position=next;}
 assert.match(html,/No mini-project is required/);assert.match(html,/require separate authoring and review/);
 assert.equal(renderToStaticMarkup(React.createElement(CourseDeliveryFlow,{structure:'legacy'})),'');
});
test('projecting a frozen legacy blueprint preserves the source and yields exactly six delivery stages',()=>{
 const original=['hook','concept','worked_example','guided_practice','scenario','project_contribution','mastery_gate','reflection','spaced_review'].map(kind=>({kind,activity:kind,minutes:3}));const before=JSON.stringify(original);
 assert.deepEqual(moduleDeliverySteps(original).map(s=>s.kind),['hook','concept','worked_example','guided_practice','scenario','quiz']);assert.equal(JSON.stringify(original),before);
});
test('saved slide and script counts appear immediately while measured audio readiness loads',()=>{
 const run={id:'run',courseId:'course',inputRevision:4,input:{brief:{title:'General AI'},objectives:[],sources:[]},output:{modules:[{id:'M1',title:'Module one',minutes:270,objectiveIds:[]}]}};
 const revision={id:'saved',version:1,content:{...content,slides:Array.from({length:8},(_,i)=>slide('s'+i,'Concept '+i))}};
 const initialState={eligible:true,configured:true,reason:'Approved for authoring',approval:{id:'approval',reviewerName:'Reviewer'},format:'longform-v1',jobs:[{id:'video',status:'ready',currentRevision:1,outdated:false,input:{unit:{kind:'video',key:'v1'}},revisions:[revision],reviews:[{revisionId:'saved',verdict:'approved'}]}]};
 const html=renderToStaticMarkup(React.createElement(LongformWorkspace,{run,moduleId:'M1',initialState}));const text=html.replace(/<[^>]+>/g,'');assert.match(text,/8 slides/);assert.match(text,/Scripts: Approved/);assert.match(text,/Checking saved asset readiness/);assert.ok(text.includes('Audio 300–420s/slide: Checking'));
});
