import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import type { ConceptVideo } from '@/data/types';
import type { ConceptScene } from '@/lib/personalized-concept';
import { automationFrames, framesForRecording, matchTopicFrames, type TopicFrame, type SelectedVisual } from '@/lib/topic-visual-assets';
import { mediaRoot } from '@/server/connected-scorm';
import { uploadedRecordingFile, videoAsset } from '@/server/concept-videos';
import { courseVideoPresentation } from '@/server/course-video-presentation';
import { appRoot } from '@/server/db/client';
import { releasedTopicFrames } from '@/server/released-visual';

const extract = promisify(execFile);
const pending = new Map<string, Promise<Buffer>>();
async function readFrame(file:string, hash:string, frame:TopicFrame) {
  const presentation = await courseVideoPresentation(file);
  const stat = await fs.stat(presentation);
  const key = createHash('sha256').update(JSON.stringify([1, hash, path.basename(presentation), stat.size, stat.mtimeMs, frame.seconds, frame.crop])).digest('hex');
  const root = path.join(appRoot(), '.data', 'topic-frames');
  const dest = path.join(root, key + '.jpg');
  try { return await fs.readFile(dest); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    if (!ffmpeg) throw Error('Frame extractor unavailable.');
    await fs.mkdir(root, {recursive:true});
    const tmp = path.join(root, key + '.' + randomUUID() + '.jpg');
    const r = frame.crop;
    try {
      await extract(ffmpeg, ['-v','error','-ss',String(frame.seconds),'-i',presentation,'-frames:v','1','-vf',
        `crop=iw*${r.width}:ih*${r.height}:iw*${r.x}:ih*${r.y},scale=800:450:force_original_aspect_ratio=decrease,setsar=1`, '-q:v','4',tmp], {timeout:20000, windowsHide:true});
      const bytes = await fs.readFile(tmp);
      if (!bytes.length || bytes.length > 256*1024) throw Error('Unusable source frame.');
      await fs.rename(tmp,dest);
      return bytes;
    } finally { await fs.rm(tmp,{force:true}); }
  })();
  pending.set(key,task);
  try { return await task; } finally { pending.delete(key); }
}

/** video must come from the authenticated learner's pinned module. */
export async function applyTopicFrames(courseId:string, video:ConceptVideo, scenes:ConceptScene[], field:string, userId:string):Promise<ConceptScene[]> {
  const connected = video.sourceMedia?.video?.match(/^\/api\/v1\/scorm-builder\/connected\/[\da-f-]{36}\/assets\/([a-f0-9]{64})$/);
  const library = video.reusableVisuals ?? automationFrames;
  const selected = new Map<string, SelectedVisual[]>();
  try {
    const upload = video.uploadedVideo;
    let source: {identity:string; file:string; frames:TopicFrame[]} | undefined;
    if (upload || connected) {
      const hash = upload ? (await videoAsset(courseId, upload.assetId)).sha256 : connected![1];
      const frames = framesForRecording(library,hash);
      if (frames.length) source = {identity:hash, file:upload ? uploadedRecordingFile(courseId,upload.assetId) : path.join(mediaRoot(),hash), frames};
    }
    if (!source && video.remotion) {
      const revisionId = video.remotion.endpoint.split('/').at(-1);
      if (revisionId) source = await releasedTopicFrames(userId,courseId,revisionId);
    }
    if (!source) return scenes;
    for (const {sceneId,sentence,frame} of matchTopicFrames(source.frames,scenes,field)) {
      try {
        const bytes = await readFrame(source.file,source.identity,frame);
        const entry = { id:frame.id, label:frame.label, sentence, image:'data:image/jpeg;base64,' + bytes.toString('base64') };
        selected.set(sceneId,[...(selected.get(sceneId) ?? []),entry]);
      } catch { console.warn('Could not prepare topic frame',video.id,frame.id); }
    }
  } catch { console.warn('Source recording unavailable for topic frames',video.id); }
  return scenes.map(s => selected.has(s.id) ? {...s, selectedVisuals:selected.get(s.id)} : s);
}
