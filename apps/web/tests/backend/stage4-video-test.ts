import {VisualLesson} from '@/lib/visual-lesson';
import assert from 'node:assert/strict';
import { EMPTY_BRIEF, type CourseBriefData } from '@/lib/content-creator';
import { blueprintShape } from '@/server/blueprint-ai';
import { createCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { startBlueprint, processBlueprint } from '@/server/creator-blueprints';
import { saveSmeReview } from '@/server/creator-sme-review';
import { EMPTY_SME_CHECKLIST } from '@/lib/sme-review';
import { getSessionUser } from '@/server/auth';
import { db, closeDb } from '@/server/db/client';
import { profiles, stepProgress, publishedAuthoredCourses, enrollments } from '@/server/db/schema';
import { stage4VisualTargets } from '@/server/stage4-visual-source';
import { visualLessonState, saveVisualLesson, startVisualJob } from '@/server/visual-lessons';
import { sourceVisualSeed } from '@/lib/visual-authoring';

const owner=await getSessionUser(),d=await db();
const before={profiles:await d.select().from(profiles),progress:await d.select().from(stepProgress),editions:await d.select().from(publishedAuthoredCourses),enrollments:await d.select().from(enrollments)};
const brief:CourseBriefData={...EMPTY_BRIEF,title:'Stage 4 source workflow',subject:'AI literacy',audience:'Beginners',outcomes:'Review a draft',dependencies:'Sources before review',objectives:[{text:'Check a draft against supplied notes.',bloom:'Apply'}],sourceLibrary:{version:1,modules:[{id:'M1',title:'Check sources',topics:[{id:'T1',title:'Source checking'}]}],sources:[
 {id:'S1',revision:1,title:'Draft checking',scope:'topic',moduleId:'M1',topicId:'T1',objectiveIds:['O1'],text:'Use supplied notes to check a draft. Mark unstated details as unknown. Keep proposals separate from agreed work. A human reviews the result.',reference:'Synthetic test'},
 {id:'H1',revision:1,title:'An invented deadline',scope:'module',purpose:'problem-hook',moduleId:'M1',topicId:'',objectiveIds:['O1'],text:'A draft adds a deadline. The notes do not give a deadline. The learner must identify the unsupported commitment. The message is not sent.',reference:'Synthetic hook'},
]}};
const draft=await createCreatorDraft(owner.id,{brief});
const started=await startBlueprint(owner.id,draft.id,1);
await processBlueprint(started.run.id,started.token!,async()=>({choices:[{message:{content:JSON.stringify(blueprintShape(started.run.input))}}]}));
await assert.rejects(stage4VisualTargets(owner.id,draft.id,'M1'),{code:'visual_approval_required'});
await saveSmeReview(owner,draft.id,started.run.id,{moduleId:'M1',expectedVersion:0,verdict:'approved',checklist:Object.fromEntries(Object.keys(EMPTY_SME_CHECKLIST).map(k=>[k,true])) as typeof EMPTY_SME_CHECKLIST,feedback:'Fixture reviewed.',priority:'Recommended'});
const targets=await stage4VisualTargets(owner.id,draft.id,'M1');
assert.deepEqual(targets.map(t=>t.videoId),['draft_M1_hook','draft_T1']);
assert.deepEqual(targets[1].sourceIds,['S1']);assert.deepEqual(targets[0].sourceIds,['H1']);
await assert.rejects(stage4VisualTargets('another-owner',draft.id,'M1'),{status:404});
const target=targets[1],state=await visualLessonState(owner.id,draft.id,target.videoId);
assert.equal(state.source.origin,'stage4');assert.equal(state.source.releaseId,null,'No publication dependency.');
const request={expectedVersion:0,expectedBriefRevision:1,sourceIdentity:target.identity,content:sourceVisualSeed(target)};
const saved=await saveVisualLesson(owner.id,draft.id,target.videoId,request);
await assert.rejects(saveVisualLesson(owner.id,draft.id,target.videoId,request),{code:'visual_conflict'});
await assert.rejects(saveVisualLesson(owner.id,draft.id,target.videoId,{...request,expectedVersion:1,content:{...saved.content,scenes:saved.content.scenes.map(s=>({...s,sourceIds:['H1']}))}}),{code:'visual_evidence'});
const animated = VisualLesson.parse({...saved.content, style:'topic-animation', scenes:saved.content.scenes.map((scene,i) =>
  i === 0 ? {...scene, motion:[{label:'Draft', keys:[{beat:0,at:0,x:120,y:80},{beat:1,at:0.9,x:450,y:200}]}]} : scene)});
const revision = await saveVisualLesson(owner.id,draft.id,target.videoId,{...request,expectedVersion:1,content:animated});
// This test only queues the job; it does not contact a model provider.
process.env.AUDIO='on';process.env.KOKORO='on';
const media = await startVisualJob(owner.id,draft.id,target.videoId,revision.id,'audio');
assert.equal(media.output.voice?.voice,'af_heart');
assert.equal(media.output.voice?.speed,0.84);
assert((await visualLessonState(owner.id,draft.id,target.videoId)).jobs.some(job=>job.id===media.id));
assert(!VisualLesson.safeParse({...animated,scenes:saved.content.scenes}).success);
await saveSmeReview(owner,draft.id,started.run.id,{moduleId:'M1',expectedVersion:1,verdict:'revision_requested',checklist:EMPTY_SME_CHECKLIST,feedback:'Revise the scoped source.',priority:'Recommended'});
await assert.rejects(startVisualJob(owner.id,draft.id,target.videoId,saved.id,'audio'),{code:'visual_approval_required'});
await updateCreatorDraft(owner.id,draft.id,{revision:1,brief:{...draft.brief,audience:'A changed audience'}});
await assert.rejects(stage4VisualTargets(owner.id,draft.id,'M1'),{code:'visual_blueprint_required'});
assert.deepEqual({profiles:await d.select().from(profiles),progress:await d.select().from(stepProgress),editions:await d.select().from(publishedAuthoredCourses),enrollments:await d.select().from(enrollments)},before);
await closeDb();console.log('PASS Stage 4 Remotion: no publication dependency, scoped hook/topic evidence, owner isolation, approval revocation, stale input, optimistic saves and unchanged learners/editions.');
