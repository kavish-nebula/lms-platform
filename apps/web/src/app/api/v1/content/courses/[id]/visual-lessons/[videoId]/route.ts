import { after } from 'next/server';
import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { body, handle, ok } from '@/server/http';
import { SaveVisualLesson, visualLessonState, saveVisualLesson, seedVisualLesson, generateVisualLesson, startVisualJob, runVisualJob, resumeVisualJobs } from '@/server/visual-lessons';

export const runtime='nodejs';
export const maxDuration=1800;
type Context={params:Promise<{id:string;videoId:string}>};
const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('seed'),expectedVersion:z.number().int().min(0)}).strict(),
  SaveVisualLesson.extend({action:z.literal('save')}).strict(),
  z.object({action:z.literal('generate'),expectedVersion:z.number().int().min(0),expectedBriefRevision:z.number().int().positive(),sourceIdentity:z.string().regex(/^[a-f0-9]{64}$/),instructions:z.string().trim().min(1).max(3000)}).strict(),
  z.object({action:z.enum(['audio','export']),revisionId:z.uuid(),retry:z.boolean().optional()}).strict(),
]);
export const GET=handle(async(_request:Request,{params}:Context)=>{
  const {id,videoId}=await params,user=await getSessionUser(),state=await visualLessonState(user.id,id,videoId);
  after(()=>resumeVisualJobs(user.id,id,videoId));
  return ok(state);
});
export const POST=handle(async(request:Request,{params}:Context)=>{
  const {id,videoId}=await params,user=await getSessionUser(),data=await body(request,input);
  if(data.action==='save'){const {content,expectedVersion,expectedBriefRevision,sourceIdentity}=data;await saveVisualLesson(user.id,id,videoId,{content,expectedVersion,expectedBriefRevision,sourceIdentity});}
  else if(data.action==='seed')await seedVisualLesson(user.id,id,videoId,data.expectedVersion);
  else if(data.action==='generate')await generateVisualLesson(user.id,id,videoId,data);
  else {const job=await startVisualJob(user.id,id,videoId,data.revisionId,data.action,data.retry);after(()=>runVisualJob(job.id));}
  return ok(await visualLessonState(user.id,id,videoId));
});
