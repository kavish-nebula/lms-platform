import assert from 'node:assert/strict';
import { EMPTY_BRIEF, type CourseBriefData } from '@/lib/content-creator';
import { SourceLibrary, sourceCoverage, reviseSourceLibrary, moduleSourceIssues } from '@/lib/source-library';
import { smeModuleActivities, smeActivityIssues } from '@/lib/sme-module-activities';
import { moduleAuthoringInput } from '@/lib/module-authoring';
import { AuthoredCoursePackage, type AuthoredCoursePackageData } from '@/lib/authored-course';
import { createCreatorDraft, updateCreatorDraft, getCreatorDraft } from '@/server/content-creator';
import { getCodexCourseContext, saveAuthoredCourse } from '@/server/authored-course';
import { getSessionUser } from '@/server/auth';
import { startBlueprint, processBlueprint } from '@/server/creator-blueprints';
import { blueprintShape } from '@/server/blueprint-ai';
import { blueprintInput } from '@/lib/instructional-blueprint';
import { saveSmeReview } from '@/server/creator-sme-review';
import { EMPTY_SME_CHECKLIST } from '@/lib/sme-review';
import { db, closeDb } from '@/server/db/client';
import { profiles, enrollments, stepProgress, publishedAuthoredCourses } from '@/server/db/schema';

