import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { body, handle, ok } from '@/server/http';
import { readScorm } from '@/server/scorm-builder';
import { connectedState, connectScorm, previewConnected, SourceSelection, startConnectedImport, advanceConnectedImport, checkConnectedUpdates } from '@/server/connected-scorm';
import { prepareConnectedStep, applyConnectedBrief, assembleConnectedDraft, proposeConnectedCourse, resolveConnectedConflicts } from '@/server/scorm-preparation';
const Input = z.discriminatedUnion('action', [
 z.object({action:z.literal('connect'),sourceCourseId:z.string().min(1),targetCourseId:z.uuid()}),
 z.object({action:z.literal('preview'),sourceCourseId:z.string().min(1),selections:z.array(SourceSelection).min(1).max(200)}),
 z.object({action:z.literal('import'),connectionId:z.uuid(),selections:z.array(SourceSelection).min(1).max(200),expectedFingerprint:z.string().length(64)}),
 z.object({action:z.enum(['advance','propose','prepare','assemble']),runId:z.uuid()}),
 z.object({action:z.literal('applyBrief'),runId:z.uuid(),expectedBriefRevision:z.number().int().positive(),objectives:z.array(z.object({original:z.string(),text:z.string().min(1).max(1000),bloom:z.enum(['Remember','Understand','Apply','Analyze','Evaluate','Create'])})).min(1).max(60),acceptObjectiveChanges:z.literal(true)}),
 z.object({action:z.literal('resolve'),runId:z.uuid(),expectedBriefRevision:z.number().int().positive(),decisions:z.record(z.string().max(1000),z.enum(['local','incoming']))}),
 z.object({action:z.literal('updates'),connectionId:z.uuid()}),
]);
export const GET=handle(async(req:Request)=>{
 const user=await getSessionUser();const query=new URL(req.url).searchParams;
 if(query.get('topicId'))return ok({releases:await readScorm('list_releases',{topicId:query.get('topicId')})});
 return ok(await connectedState(user.id));
});
export const POST=handle(async(req:Request)=>{
 const user=await getSessionUser();const input=await body(req,Input);
 switch(input.action){
 case 'connect':return ok({connection:await connectScorm(user.id,input.sourceCourseId,input.targetCourseId)});
 case 'preview':return ok({preview:await previewConnected(input.sourceCourseId,input.selections)});
 case 'import':return ok({run:await startConnectedImport(user.id,input.connectionId,input.selections,input.expectedFingerprint)});
 case 'advance':return ok({run:await advanceConnectedImport(user.id,input.runId)});
 case 'propose':return ok({run:await proposeConnectedCourse(user.id,input.runId)});
 case 'prepare':return ok({run:await prepareConnectedStep(user.id,input.runId)});
 case 'applyBrief':return ok(await applyConnectedBrief(user.id,input.runId,input.expectedBriefRevision,input.objectives));
 case 'assemble':return ok(await assembleConnectedDraft(user.id,input.runId));
 case 'resolve':return ok(await resolveConnectedConflicts(user.id,input.runId,input.expectedBriefRevision,input.decisions));
 case 'updates':return ok(await checkConnectedUpdates(user.id,input.connectionId));
 }
});
