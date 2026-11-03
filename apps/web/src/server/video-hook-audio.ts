import 'server-only';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPublishedAuthoredCourse } from './authored-publication';
import { findEnrollment } from './repo';
import { appRoot } from './db/client';
import { defaultVoicer } from './adapt/tts';
import type { Voicer } from './adapt/tts';
import { hookNarration } from '@/lib/video-first-hook';
import { ApiError } from './http';
import { wavSeconds } from './production-audio';

const pending = new Map<string, Promise<void>>();
async function source(userId: string, courseId: string, moduleId: string) {
  const release = await getPublishedAuthoredCourse(courseId);
  const courseModule = release?.content.modules.find(m => m.id === moduleId);
  if (!release || !courseModule || !courseModule.conceptExplainer.videos.some(v => v.uploadedVideo) || (release.ownerId !== userId && !(await findEnrollment(userId, courseId)))) throw new ApiError(404, 'not_found', 'Published hook not found.');
  const text = hookNarration(courseModule.problemHook);
  const key = createHash('sha256').update(JSON.stringify({ revision: release.revisionId, moduleId, text, provider: process.env.AUDIO_PROVIDER, model: process.env.AUDIO_MODEL, voice: process.env.AUDIO_VOICE, style: process.env.AUDIO_STYLE, kokoroVoice: process.env.KOKORO_VOICE })).digest('hex');
  const dir = path.join(appRoot(), '.data', 'video-hook-audio');
  return { text, key, dir, file: path.join(dir, `${key}.wav`) };
}

/** Original-course preview speech is cached separately from learner rewrites. */
export async function prepareVideoHookAudio(userId: string, courseId: string, moduleId: string, voice: Voicer | null = defaultVoicer()) {
  const s = await source(userId, courseId, moduleId);
  // Generated runtime media is not a build input to include in server bundles.
  try { wavSeconds(await fs.readFile(/* turbopackIgnore: true */ s.file)); return; } catch { /* Render missing or incomplete original speech. */ }
  if (!voice) throw new ApiError(503, 'voice_unavailable', 'Narration is unavailable. You can read the scenes instead.');
  let work = pending.get(s.key);
  if (!work) {
    work = (async () => {
      if (!(await voice(s.dir, [{ key: s.key, text: s.text }])).has(s.key)) throw new ApiError(503, 'voice_unavailable', 'Narration did not finish. Retry or read the scenes.');
      try { wavSeconds(await fs.readFile(/* turbopackIgnore: true */ s.file)); }
      catch { throw new ApiError(503, 'voice_unavailable', 'Narration did not finish. Retry or read the scenes.'); }
    })();
    pending.set(s.key, work);
    void work.finally(() => pending.delete(s.key)).catch(() => {});
  }
  await work;
}

export async function videoHookAudio(userId: string, courseId: string, moduleId: string) {
  const s = await source(userId, courseId, moduleId);
  try { return await fs.readFile(/* turbopackIgnore: true */ s.file); }
  catch { throw new ApiError(404, 'audio_not_found', 'Prepare the hook narration before playing.'); }
}