const user=await getSessionUser(),database=await db();
const learnerState=async()=>({profiles:await database.select().from(profiles),enrollments:await database.select().from(enrollments),progress:await database.select().from(stepProgress),published:await database.select().from(publishedAuthoredCourses)});
const before=await learnerState();
const brief:CourseBriefData={...EMPTY_BRIEF,title:'SME activity authoring fixture',subject:'Source checking',audience:'Beginners',outcomes:'Review a draft.',dependencies:'Read the notes before review.',objectives:[{text:'Identify a supported claim.',bloom:'Understand'}],sourceLibrary:{version:1,modules:[{id:'M1',title:'Read notes',topics:[{id:'T1',title:'Supported claims'}]}],sources:[
 {id:'S1',revision:1,title:'Approved notes',scope:'topic',moduleId:'M1',topicId:'T1',objectiveIds:['O1'],text:'Read the supplied note. Mark unstated facts as unknown. A fluent claim still needs evidence.',reference:'Synthetic fixture'},
 {id:'SE',revision:1,purpose:'worked-example',title:'A missing deadline',scope:'module',moduleId:'M1',topicId:'',objectiveIds:['O1'],text:'A draft invents a deadline.',reference:'SME example',workedExample:{reasoning:['Read the supplied note.','Look for an explicit date.'],result:'The deadline is unknown.'}},
 {id:'SG',revision:1,purpose:'guided-practice',title:'Your source review',scope:'module',moduleId:'M1',topicId:'',objectiveIds:['O1'],text:'Explain what the note supports.',reference:'SME practice',practiceSteps:[{id:'GP1',instruction:'Identify the missing fact.',hint:'Check for an explicit date.',evidence:'Name the unknown deadline.'}]},
 {id:'SQ',revision:1,purpose:'module-quiz',title:'SME module check',scope:'module',moduleId:'M1',topicId:'',objectiveIds:['O1'],text:'Choose the source-supported answer. For select-all choose every correct option.',reference:'SME questions',quizQuestions:[
  {id:'Q1',prompt:'What do you check?',selectionType:'single',choices:['The supplied evidence','The polished wording','The newest guess'],correctIndices:[0],hint:'Use the note.',explanation:'Evidence supports claims.',objectiveIds:['O1']},
  {id:'Q2',prompt:'Which actions use evidence?',selectionType:'multiple',choices:['Read the original note','Mark missing facts unknown','Invent an approval date'],correctIndices:[0,1],hint:'Distinguish facts and gaps.',explanation:'Reading and marking unknowns use the source; inventing a date does not.',objectiveIds:['O1']},
 ]},
]}};
assert(SourceLibrary.safeParse(brief.sourceLibrary).success);assert.deepEqual(sourceCoverage(brief),[]);
const incomplete=structuredClone(brief);incomplete.sourceLibrary!.sources[3].quizQuestions![0].prompt='';incomplete.sourceLibrary!.sources[3].quizQuestions![0].correctIndices=[];
assert(SourceLibrary.safeParse(incomplete.sourceLibrary).success,'Incomplete quiz drafts are saveable.');assert(sourceCoverage(incomplete).some(s=>s.includes('Q1')));
const invalidAnswers=structuredClone(brief);invalidAnswers.sourceLibrary!.sources[3].quizQuestions![1].correctIndices=[0,1,2];assert(sourceCoverage(invalidAnswers).some(s=>s.includes('distractor')));
const noConcept=structuredClone(brief);noConcept.sourceLibrary!.sources=noConcept.sourceLibrary!.sources.filter(s=>s.purpose);assert(sourceCoverage(noConcept).some(s=>s.includes('no source evidence mapped')),'Activity answers cannot substitute for concept teaching.');
assert(moduleSourceIssues({midpointQuiz:{questions:[{sourceIds:['SQ']}]}},'M1',brief.sourceLibrary!.sources).length);
const input=moduleAuthoringInput(brief,'M1');assert(!input.sources.some(s=>s.id==='SQ'));assert.equal(input.creatorActivities.moduleQuiz!.questions[1].selectionType,'multiple');
const fragments=smeModuleActivities(brief,'M1'),links={objectiveIds:['O1'],sourceIds:['S1']};
const q={id:'MID1',prompt:'What supports a claim?',choices:['The source note','The confident wording'],correct:0,hint:'Use evidence.',explanation:'Read the source.',...links};
const unit=AuthoredCoursePackage.shape.modules.element.parse({id:'M1',title:'Read notes',durationMinutes:10,...links,problemHook:{title:'A claim',situation:'A draft adds a date.',question:'What is supported?',...links},conceptExplainer:{videos:[{id:'V1',title:'Supported claims',plannedMinutes:1,slides:[{id:'SL1',title:'Use evidence',body:['Read the supplied note.'],narration:brief.sourceLibrary!.sources[0].text,...links}],midpointQuiz:{afterSlideId:'SL1',questions:[q,{...q,id:'MID2'}]}}]},...fragments,scenarioLab:{title:'New case',scenarios:[{id:'LAB1',title:'A missing owner',situation:'The note names no owner.',challenge:'Explain the gap.',expectedEvidence:'Unknown owner.',...links}]},moduleQuiz:{...fragments.moduleQuiz,passPercent:80}});
assert.deepEqual(smeActivityIssues(unit,brief),[],'Validation is independent of JSON object key order.');
const implicitSingle=structuredClone(unit);delete implicitSingle.moduleQuiz!.questions[0].selectionType;
assert.deepEqual(smeActivityIssues(implicitSingle,brief),[],'Optional single-answer labels remain backward compatible.');
const changed=structuredClone(unit);changed.moduleQuiz!.questions[1].choices.reverse();assert(smeActivityIssues(changed,brief).length,'Option order and keys cannot silently change.');
const changedKey=structuredClone(unit);const multiple=changedKey.moduleQuiz!.questions[1];assert(multiple.selectionType==='multiple');multiple.correctIndices=[0,2];assert(smeActivityIssues(changedKey,brief).length);
const changedSource=structuredClone(brief.sourceLibrary!);changedSource.sources[3].quizQuestions![0].correctIndices=[1];const revised=reviseSourceLibrary(changedSource,brief.sourceLibrary);assert.equal(revised.sources[3].revision,2);assert.equal(revised.sources[0].revision,1);
const draft=await createCreatorDraft(user.id,{brief});assert.deepEqual((await getCreatorDraft(user.id,draft.id)).brief.sourceLibrary,brief.sourceLibrary);
const context=await getCodexCourseContext(user.id,draft.id);assert.equal(context.creatorActivities![0].moduleQuiz!.questions[1].selectionType,'multiple');
const run=await startBlueprint(user.id,draft.id,1);await processBlueprint(run.run.id,run.token!,async()=>({choices:[{message:{content:JSON.stringify(blueprintShape(blueprintInput(brief,'codex-ild-v2')))}}]}));
await saveSmeReview(user,draft.id,run.run.id,{moduleId:'M1',expectedVersion:0,verdict:'approved',checklist:Object.fromEntries(Object.keys(EMPTY_SME_CHECKLIST).map(k=>[k,true])) as typeof EMPTY_SME_CHECKLIST,feedback:'Synthetic fixture review.',priority:'Optional'});
const pkg:AuthoredCoursePackageData={schemaVersion:1,title:brief.title,subject:brief.subject,briefRevision:1,durationMinutes:15,blueprintRunId:run.run.id,sources:brief.sourceLibrary!.sources.map(s=>({id:s.id,kind:'sme',title:s.title,reference:s.reference})),objectiveEvidence:[{objectiveId:'O1',objective:brief.objectives[0].text,sourceIds:['S1']}],modules:[unit],courseEnd:{miniProject:{title:'Explore a supplied case',brief:'Explain its evidence.',deliverable:'Explanation.',rubric:['Uses source notes.'],...links},masteryGate:{title:'Final',instructions:'Select one.',passPercent:80,questions:[{...q,id:'FINAL1'}]},reflection:{prompts:['What will you check?']}}};
await saveAuthoredCourse(user.id,draft.id,{expectedBriefRevision:1,expectedVersion:0,content:pkg});
await assert.rejects(saveAuthoredCourse(user.id,draft.id,{expectedBriefRevision:1,expectedVersion:1,content:{...pkg,modules:[changed]}}),{code:'sme_activity_changed'});
await updateCreatorDraft(user.id,draft.id,{revision:1,brief:incomplete});assert.equal((await getCreatorDraft(user.id,draft.id)).brief.sourceLibrary!.sources[3].quizQuestions![0].prompt,'');
await assert.rejects(updateCreatorDraft(user.id,draft.id,{revision:1,brief}),{status:409});assert.deepEqual(await learnerState(),before);
const optional=structuredClone(brief);optional.sourceLibrary!.modules[0].scenarioLabEnabled=false;
const updated=await updateCreatorDraft(user.id,draft.id,{revision:2,brief:optional});
const optionalRun=await startBlueprint(user.id,draft.id,updated.revision);await processBlueprint(optionalRun.run.id,optionalRun.token!,async()=>({choices:[{message:{content:JSON.stringify(blueprintShape(blueprintInput(optional,'codex-ild-v2')))}}]}));
await saveSmeReview(user,draft.id,optionalRun.run.id,{moduleId:'M1',expectedVersion:0,verdict:'approved',checklist:Object.fromEntries(Object.keys(EMPTY_SME_CHECKLIST).map(k=>[k,true])) as typeof EMPTY_SME_CHECKLIST,feedback:'Optional lab fixture.',priority:'Optional'});
const noLabPackage=structuredClone(pkg);noLabPackage.briefRevision=updated.revision;noLabPackage.blueprintRunId=optionalRun.run.id;delete noLabPackage.modules[0].scenarioLab;
await saveAuthoredCourse(user.id,draft.id,{expectedBriefRevision:updated.revision,expectedVersion:1,content:noLabPackage});
await assert.rejects(saveAuthoredCourse(user.id,draft.id,{expectedBriefRevision:updated.revision,expectedVersion:2,content:{...noLabPackage,modules:[unit]}}),{code:'sme_activity_changed'});
assert.deepEqual(await learnerState(),before);
await closeDb();console.log('PASS SME activities: draft persistence, scoped fragments, single/select-all keys, revision checks, concept-evidence separation, full-package preservation and unchanged learners/publications.');
