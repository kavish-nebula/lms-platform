import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, lt, or, isNull } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db, appRoot } from './db/client';
import { scormConnections, scormImportRuns } from './db/schema';
import { readScorm, type ScormReader } from './scorm-builder';
import { getCreatorDraft } from './content-creator';
import { normalizeScormTopic, type ScormTopicData } from '@/lib/scorm-topic';
import { ApiError } from './http';

export const SourceSelection = z.object({ topicId: z.string().regex(/^[A-Za-z0-9_-]+$/), kind: z.enum(['draft', 'release']), version: z.string().max(80).optional() }).strict();
export type Selection = z.infer<typeof SourceSelection>;
export type Snapshot = { selection: Selection; fingerprint: string; source: ScormTopicData };
export type Media = { hash: string; url: string; mime: string; bytes: number };
function canonical(x:unknown):unknown { if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return x; }
export const digest = (x: unknown): string => createHash('sha256').update(JSON.stringify(canonical(x)) ?? 'undefined').digest('hex');
function data<T>(reply: unknown): T { return reply as T; }
export async function sourceCourse(sourceCourseId: string, reader: ScormReader = readScorm) {
  const library = data<{ courses: { id: string; name: string }[] }>(await reader('list_courses', {}));
  const course = library.courses.find(c => c.id === sourceCourseId);
  if (!course) throw new ApiError(404, 'source_not_found', 'Choose a course available to this SCORM Builder connection.');
  const structure = data<{ modules: { num: number; topics: { topicId: string; title: string }[] }[] }>(await reader('get_course_structure', { courseName: course.name }));
  return { course, topics: structure.modules.flatMap(m => m.topics) };
}
export async function previewConnected(sourceCourseId: string, selections: Selection[], reader: ScormReader = readScorm) {
  const { course, topics } = await sourceCourse(sourceCourseId, reader);
  if (!selections.length || new Set(selections.map(s => s.topicId)).size !== selections.length || selections.some(s => !topics.some(t => t.topicId === s.topicId))) throw new ApiError(400, 'invalid_selection', 'Select distinct topics from this source course.');
  const snapshots: Snapshot[] = [];
  for (const selection of selections) {
    if (selection.kind === 'release' && !selection.version) throw new ApiError(400, 'release_required', 'Choose an exact source release.');
    const result = data<Record<string, unknown>>(await reader(selection.kind === 'release' ? 'get_release' : 'get_topic', selection.kind === 'release' ? { topicId: selection.topicId, version: selection.version } : { topicId: selection.topicId }));
    const wrapper = (result.release ?? result.topic ?? result) as Record<string, unknown>;
    const raw = (wrapper.topic ?? wrapper.contentDocument ?? wrapper.document ?? wrapper.data ?? ((wrapper.content as Record<string,unknown>)?.concepts ? wrapper.content : wrapper)) as Record<string, unknown>;
    const document = selection.kind === 'release' ? { ...raw, has_draft: false, draft: undefined } : raw;
    let source: ScormTopicData;
    try { source = normalizeScormTopic({ ...document, ...(selection.kind==='release'?{version:Number(selection.version)||0}:{}), topicId: document.topicId ?? selection.topicId }, course.name); }
    catch { throw new ApiError(422, 'invalid_source', `Review objectives, teaching and answer keys for ${selection.topicId} in Builder.`); }
    if (source.courseId !== sourceCourseId) throw new ApiError(409, 'source_identity', 'The topic does not belong to the selected upstream course document.');
    snapshots.push({ selection, source, fingerprint: digest({ selection, source }) });
  }
  snapshots.sort((a,b) => topics.findIndex(t=>t.topicId===a.source.topicId)-topics.findIndex(t=>t.topicId===b.source.topicId));
  const subs = snapshots.flatMap(s => s.source.concepts.flatMap(c => c.sub_concepts));
  return { sourceCourseId, courseName: course.name, availableTopicIds:topics.map(t=>t.topicId), snapshots, fingerprint: digest(snapshots), coverage: { topics: snapshots.length, subtopics: subs.length, objectives: snapshots.reduce((n,s)=>n+s.source.objectives.length,0), videos: subs.filter(s=>s.video?.src).length, narrated: subs.filter(s=>s.audio.some(a=>a.transcript.trim())).length, tasks: snapshots.reduce((n,s)=>n+s.source.tasks.length,0) }, warnings: [...snapshots.filter(s=>s.selection.kind==='draft').map(s=>`${s.source.topicId}: draft snapshot; LMS review required`),...snapshots.flatMap(s=>s.source.concepts.flatMap(c=>c.sub_concepts.filter(sub=>sub.video?.type==='embed').map(sub=>`${s.source.topicId}/${sub.id}: embedded video retained as a source reference; it cannot be cached as a local recording.`)))] };
}
export async function connectScorm(ownerId: string, sourceCourseId: string, targetCourseId: string, reader: ScormReader = readScorm) {
  await getCreatorDraft(ownerId, targetCourseId); const { course, topics } = await sourceCourse(sourceCourseId, reader); const d = await db();
  const mapping = Object.fromEntries(topics.map((t,i)=>[t.topicId, `M${i+1}`]));
  await d.insert(scormConnections).values({ ownerId, sourceCourseId, sourceCourseName: course.name, targetCourseId, mapping }).onConflictDoNothing();
  return (await d.select().from(scormConnections).where(and(eq(scormConnections.ownerId,ownerId),eq(scormConnections.sourceCourseId,sourceCourseId),eq(scormConnections.targetCourseId,targetCourseId))))[0];
}
export async function ownedConnection(ownerId: string, connectionId: string) {
  const [row] = await (await db()).select().from(scormConnections).where(and(eq(scormConnections.id,connectionId),eq(scormConnections.ownerId,ownerId)));
  if (!row) throw new ApiError(404,'not_found','Connection not found.'); return row;
}
export async function connectedState(ownerId: string) {
  const d = await db(); return { connections: await d.select().from(scormConnections).where(eq(scormConnections.ownerId,ownerId)), runs: await d.select().from(scormImportRuns).where(eq(scormImportRuns.ownerId,ownerId)).orderBy(desc(scormImportRuns.updatedAt)) };
}
export async function startConnectedImport(ownerId: string, connectionId: string, selections: Selection[], expectedFingerprint: string, reader: ScormReader = readScorm) {
  const connection = await ownedConnection(ownerId,connectionId); const preview = await previewConnected(connection.sourceCourseId,selections,reader);
  if (preview.fingerprint !== expectedFingerprint) throw new ApiError(409,'source_changed','Source changed. Preview the selected revisions again.');
  const d = await db();
  const mapping={...connection.mapping};let index=Math.max(0,...Object.values(mapping).map(x=>Number(x.slice(1))||0));
  for(const snapshot of preview.snapshots)if(!mapping[snapshot.source.topicId])mapping[snapshot.source.topicId]=`M${++index}`;
  await d.update(scormConnections).set({mapping}).where(eq(scormConnections.id,connectionId));
  await d.insert(scormImportRuns).values({ ownerId,connectionId,fingerprint:preview.fingerprint,input:{ snapshots:preview.snapshots, fullCourse:preview.snapshots.length===preview.availableTopicIds.length },output:{ topics:{}, coverage:preview.coverage } }).onConflictDoNothing();
  return (await d.select().from(scormImportRuns).where(and(eq(scormImportRuns.connectionId,connectionId),eq(scormImportRuns.fingerprint,preview.fingerprint))))[0];
}
export const mediaRoot = () => path.join(appRoot(),'.data','connected-scorm-media');
export function mediaUrl(raw: string, topicId: string, folder: string, storagePath?: string) {
  if (!raw && !storagePath) return undefined;
  const value = storagePath || raw;
  const url = new URL(/^https:\/\//.test(value) ? value : `https://scorm-builder-gcs.b-cdn.net/${value.includes('/') ? value.replace(/^\//,'') : `topics/default/${topicId}/${folder}/${value}`}`);
  if (url.protocol!=='https:' || url.hostname!=='scorm-builder-gcs.b-cdn.net' || url.username || url.password || url.port || /(?:^|\/)\.\.(?:\/|$)/.test(value)) throw new ApiError(422,'media_reference','Unsupported source asset location.');
  return url.href;
}
export function sourceMedia(source: ScormTopicData) {
  const urls = new Set<string>();
  for (const sub of source.concepts.flatMap(c=>c.sub_concepts)) {
    if (sub.image) urls.add(mediaUrl(sub.image,source.topicId,'images')!);
    if (sub.video?.src && sub.video.type==='local') urls.add(mediaUrl(sub.video.src,source.topicId,'videos')!);
    for (const audio of sub.audio) urls.add(mediaUrl(audio.file || audio.filename || '',source.topicId,'audio',audio.storagePath)!);
  }
  // Preserve additional task media as well as concept media.
  for (const task of source.tasks) for (const step of task.steps) {
    const visit = (x: unknown) => { if (typeof x==='string' && (/^https:\/\/scorm-builder-gcs\.b-cdn\.net\//.test(x)||/^[^\s<>]+\.(?:png|jpe?g|webp|gif|avif|wav|mp3|mp4|webm)$/i.test(x))) urls.add(mediaUrl(x,source.topicId,'images')!); else if(Array.isArray(x))x.forEach(visit); else if(x&&typeof x==='object')Object.values(x).forEach(visit); };
    visit(step.images); visit(step.video);
  }
  return [...urls].filter(Boolean);
}
export async function cacheSourceAsset(url: string, transport: typeof fetch = fetch): Promise<Media> {
  mediaUrl(url,'',''); const ref = digest(url); const root = mediaRoot(); await fs.mkdir(root,{recursive:true});
  try { const item: Media = JSON.parse(await fs.readFile(path.join(root,`${ref}.json`),'utf8')); const b=await fs.readFile(path.join(root,item.hash)); if(createHash('sha256').update(b).digest('hex')===item.hash) return item; } catch { /* Retry an absent/incomplete cache entry. */ }
  const response = await transport(url,{redirect:'error',signal:AbortSignal.timeout(180000)});
  if(!response.ok || !response.body) throw new ApiError(422,'missing_asset','A required source asset could not be downloaded.');
  const mime=(response.headers.get('content-type')??'').split(';')[0];
  if(!/^(audio\/|video\/|image\/(png|jpeg|webp|gif|avif))/.test(mime)) throw new ApiError(422,'unsupported_asset','Only supported audio, video and raster images can be cached.');
  const limit=250*1024*1024; const chunks: Uint8Array[]=[];let bytes=0;
  for await(const chunk of response.body as unknown as AsyncIterable<Uint8Array>){bytes+=chunk.length;if(bytes>limit)throw new ApiError(422,'asset_too_large','Source asset exceeds 250 MB.');chunks.push(chunk);}
  if(!bytes || (response.headers.has('content-length')&&Number(response.headers.get('content-length'))!==bytes))throw new ApiError(422,'incomplete_asset','Source asset download was incomplete.');
  const buffer=Buffer.concat(chunks);
  const ascii=(start:number,end:number)=>buffer.toString('ascii',start,end);
  const supported=mime.startsWith('audio/') ? (ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE'||ascii(0,3)==='ID3'||ascii(0,4)==='OggS'||buffer[0]===255) : mime.startsWith('video/') ? (ascii(4,8)==='ftyp'||buffer.subarray(0,4).equals(Buffer.from([26,69,223,163]))) : (buffer.subarray(0,4).equals(Buffer.from([137,80,78,71]))||buffer[0]===255&&buffer[1]===216||ascii(0,4)==='GIF8'||ascii(8,12)==='WEBP'||ascii(4,8)==='ftyp');
  if(!supported)throw new ApiError(422,'invalid_media','The downloaded bytes do not match a supported media container.');
  const hash=createHash('sha256').update(buffer).digest('hex');const temp=path.join(root,`${hash}.${randomUUID()}.part`);await fs.writeFile(temp,buffer);await fs.rename(temp,path.join(root,hash));
  const item={hash,url,mime,bytes};await fs.writeFile(path.join(root,`${ref}.json`),JSON.stringify(item));return item;
}
export async function ownedRun(ownerId: string, runId: string) {
  const [row]=await(await db()).select().from(scormImportRuns).where(and(eq(scormImportRuns.id,runId),eq(scormImportRuns.ownerId,ownerId)));if(!row)throw new ApiError(404,'not_found','Import run not found.');return row;
}
export async function advanceConnectedImport(ownerId: string, runId: string, transport: typeof fetch = fetch) {
  const row=await ownedRun(ownerId,runId);if(row.status==='imported'||row.status==='prepared'||row.status==='applied')return row;if(!['queued','importing','failed'].includes(row.status))throw new ApiError(409,'import_complete','Source import already finished. Resume the preparation stage instead.');
  const d=await db();const lease=randomUUID();const [claimed]=await d.update(scormImportRuns).set({status:'importing',lease,leaseUntil:new Date(Date.now()+10*60000),error:null}).where(and(eq(scormImportRuns.id,runId),or(isNull(scormImportRuns.leaseUntil),lt(scormImportRuns.leaseUntil,new Date())))).returning();
  if(!claimed)throw new ApiError(409,'import_busy','Another request is processing this import.');
  try{
    const snapshots=row.input.snapshots as Snapshot[];const topics=(row.output.topics??{}) as Record<string,{snapshot:Snapshot;media:Media[]}>;
    const next=snapshots.find(s=>!topics[s.source.topicId]);
    if(next){const assets:Media[]=[];for(const url of sourceMedia(next.source))assets.push(await cacheSourceAsset(url,transport));topics[next.source.topicId]={snapshot:next,media:assets};}
    const complete=snapshots.every(s=>topics[s.source.topicId]);
    const [saved]=await d.update(scormImportRuns).set({status:complete?'imported':'importing',output:{...row.output,topics},lease:null,leaseUntil:null,updatedAt:new Date()}).where(and(eq(scormImportRuns.id,runId),eq(scormImportRuns.lease,lease))).returning();if(!saved)throw new ApiError(409,'import_lease_changed','This import step lost its lease. Reload the saved run.');return saved;
  }catch(error){await d.update(scormImportRuns).set({status:'failed',error:error instanceof ApiError?error.message:'Import failed; completed topics were retained. Retry to resume.',lease:null,leaseUntil:null,updatedAt:new Date()}).where(and(eq(scormImportRuns.id,runId),eq(scormImportRuns.lease,lease)));throw error;}
}
/** Three-way merge: source changes never silently overwrite creator edits. */
export function reconcileSource(base: unknown, local: unknown, incoming: unknown, at='$', resolutions:Record<string,'local'|'incoming'>={}): {value:unknown;conflicts:string[]} {
  if(resolutions[at])return{value:resolutions[at]==='local'?local:incoming,conflicts:[]};
  if(digest(local)===digest(base))return{value:incoming,conflicts:[]};if(digest(incoming)===digest(base)||digest(local)===digest(incoming))return{value:local,conflicts:[]};
  if([base,local,incoming].every(Array.isArray)&&[...(base as unknown[]),...(local as unknown[]),...(incoming as unknown[])].every(x=>x&&typeof x==='object'&&typeof(x as {id?:unknown}).id==='string')){
    const values=[base,local,incoming].map(a=>new Map((a as {id:string}[]).map(x=>[x.id,x])));const result:unknown[]=[];const conflicts:string[]=[];
    for(const id of new Set([...(incoming as {id:string}[]).map(x=>x.id),...(local as {id:string}[]).map(x=>x.id)])){const r=reconcileSource(values[0].get(id),values[1].get(id),values[2].get(id),`${at}.${id}`,resolutions);if(r.value!==undefined)result.push(r.value);conflicts.push(...r.conflicts);}return{value:result,conflicts};
  }
  if([base,local,incoming].every(Array.isArray)&&(base as unknown[]).length===(local as unknown[]).length&&(base as unknown[]).length===(incoming as unknown[]).length){
    const values:unknown[]=[];const conflicts:string[]=[];for(let i=0;i<(base as unknown[]).length;i++){const merged=reconcileSource((base as unknown[])[i],(local as unknown[])[i],(incoming as unknown[])[i],`${at}.${i}`,resolutions);values.push(merged.value);conflicts.push(...merged.conflicts);}return{value:values,conflicts};
  }
  if(base&&local&&incoming&&![base,local,incoming].some(Array.isArray)&&[base,local,incoming].every(x=>typeof x==='object')){
    const value:Record<string,unknown>={};const conflicts:string[]=[];for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(incoming)])){const merged=reconcileSource((base as Record<string,unknown>)[key],(local as Record<string,unknown>)[key],(incoming as Record<string,unknown>)[key],`${at}.${key}`,resolutions);if(merged.value!==undefined)value[key]=merged.value;conflicts.push(...merged.conflicts);}return{value,conflicts};
  }return{value:local,conflicts:[at]};
}
export async function checkConnectedUpdates(ownerId: string, connectionId: string, reader:ScormReader=readScorm) {
  const connection=await ownedConnection(ownerId,connectionId);const {topics}=await sourceCourse(connection.sourceCourseId,reader);const baseline=(connection.baseline.snapshots??connection.baseline) as Record<string,Snapshot>;
  const preview=await previewConnected(connection.sourceCourseId,topics.map(t=>({topicId:t.topicId,kind:baseline[t.topicId]?.selection.kind??'draft',...(baseline[t.topicId]?.selection.kind==='release'?{version:baseline[t.topicId].selection.version}:{})})),reader);
  return{preview,changes:preview.snapshots.map(s=>({topicId:s.source.topicId,kind:!baseline[s.source.topicId]?'added':baseline[s.source.topicId].fingerprint===s.fingerprint?'unchanged':'changed',teachingChanged:digest(baseline[s.source.topicId]?.source.concepts)!==digest(s.source.concepts),assessmentChanged:digest([baseline[s.source.topicId]?.source.quiz,baseline[s.source.topicId]?.source.concepts.map(c=>c.quiz)])!==digest([s.source.quiz,s.source.concepts.map(c=>c.quiz)])})),removed:Object.keys(baseline).filter(id=>!topics.some(t=>t.topicId===id))};
}
