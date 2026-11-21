import assert from 'node:assert/strict';
import { EMPTY_BRIEF, type CourseBriefData } from '@/lib/content-creator';
import { blueprintShape } from '@/server/blueprint-ai';
import { createCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { startBlueprint, processBlueprint } from '@/server/creator-blueprints';
import { getSmeReview, saveSmeReview } from '@/server/creator-sme-review';
import { EMPTY_SME_CHECKLIST } from '@/lib/sme-review';
import { getSessionUser } from '@/server/auth';
import { db, closeDb } from '@/server/db/client';
import { profiles, stepProgress, publishedAuthoredCourses, enrollments, creatorAuthoredCourseRevisions } from '@/server/db/schema';
import { stage4VideoPanelState, stage4VisualTargets } from '@/server/stage4-visual-source';
import { productionState } from '@/server/module-production';
import { visualLessonState, saveVisualLesson, startVisualJob, runVisualJob } from '@/server/visual-lessons';
import { sourceVisualSeed } from '@/lib/visual-authoring';
import type { AuthoredCoursePackageData } from '@/lib/authored-course';
import { authoredDelivery } from '@/lib/authored-delivery';
import { validateReleasedVisuals } from '@/server/released-visual';
import { combinePcm } from '@/server/adapt/continuous-audio';
import fs from 'node:fs/promises';

const owner=await getSessionUser(),d=await db();
const before={profiles:await d.select().from(profiles),progress:await d.select().from(stepProgress),editions:await d.select().from(publishedAuthoredCourses),enrollments:await d.select().from(enrollments)};
const brief:CourseBriefData={...EMPTY_BRIEF,title:'Stage 4 source workflow',subject:'AI literacy',audience:'Beginners',outcomes:'Review a draft',dependencies:'Sources before review',objectives:[{text:'Check a draft against supplied notes.',bloom:'Apply'}],sourceLibrary:{version:1,modules:[{id:'M1',title:'Check sources',problemHookPrompt:'Use short sentences and a visible unanswered decision.',topics:[{id:'T1',title:'Source checking'}]}],sources:[
 {id:'S1',revision:1,title:'Draft checking',scope:'topic',moduleId:'M1',topicId:'T1',objectiveIds:['O1'],text:'Use supplied notes to check a draft. Mark unstated details as unknown. Keep proposals separate from agreed work. A human reviews the result.',reference:'Synthetic test'},
 {id:'H1',revision:1,title:'An invented deadline',scope:'module',purpose:'problem-hook',moduleId:'M1',topicId:'',objectiveIds:['O1'],text:'A draft adds a deadline. The notes do not give a deadline. The learner must identify the unsupported commitment. The message is not sent.',reference:'Synthetic hook'},
]}};
const draft=await createCreatorDraft(owner.id,{brief});
const started=await startBlueprint(owner.id,draft.id,1);
await processBlueprint(started.run.id,started.token!,async()=>({choices:[{message:{content:JSON.stringify(blueprintShape(started.run.input))}}]}));
await assert.rejects(stage4VisualTargets(owner.id,draft.id,'M1'),{code:'visual_approval_required'});
assert.match((await stage4VideoPanelState(owner.id,draft.id,'M1',started.run.id)).unavailableReason!, /all seven Stage 3 checks/);
await saveSmeReview(owner,draft.id,started.run.id,{moduleId:'M1',expectedVersion:0,verdict:'approved',checklist:Object.fromEntries(Object.keys(EMPTY_SME_CHECKLIST).map(k=>[k,true])) as typeof EMPTY_SME_CHECKLIST,feedback:'Fixture reviewed.',priority:'Recommended'});
const targets=await stage4VisualTargets(owner.id,draft.id,'M1');
assert.deepEqual((await stage4VideoPanelState(owner.id,draft.id,'M1',started.run.id)).targets, targets);
assert.match((await stage4VideoPanelState(owner.id,draft.id,'M1','a-different-run')).unavailableReason!, /different blueprint/);
await assert.rejects(stage4VideoPanelState('another-owner',draft.id,'M1',started.run.id), {status:404});

// Approved courses predating the source library still open saved production.
// The optional visual panel reports setup requirements without changing approval.
const legacyBrief:CourseBriefData={...brief,title:'Legacy approved slide course',sourceLibrary:undefined,sourceText:'Use supplied notes to check a draft. Keep unstated details unknown.'};
const legacy=await createCreatorDraft(owner.id,{brief:legacyBrief});
const legacyRun=await startBlueprint(owner.id,legacy.id,1);
await processBlueprint(legacyRun.run.id,legacyRun.token!,async()=>({choices:[{message:{content:JSON.stringify(blueprintShape(legacyRun.run.input))}}]}));
await saveSmeReview(owner,legacy.id,legacyRun.run.id,{moduleId:'M1',expectedVersion:0,verdict:'approved',checklist:Object.fromEntries(Object.keys(EMPTY_SME_CHECKLIST).map(k=>[k,true])) as typeof EMPTY_SME_CHECKLIST,feedback:'Reviewed legacy teaching.',priority:'Recommended'});
const legacyReview=await getSmeReview(owner.id,legacy.id,legacyRun.run.id);
assert.equal((await productionState(owner.id,legacy.id,legacyRun.run.id,'M1')).eligible,true);
await assert.rejects(stage4VisualTargets(owner.id,legacy.id,'M1'),{code:'visual_sources_required'});
const legacyPanel=await stage4VideoPanelState(owner.id,legacy.id,'M1',legacyRun.run.id);
assert.deepEqual(legacyPanel.targets,[]);
assert.match(legacyPanel.unavailableReason!,/earlier slide-authoring workflow/);
assert.deepEqual(await getSmeReview(owner.id,legacy.id,legacyRun.run.id),legacyReview);
assert.deepEqual(targets.map(t=>t.videoId),['draft_M1_hook','draft_T1']);
assert('problemHookPrompt' in targets[0].context);assert.equal(targets[0].context.problemHookPrompt, brief.sourceLibrary!.modules[0].problemHookPrompt);assert(!('problemHookPrompt' in targets[1].context));
assert.deepEqual(targets[1].sourceIds,['S1']);assert.deepEqual(targets[0].sourceIds,['H1']);
await assert.rejects(stage4VisualTargets('another-owner',draft.id,'M1'),{status:404});
const target=targets[1],state=await visualLessonState(owner.id,draft.id,target.videoId);
assert.equal(state.source.origin,'stage4');assert.equal(state.source.releaseId,null,'No publication dependency.');
const request={expectedVersion:0,expectedBriefRevision:1,sourceIdentity:target.identity,content:sourceVisualSeed(target)};
const saved=await saveVisualLesson(owner.id,draft.id,target.videoId,request);
await assert.rejects(saveVisualLesson(owner.id,draft.id,target.videoId,request),{code:'visual_conflict'});
await assert.rejects(saveVisualLesson(owner.id,draft.id,target.videoId,{...request,expectedVersion:1,content:{...saved.content,scenes:saved.content.scenes.map(s=>({...s,sourceIds:['H1']}))}}),{code:'visual_evidence'});
const links={objectiveIds:['O1'],sourceIds:['S1']},q=(id:string)=>({id,prompt:'Check which source?',choices:['Notes','Guess'],correct:0,hint:'Read.',explanation:'Use notes.',...links});
const pkg:AuthoredCoursePackageData={schemaVersion:1,title:brief.title,subject:'AI',briefRevision:1,durationMinutes:10,objectiveEvidence:[{objectiveId:'O1',objective:brief.objectives[0].text,sourceIds:['S1']}],sources:[{id:'S1',kind:'sme',title:'Notes',reference:'Fixture'},{id:'H1',kind:'sme',title:'Hook',reference:'Fixture'}],modules:[{id:'M1',title:'Check sources',durationMinutes:8,...links,problemHook:{title:'An invented deadline',situation:brief.sourceLibrary!.sources[1].text,question:'What is missing?',...links},conceptExplainer:{videos:[{id:'T1',title:'Check',plannedMinutes:1,slides:[{id:'SL1',title:'Check',body:['Notes'],narration:brief.sourceLibrary!.sources[0].text,...links}],midpointQuiz:{afterSlideId:'SL1',questions:[q('Q1'),q('Q2')]}}]},workedExamples:[{id:'E1',title:'Review',problem:'A draft invents a date.',reasoning:['Inspect the notes.'],result:'Keep the date unknown.',...links}],guidedPractice:{title:'Your review',instructions:'Explain the missing date.',steps:[{id:'G1',instruction:'Read the notes.',hint:'Find the gap.',evidence:'Missing date.',...links}]},scenarioLab:{title:'Apply',scenarios:[{id:'L1',title:'New case',situation:'A missing owner.',challenge:'Explain.',expectedEvidence:'Unknown.',...links}]}}],courseEnd:{miniProject:{title:'Explore',brief:'Use the supplied case.',deliverable:'Explanation.',rubric:['Uses notes.'],...links},masteryGate:{title:'Final',instructions:'Select one.',passPercent:80,questions:[q('F1')]},reflection:{prompts:['What did you check?']}}};
await d.insert(creatorAuthoredCourseRevisions).values({courseId:draft.id,ownerId:owner.id,createdBy:owner.id,version:1,briefRevision:1,content:pkg});
const activities=(await stage4VisualTargets(owner.id,draft.id,'M1')).filter(t=>t.kind==='worked'||t.kind==='guided');
assert.deepEqual(activities.map(t=>t.videoId),['draft_M1_worked','draft_M1_guided']);
assert(!activities.some(t=>t.text.includes('Select one.')),'Final assessment instructions/keys never enter activity teaching.');
process.env.AUDIO='on';process.env.KOKORO='on';process.env.LMS_VISUAL_LESSON_DIR=new URL('../../.data/test-stage-visual',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
for(const source of activities){
 const revision=await saveVisualLesson(owner.id,draft.id,source.videoId,{expectedVersion:0,expectedBriefRevision:1,sourceIdentity:source.identity,content:sourceVisualSeed(source)});
 const audio=await startVisualJob(owner.id,draft.id,source.videoId,revision.id,'audio');
 await runVisualJob(audio.id,{speaker:async(dir,clips,_voice,completed)=>{await fs.mkdir(dir,{recursive:true});for(const clip of clips){await fs.writeFile(`${dir}/${clip.key}.wav`,combinePcm([Buffer.alloc(48000)]));await completed(clip.key);}}});
 const exported=await startVisualJob(owner.id,draft.id,source.videoId,revision.id,'export');await runVisualJob(exported.id,{exporter:async dir=>{await fs.writeFile(`${dir}/final.mp4`,'isolated fixture');}});
 pkg.modules[0].stageVideos={...pkg.modules[0].stageVideos,[source.kind]:{revisionId:revision.id,audioJobId:audio.id,exportJobId:exported.id}};
}
await validateReleasedVisuals(owner.id,draft.id,pkg);
const wrongStage=structuredClone(pkg);wrongStage.modules[0].stageVideos!.guided=wrongStage.modules[0].stageVideos!.worked;
await assert.rejects(validateReleasedVisuals(owner.id,draft.id,wrongStage),{code:'visual_not_ready'});
const changedActivity=structuredClone(pkg);changedActivity.modules[0].guidedPractice.steps[0].instruction='A different instruction.';
await assert.rejects(validateReleasedVisuals(owner.id,draft.id,changedActivity),{code:'visual_activity_mismatch'});
const delivered=authoredDelivery({courseId:draft.id,revisionId:'fixture',content:pkg}).modules[0];
assert(delivered.remotionStages?.guided?.endpoint.includes(pkg.modules[0].stageVideos!.guided!.revisionId));
assert.equal(delivered.blocks.find(b=>b.stage==='guided')?.stage,'guided','Interactive practice still ships alongside the video.');
assert.equal((await visualLessonState(owner.id,draft.id,'draft_M1_worked')).source.identity,activities[0].identity,'Binding media does not invalidate activity evidence.');
await saveSmeReview(owner,draft.id,started.run.id,{moduleId:'M1',expectedVersion:1,verdict:'revision_requested',checklist:EMPTY_SME_CHECKLIST,feedback:'Revise the scoped source.',priority:'Recommended'});
await assert.rejects(startVisualJob(owner.id,draft.id,target.videoId,saved.id,'audio'),{code:'visual_approval_required'});
await updateCreatorDraft(owner.id,draft.id,{revision:1,brief:{...draft.brief,audience:'A changed audience'}});
await assert.rejects(stage4VisualTargets(owner.id,draft.id,'M1'),{code:'visual_blueprint_required'});
assert.match((await stage4VideoPanelState(owner.id,draft.id,'M1',started.run.id)).unavailableReason!,/current blueprint/);
assert.deepEqual({profiles:await d.select().from(profiles),progress:await d.select().from(stepProgress),editions:await d.select().from(publishedAuthoredCourses),enrollments:await d.select().from(enrollments)},before);
await closeDb();console.log('PASS Stage 4 Remotion: no publication dependency, scoped hook/topic evidence, owner isolation, approval revocation, stale input, optimistic saves and unchanged learners/editions.');
