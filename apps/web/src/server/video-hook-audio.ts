import { getSessionUser } from './auth';
import 'server-only';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPublishedAuthoredCourse } from './authored-publication';
import { findEnrollment } from './repo';
import { appRoot } from './db/client';
import { defaultVoicer } from './adapt/tts';
import type { Voicer } from './adapt/tts';
import { hookScenes } from '@/lib/video-first-hook';
import { ApiError } from './http';
import { wavSeconds } from './production-audio';

const pending = new Map<string, Promise<void>>();
async function source(userId: string, courseId: string, moduleId: string) {
  const release = await getPublishedAuthoredCourse(courseId, (await getSessionUser()).id);
  const courseModule = release?.content.modules.find(m => m.id === moduleId);
  if (!release || !courseModule || !courseModule.conceptExplainer.videos.some(v => v.uploadedVideo) || (release.ownerId !== userId && !(await findEnrollment(userId, courseId)))) throw new ApiError(404, 'not_found', 'Published hook not found.');
  const scenes = hookScenes(courseModule.problemHook);
  const key = createHash('sha256').update(JSON.stringify({ revision: release.revisionId, moduleId, scenes, provider: process.env.AUDIO_PROVIDER, model: process.env.AUDIO_MODEL, voice: process.env.AUDIO_VOICE, style: process.env.AUDIO_STYLE, kokoroVoice: process.env.KOKORO_VOICE })).digest('hex');
  const dir = path.join(appRoot(), '.data', 'video-hook-audio');
  const clips = scenes.map((scene, i) => ({ key: `${key}-scene${i}`, text: scene.text }));
  return { clips, key, dir, file: (index: number) => path.join(dir, `${clips[index].key}.wav`) };
}

/** Original-course preview speech is cached separately from learner rewrites. */
export async function prepareVideoHookAudio(userId: string, courseId: string, moduleId: string, voice: Voicer | null = defaultVoicer()) {
  const s = await source(userId, courseId, moduleId);
  // Generated runtime media is not a build input to include in server bundles.
  const valid = async () => { for (let i = 0; i < s.clips.length; i++) wavSeconds(await fs.readFile(/* turbopackIgnore: true */ s.file(i))); };
  try { await valid(); return; } catch { /* Render missing or incomplete original speech. */ }
  if (!voice) throw new ApiError(503, 'voice_unavailable', 'Narration is unavailable. You can read the scenes instead.');
  let work = pending.get(s.key);
  if (!work) {
    work = (async () => {
      const missing = [];
      for (let i = 0; i < s.clips.length; i++) {
        try { wavSeconds(await fs.readFile(/* turbopackIgnore: true */ s.file(i))); }
        catch { missing.push(s.clips[i]); }
      }
      const done = await voice(s.dir, missing);
      if (missing.some(clip => !done.has(clip.key))) throw new ApiError(503, 'voice_unavailable', 'Narration did not finish. Retry or read the scenes.');
      try { await valid(); }
      catch { throw new ApiError(503, 'voice_unavailable', 'Narration did not finish. Retry or read the scenes.'); }
    })();
    pending.set(s.key, work);
    void work.finally(() => pending.delete(s.key)).catch(() => {});
  }
  await work;
}

export async function videoHookAudio(userId: string, courseId: string, moduleId: string, index = 0) {
  const s = await source(userId, courseId, moduleId);
  if (!Number.isInteger(index) || index < 0 || index >= s.clips.length) throw new ApiError(404, 'not_found', 'Hook scene not found.');
  try { return await fs.readFile(/* turbopackIgnore: true */ s.file(index)); }
  catch { throw new ApiError(404, 'audio_not_found', 'Prepare the hook narration before playing.'); }
}
