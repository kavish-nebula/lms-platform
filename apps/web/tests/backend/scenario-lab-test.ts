import assert from 'node:assert/strict';
import { EMPTY_BRIEF, type CourseBriefData } from '@/lib/content-creator';
import { SourceLibrary, courseSources, moduleHasScenarioLab, sourceCoverage, reviseSourceLibrary } from '@/lib/source-library';
import { smeModuleActivities, smeActivityIssues } from '@/lib/sme-module-activities';
import { moduleAuthoringInput } from '@/lib/module-authoring';
import { moduleInputHash } from '@/server/video-first-authoring';
import { AuthoredCoursePackage, validateAuthoredCourse } from '@/lib/authored-course';
import { authoredDelivery } from '@/lib/authored-delivery';
import { piecesOf } from '@/server/adapt/pieces';
import { courseDeckSlides } from '@/lib/pptx-export';
import { blueprintInput, validateBlueprint } from '@/lib/instructional-blueprint';
import { blueprintShape } from '@/server/blueprint-ai';
import { createCreatorDraft, updateCreatorDraft, getCreatorDraft } from '@/server/content-creator';
import { closeDb } from '@/server/db/client';
import { sandboxPackage } from './fixtures/project-sandbox';

const brief: CourseBriefData = { ...EMPTY_BRIEF, title: 'Optional scenario fixture', subject: 'Handoffs', audience: 'Beginners', outcomes: 'Use evidence.', dependencies: 'Read before applying.', objectives: [{text:'Name the supplied owner.',bloom:'Apply'}], sourceLibrary: {version:1,modules:[{id:'M1',title:'Read notes',scenarioLabEnabled:true,topics:[{id:'T1',title:'Source facts'}]},{id:'M2',title:'Later module',scenarioLabEnabled:false,topics:[]}],sources:[
 {id:'S1',revision:1,title:'Teaching',scope:'topic',moduleId:'M1',topicId:'T1',text:'Use only the supplied facts. Missing owners stay unknown.',reference:'Synthetic fixture',objectiveIds:['O1']},
 {id:'LAB',revision:1,title:'A missing owner',purpose:'scenario-lab',scope:'module',moduleId:'M1',topicId:'',text:'Explain a source-grounded next action.',reference:'SME fixture',objectiveIds:['O1'],scenarios:[{id:'CASE1',title:'A new request',situation:'The supplied note names no owner.',challenge:'Decide what to do next.',expectedEvidence:'Mark the owner unknown and ask for clarification.'}]}
]}};
assert(SourceLibrary.safeParse(brief.sourceLibrary).success);
const fragments=smeModuleActivities(brief,'M1');assert.equal(fragments.scenarioLab!.scenarios[0].id,'CASE1');assert.deepEqual(fragments.scenarioLab!.scenarios[0].sourceIds,['LAB','S1']);
assert.equal(moduleAuthoringInput(brief,'M1').scenarioLabEnabled,true);
const legacy=structuredClone(brief);delete legacy.sourceLibrary!.modules[0].scenarioLabEnabled;assert(moduleHasScenarioLab(legacy,'M1'),'Existing modules retain labs.');
const disabled=structuredClone(brief);disabled.sourceLibrary!.modules[0].scenarioLabEnabled=false;
assert(!smeModuleActivities(disabled,'M1').scenarioLab);assert(!courseSources(disabled).some(s=>s.id==='LAB'));assert(!moduleAuthoringInput(disabled,'M1').sources.some(s=>s.id==='LAB'));
assert.notEqual(moduleInputHash(brief,'M1'),moduleInputHash(disabled,'M1'));assert.equal(moduleInputHash(brief,'M2'),moduleInputHash(disabled,'M2'),'One module setting must not stale another.');
const incomplete=structuredClone(brief);incomplete.sourceLibrary!.sources[1].scenarios![0].challenge='';assert(SourceLibrary.safeParse(incomplete.sourceLibrary).success,'Incomplete drafts save.');assert(sourceCoverage(incomplete,'M1').some(s=>s.includes('scenario lab')));incomplete.sourceLibrary!.modules[0].scenarioLabEnabled=false;assert.deepEqual(sourceCoverage(incomplete,'M1'),[],'Disabled unfinished labs do not block generation.');
const duplicate=structuredClone(brief);duplicate.sourceLibrary!.sources[1].scenarios![0].id='T1';assert(!SourceLibrary.safeParse(duplicate.sourceLibrary).success);
const revised=structuredClone(brief.sourceLibrary!);revised.sources[1].scenarios![0].challenge+=' Explain why.';assert.equal(reviseSourceLibrary(revised,brief.sourceLibrary).sources[1].revision,2);assert.equal(reviseSourceLibrary(revised,brief.sourceLibrary).sources[0].revision,1);
const reordered=JSON.parse(JSON.stringify(brief.sourceLibrary),(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).reverse()):v);assert.equal(reviseSourceLibrary(reordered,brief.sourceLibrary).sources[1].revision,1,'JSONB key order does not revise unchanged scenarios.');
const pkg=sandboxPackage();delete pkg.modules[0].scenarioLab;pkg.modules[0].moduleQuiz={title:'Module check',instructions:'Select one answer.',questions:[{...pkg.courseEnd.masteryGate.questions[0],id:'MODQ1'}]};
validateAuthoredCourse(pkg,{objectives:['O1','O2'],smeSourceIds:['S1'],briefRevision:1});assert.deepEqual(smeActivityIssues(pkg.modules[0],disabled),[]);assert(smeActivityIssues(pkg.modules[0],brief).some(s=>s.includes('include')));
const withManual=structuredClone(pkg.modules[0]);withManual.scenarioLab=fragments.scenarioLab;assert.deepEqual(smeActivityIssues(withManual,brief),[]);assert(smeActivityIssues(withManual,disabled).some(s=>s.includes('omit')));withManual.scenarioLab!.scenarios[0].challenge='Changed';assert(smeActivityIssues(withManual,brief).some(s=>s.includes('preserve')));
const narrated=structuredClone(pkg);narrated.modules[0].narratedStages={hook:[{...pkg.modules[0].conceptExplainer.videos[0].slides[0],id:'NH'}],worked:[{...pkg.modules[0].conceptExplainer.videos[0].slides[0],id:'NW'}],guided:[{...pkg.modules[0].conceptExplainer.videos[0].slides[0],id:'NG'}]};assert(AuthoredCoursePackage.safeParse(narrated).success);
const delivered=authoredDelivery({courseId:'fixture',revisionId:'fixture-edition',content:pkg});const first=delivered.modules[0];assert.deepEqual(first.stages_included,['hook','explainer','worked','guided','gate']);assert(!delivered.course.modules[0].topics?.some(t=>t.stage==='lab'));assert(!first.blocks.some(b=>b.stage==='lab'));assert(delivered.modules[1].blocks.some(b=>b.stage==='lab'),'A neighbouring module keeps its lab.');
first.videoFirstActivities={problemHook:pkg.modules[0].problemHook,workedExamples:pkg.modules[0].workedExamples,guidedPractice:pkg.modules[0].guidedPractice};assert(!piecesOf(first).some(p=>p.piece==='activity:lab'),'No hidden lab adaptation jobs.');assert(courseDeckSlides(pkg).some(s=>s.title.includes('Scenario Lab')),'Other module still exports.');
const one=structuredClone(disabled);one.sourceLibrary!.modules=one.sourceLibrary!.modules.slice(0,1);const input=blueprintInput(one,'codex-ild-v2');const blueprint=blueprintShape(input);assert.deepEqual(blueprint.modules[0].steps.map(s=>s.kind),['hook','concept','worked_example','guided_practice']);validateBlueprint(blueprint,input);const unwanted=structuredClone(blueprint);unwanted.modules[0].steps.push({kind:'scenario',activity:'Unwanted lab',minutes:1});unwanted.modules[0].minutes++;assert.throws(()=>validateBlueprint(unwanted,input),/teaching steps/);
const draft=await createCreatorDraft('u-1001',{brief});const off=await updateCreatorDraft('u-1001',draft.id,{revision:1,brief:disabled});const read=await getCreatorDraft('u-1001',draft.id);assert.equal(read.brief.sourceLibrary!.modules[0].scenarioLabEnabled,false);assert.equal(read.brief.sourceLibrary!.sources[1].scenarios![0].title,'A new request');await assert.rejects(updateCreatorDraft('u-1001',draft.id,{revision:1,brief}),{status:409});await updateCreatorDraft('u-1001',draft.id,{revision:off.revision,brief});assert.equal((await getCreatorDraft('u-1001',draft.id)).brief.sourceLibrary!.sources[1].revision,1);
await closeDb();console.log('PASS optional scenario labs: per-module policy, manual preservation, draft persistence, disabled-source isolation, blueprint ordering, learner navigation, adaptation, exports, stale writes and legacy compatibility.');
