import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and,eq } from 'drizzle-orm';
import type { AuthoredCoursePackageData } from '@/lib/authored-course';
import { visualTimeline,VISUAL_FPS } from '@/lib/visual-lesson';
import type { ConceptScene } from '@/lib/personalized-concept';
import { db,appRoot } from './db/client';
import { creatorVisualJobs,creatorVisualLessons } from './db/schema';
import { getPublishedAuthoredCourse } from './authored-publication';
import { visualLessonSource,serveVisualAsset } from './visual-lessons';
import { findEnrollment } from './repo';
import { ApiError } from './http';
import { pcmWav } from './adapt/continuous-audio';
import { activityVisualSource } from '@/lib/activity-visual';

function bindings(content:AuthoredCoursePackageData){return content.modules.flatMap(m=>[
 ...(m.problemHook.remotion?[{moduleId:m.id,ref:m.problemHook.remotion,videoId:`draft_${m.id}_hook`,video:null,activity:null}]:[]),
 ...(['worked','guided'] as const).flatMap(stage=>m.stageVideos?.[stage]?[{moduleId:m.id,ref:m.stageVideos[stage]!,videoId:`draft_${m.id}_${stage}`,video:null,activity:activityVisualSource(m,stage)}]:[]),
 ...m.conceptExplainer.videos.filter(v=>v.remotion).map(v=>({moduleId:m.id,ref:v.remotion!,videoId:v.id,video:v,activity:null})),
]);}
async function rows(ownerId:string,courseId:string,binding:ReturnType<typeof bindings>[number]){
 const d=await db();
 const [revision]=await d.select().from(creatorVisualLessons).where(and(eq(creatorVisualLessons.id,binding.ref.revisionId),eq(creatorVisualLessons.courseId,courseId),eq(creatorVisualLessons.ownerId,ownerId)));
 const jobs=await d.select().from(creatorVisualJobs).where(eq(creatorVisualJobs.revisionId,binding.ref.revisionId));
 const audio=jobs.find(j=>j.id===binding.ref.audioJobId&&j.kind==='audio'&&j.status==='ready'),exported=jobs.find(j=>j.id===binding.ref.exportJobId&&j.kind==='export'&&j.status==='ready'&&j.dependencyId===audio?.id);
 if(!revision||revision.moduleId!==binding.moduleId||revision.videoId!==binding.videoId||!audio?.output.clips?.length||!exported)throw new ApiError(422,'visual_not_ready','Every released visual must reference its owned saved script, correct stage, ready matching narration and completed MP4.');
 return {revision,audio,exported};
}
export async function validateReleasedVisuals(ownerId:string,courseId:string,content:AuthoredCoursePackageData){
 for(const binding of bindings(content)){
  const {revision,audio,exported}=await rows(ownerId,courseId,binding),source=await visualLessonSource(ownerId,courseId,revision.videoId);
  if(source.identity!==revision.sourceIdentity)throw new ApiError(409,'visual_source_changed','Reconcile the changed visual source before publication.');
  if(binding.activity&&(!source.text.startsWith(binding.activity.text+'\n\n')||JSON.stringify(source.sourceIds)!==JSON.stringify(binding.activity.sourceIds)))throw new ApiError(422,'visual_activity_mismatch','The activity changed. Reconcile its video with the current worked example or guided practice before saving.');
  const beats=revision.content.scenes.flatMap(s=>s.beats);
  if(binding.video&&(binding.video.slides.length!==beats.length||binding.video.slides.some((s,i)=>s.narration!==beats[i].narration)))throw new ApiError(422,'visual_transcript_mismatch','Keep the saved visual narration and learner transcript identical.');
  if(binding.video&&binding.video.id!==revision.videoId)throw new ApiError(422,'visual_binding','The concept must keep its saved visual video ID.');
  const root=process.env.LMS_VISUAL_LESSON_DIR??path.join(appRoot(),'.data','visual-lessons');
  await fs.access(path.join(root,exported.id,'final.mp4')).catch(()=>{throw new ApiError(422,'visual_missing','A required published MP4 is missing.');});
  for(const clip of audio.output.clips!){const wav=pcmWav(await fs.readFile(path.join(root,'clips',clip.key+'.wav')));if(Math.abs(wav.seconds-clip.seconds)>.001)throw new ApiError(422,'visual_audio_mismatch','A narration clip does not match its measured timing.');}
 }
}
export async function releasedVisual(userId:string,courseId:string,revisionId:string,request?:Request){
 if(!await findEnrollment(userId,courseId))throw new ApiError(403,'not_enrolled','Enroll to play this course video.');
 const release=await getPublishedAuthoredCourse(courseId,userId),binding=release&&bindings(release.content).find(b=>b.ref.revisionId===revisionId);
 if(!release||!binding)throw new ApiError(404,'not_found','This video is not part of your course edition.');
 const {revision,audio,exported}=await rows(release.ownerId,courseId,binding);
 if(request&&new URL(request.url).searchParams.has('media'))return serveVisualAsset(release.ownerId,courseId,revision.videoId,exported.id,'lesson.mp4',request);
 const timeline=visualTimeline(revision.content,audio.output.clips),beats=timeline.scenes.flatMap(s=>s.beats),mid=binding.video?Math.ceil(beats.length/2)-1:-1;
 const endpoint=`/api/v1/courses/${courseId}/visual-lessons/${revision.id}`;
 const scenes:ConceptScene[]=beats.map((b,i)=>({id:b.id,phase:mid<0||i<=mid?'before':'after',visual:'prompt',title:b.visual?.heading??b.label,points:[b.visual?.detail??b.label],narration:b.narration,bridge:'',sourceIds:binding.video?.slides[i].sourceIds??[],objectiveIds:binding.video?.slides[i].objectiveIds??[]}));
 return {revisionId:revision.id,scenes,playback:{kind:'continuous' as const,audio:`${endpoint}?media=1`,video:`${endpoint}?media=1`,durationSeconds:timeline.durationInFrames/VISUAL_FPS,checkpointSeconds:mid>=0?(beats[mid+1]?.from??timeline.durationInFrames)/VISUAL_FPS:null,segments:beats.map((b,i)=>({sceneId:b.id,startSeconds:b.from/VISUAL_FPS,endSeconds:(beats[i+1]?.from??timeline.durationInFrames)/VISUAL_FPS})),captions:beats.map(b=>({start:b.from/VISUAL_FPS,end:(b.from+b.durationInFrames)/VISUAL_FPS,caption:b.narration}))}};
}
