/* node --test apps/web/tests/desktop-workflow.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const messages=require('../../../packages/i18n/en.json');
const root=path.resolve(__dirname,'../../..'),cache=new Map();
function load(file){
  const p=path.resolve(root,file);
  if(cache.has(p))return cache.get(p).exports;
  const mod={exports:{}};cache.set(p,mod);
  const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const local=id=>{
    if(id==='next-intl')return {useTranslations:ns=>(key,values={})=>Object.entries(values).reduce((s,[k,v])=>s.replaceAll(`{${k}}`,String(v)),messages[ns]?.[key]??key)};
    if(id.startsWith('.')||id.startsWith('@/')){const base=id.startsWith('@/')?path.join(root,'apps/web/src',id.slice(2)):path.resolve(path.dirname(p),id);const source=['.ts','.tsx','.js'].map(ext=>base+ext).find(f=>fs.existsSync(f));if(!source)throw Error('Missing '+id);return load(path.relative(root,source));}
    return require(id);
  };
  new Function('require','module','exports',code)(local,mod,mod.exports);return mod.exports;
}
const practice=load('apps/web/src/lib/guided-responses.ts');
const {CourseWorkflowNav}=load('apps/web/src/components/content/course-workflow-nav.tsx');
const {LessonOrderPreview}=load('apps/web/src/components/enroll/lesson-order-preview.tsx');
const {GuidedAnswerFields}=load('apps/web/src/components/player/guided-answer-fields.tsx');

test('creator stages retain one ordered route map across recorded and narrated authoring',()=>{
  for(const videoFirst of [false,true])for(let step=1;step<=5;step++){
    const html=renderToStaticMarkup(React.createElement(CourseWorkflowNav,{courseId:'course',runId:'reviewed-run',step,videoFirst}));
    const links=Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g));
    assert.deepEqual(links.map(m=>m[1]),['/content/courses/course','/content/courses/course/blueprint','/content/courses/course/blueprint/review/reviewed-run','/content/courses/course/production','/content/courses/course/authoring']);
    assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
    assert.match(links[step-1][0],/aria-current="step"/);
    assert.match(links[3][2],/Stage 4:.*Produce lessons/);
    assert.match(links[4][2],/Stage 5:.*Review and publish/);
  }
  const entry=renderToStaticMarkup(React.createElement(CourseWorkflowNav,{courseId:'course',step:3}));
  assert.match(entry,/href="\/content\/courses\/course\/blueprint\/review"/);
});

test('preference preview explains the selected support without promising reordered teaching',()=>{
  for(const preference of ['idea','example','try']){
    const html=renderToStaticMarkup(React.createElement(LessonOrderPreview,{order:['idea','example','try'],preference}));
    assert.match(html,/Approved teaching sequence/);
    assert.match(html,/does not rearrange recordings or assessments/);
    assert(html.includes(messages.enroll[`preference_help_${preference}`]));
    const order=html.slice(html.indexOf('<ol'));
    assert(order.indexOf('Idea')<order.indexOf('Example'));
    assert(order.indexOf('Example')<order.indexOf('Try'));
  }
});

test('empty or unreviewed practice never counts as ready; edits invalidate comparison',()=>{
  let answers={};
  assert.equal(practice.practiceResponsesReady(answers,['step']),false);
  assert.deepEqual(practice.comparePracticeAnswer(answers,'step'),{});
  answers=practice.updatePracticeAnswer(answers,'step','  Preserve the proposed status.  ');
  assert.equal(practice.practiceResponsesReady(answers,['step']),false);
  answers=practice.comparePracticeAnswer(answers,'step');
  assert.equal(practice.practiceResponsesReady(answers,['step']),true);
  answers=practice.updatePracticeAnswer(answers,'step','A revised attempt.');
  assert.equal(practice.practiceResponsesReady(answers,['step']),false);
  assert.equal(practice.practiceResponsesReady({},[]),false);
});

test('practice drafts round-trip, reject corrupt/future data and ignore removed steps',()=>{
  const responses=practice.comparePracticeAnswer(practice.updatePracticeAnswer({},'step','An attempt.'),'step');
  const raw=JSON.stringify({version:1,responses:{...responses,removed:{answer:'Old answer'}}});
  assert.deepEqual(practice.readPracticeResponses(raw,['step']),responses);
  assert.deepEqual(practice.readPracticeResponses('{',['step']),{});
  assert.deepEqual(practice.readPracticeResponses(JSON.stringify({version:2,responses}),['step']),{});
  const stale=JSON.stringify({version:1,responses:{step:{answer:'Changed.',comparedAnswer:'Old answer.'}}});
  assert.equal(practice.practiceResponsesReady(practice.readPracticeResponses(stale,['step']),['step']),false);
  assert.notEqual(practice.guidedResponseKey('one','M1','r1'),practice.guidedResponseKey('two','M1','r1'));
  assert.notEqual(practice.guidedResponseKey('one','M1','r1'),practice.guidedResponseKey('one','M1','r2'));
});

test('answer fields are labelled, require an attempt and do not expose model evidence before comparison',()=>{
  const html=renderToStaticMarkup(React.createElement(GuidedAnswerFields,{steps:[{id:'step',instruction:'Write a bounded prompt.',hint:'Keep the supplied uncertainty.',evidence:'MODEL_EVIDENCE_NOT_YET_REVEALED'}],onReadyChange:()=>{}}));
  assert.match(html,/<label[^>]+for=/);
  assert.match(html,/<textarea[^>]+maxLength="6000"/);
  assert.match(html,/<button[^>]*disabled[^>]*>Compare my attempt/);
  assert.match(html,/self-review, not an automatic grade/);
  assert.doesNotMatch(html,/MODEL_EVIDENCE_NOT_YET_REVEALED/);
});
