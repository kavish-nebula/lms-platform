import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { db, appRoot } from './db/client';
import { creatorAuthoredCourseAudio, creatorAuthoredCourseRevisions, creatorCourses } from './db/schema';
import { getCreatorDraft } from './content-creator';
import { ApiError } from './http';
import { speakProduction, type ProductionSpeaker } from './production-speech';
import { wavSeconds } from './production-audio';
import type { ProductionAudioClip, ProductionVoice } from '@/lib/production-audio';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const voice = (): ProductionVoice => ({ provider: 'kokoro', model: process.env.KOKORO_MODEL ?? 'onnx-community/Kokoro-82M-v1.0-ONNX', voice: process.env.KOKORO_VOICE ?? 'am_michael', dtype: process.env.KOKORO_DTYPE ?? 'fp32', device: process.env.KOKORO_DEVICE ?? 'cpu', version: 2 });
const root = () => path.join(appRoot(), '.data', 'authored-course-audio');
const storagePath = (key: string) => path.join(root(), key);
const leaseUntil = (ms = 35 * 60_000) => new Date(Date.now() + ms);
const configured = () => process.env.AUDIO !== 'off' && process.env.KOKORO !== 'off';
export async function authoredCourseAudioState(ownerId: string, courseId: string, revisionId?: string) {
  const draft = await getCreatorDraft(ownerId, courseId); const database = await db();
  await database.update(creatorAuthoredCourseAudio).set({ status: 'failed', error: 'Audio processing was interrupted or timed out. Retry to render missing narration.', updatedAt: new Date() }).where(and(eq(creatorAuthoredCourseAudio.courseId, courseId), eq(creatorAuthoredCourseAudio.status, 'running'), lt(creatorAuthoredCourseAudio.leaseUntil, new Date())));
  const rows = await database.select().from(creatorAuthoredCourseAudio).where(and(eq(creatorAuthoredCourseAudio.courseId, courseId), ...(revisionId ? [eq(creatorAuthoredCourseAudio.revisionId, revisionId)] : []))).orderBy(desc(creatorAuthoredCourseAudio.createdAt));
  const [head] = await database.select().from(creatorAuthoredCourseRevisions).where(eq(creatorAuthoredCourseRevisions.courseId, courseId)).orderBy(desc(creatorAuthoredCourseRevisions.version)).limit(1);
  return { configured: configured(), currentRevisionId: head?.id ?? null, jobs: rows.map(row => ({ id: row.id, revisionId: row.revisionId, status: row.status, clips: row.clips, voice: row.voice, error: row.error, attempts: row.attempts, current: row.revisionId === head?.id && head.briefRevision === draft.revision, createdAt: row.createdAt.toISOString() })) };
}

export async function startAuthoredCourseAudio(ownerId: string, courseId: string, revisionId: string) {
  if (!configured()) throw new ApiError(503, 'speech_unavailable', 'Enable local Kokoro narration to generate audio for this saved script revision.');
  const draft = await getCreatorDraft(ownerId, courseId); const database = await db(); const chosenVoice = voice(); const voiceKey = digest(chosenVoice); const token = randomUUID();
  return database.transaction(async tx => {
    const [course] = await tx.select().from(creatorCourses).where(and(eq(creatorCourses.id, courseId), eq(creatorCourses.ownerId, ownerId))).for('update');
    const [revision] = await tx.select().from(creatorAuthoredCourseRevisions).where(and(eq(creatorAuthoredCourseRevisions.id, revisionId), eq(creatorAuthoredCourseRevisions.courseId, courseId), eq(creatorAuthoredCourseRevisions.ownerId, ownerId)));
    const [head] = await tx.select().from(creatorAuthoredCourseRevisions).where(eq(creatorAuthoredCourseRevisions.courseId, courseId)).orderBy(desc(creatorAuthoredCourseRevisions.version)).limit(1);
    if (!course || !revision) throw new ApiError(404, 'not_found', 'Saved course package revision not found.');
    if (revision.id !== head?.id || revision.briefRevision !== course.revision || course.revision !== draft.revision) throw new ApiError(409, 'revision_outdated', 'Only the latest course scripts for the current SME input can generate audio.');
    const [existing] = await tx.select().from(creatorAuthoredCourseAudio).where(and(eq(creatorAuthoredCourseAudio.revisionId, revisionId), eq(creatorAuthoredCourseAudio.voiceKey, voiceKey)));
    if (existing?.status === 'ready' || existing?.status === 'running') return { id: existing.id, token: null, status: existing.status };
    if (existing) {
      const [retried] = await tx.update(creatorAuthoredCourseAudio).set({ status: 'running', token, attempts: sql`${creatorAuthoredCourseAudio.attempts} + 1`, error: null, leaseUntil: leaseUntil(), updatedAt: new Date() }).where(and(eq(creatorAuthoredCourseAudio.id, existing.id), eq(creatorAuthoredCourseAudio.status, 'failed'))).returning();
      if (retried) return { id: retried.id, token, status: retried.status };
      return { id: existing.id, token: null, status: existing.status };
    }
    const [created] = await tx.insert(creatorAuthoredCourseAudio).values({ courseId, ownerId, revisionId, voiceKey, voice: chosenVoice, token, leaseUntil: leaseUntil() }).returning();
    return { id: created.id, token, status: created.status };
  });
}

export async function processAuthoredCourseAudio(id: string, token: string, ownerId: string, courseId: string, speaker: ProductionSpeaker = speakProduction) {
  const database = await db(); const [job] = await database.select().from(creatorAuthoredCourseAudio).where(and(eq(creatorAuthoredCourseAudio.id, id), eq(creatorAuthoredCourseAudio.courseId, courseId), eq(creatorAuthoredCourseAudio.ownerId, ownerId), eq(creatorAuthoredCourseAudio.token, token), eq(creatorAuthoredCourseAudio.status, 'running')));
  if (!job) return;
  try {
    const [revision] = await database.select().from(creatorAuthoredCourseRevisions).where(and(eq(creatorAuthoredCourseRevisions.id, job.revisionId), eq(creatorAuthoredCourseRevisions.courseId, courseId), eq(creatorAuthoredCourseRevisions.ownerId, ownerId)));
    if (!revision) throw new Error('Saved narration revision no longer exists.');
    const slides = revision.content.modules.flatMap(module => module.conceptExplainer.videos.flatMap(video => video.slides));
    if (!slides.length) throw new Error('This course package has no narrated content slides.');
    const priorRows = await database.select().from(creatorAuthoredCourseAudio).where(and(eq(creatorAuthoredCourseAudio.courseId, courseId), eq(creatorAuthoredCourseAudio.voiceKey, job.voiceKey)));
    const clips: ProductionAudioClip[] = []; const todo: { key: string; text: string; slideId: string; narrationHash: string }[] = [];
    for (const slide of slides) {
      const narrationHash = digest({ narration: slide.narration, voice: job.voice }); const cached = priorRows.flatMap(row => row.clips).find(clip => clip.narrationHash === narrationHash);
      let exists = false;
      if (cached) { try { wavSeconds(await readFile(storagePath(cached.key))); exists = true; } catch { /* Missing local audio is rendered again. */ } }
      if (cached && exists) clips.push({ ...cached, slideId: slide.id, reused: true });
      else todo.push({ key: narrationHash, text: slide.narration, slideId: slide.id, narrationHash });
    }
    const writeProgress = () => database.update(creatorAuthoredCourseAudio).set({ clips: slides.flatMap(slide => clips.filter(clip => clip.slideId === slide.id)), updatedAt: new Date() }).where(and(eq(creatorAuthoredCourseAudio.id, id), eq(creatorAuthoredCourseAudio.token, token), eq(creatorAuthoredCourseAudio.status, 'running')));
    await writeProgress();
    const dirRel = path.join(id, token); const dir = storagePath(dirRel); await mkdir(dir, { recursive: true });
    await speaker(dir, todo, job.voice, async key => {
      const items = todo.filter(clip => clip.key === key); if (!items.length) return;
      const relative = path.join(dirRel, `${key}.wav`); const seconds = wavSeconds(await readFile(storagePath(relative)));
      for (const item of items) if (!clips.some(clip => clip.slideId === item.slideId)) clips.push({ slideId: item.slideId, key: relative, narrationHash: item.narrationHash, seconds, reused: false });
      await writeProgress();
    });
    if (clips.length !== slides.length) throw new Error('Some narration audio clips are missing.');
    await database.update(creatorAuthoredCourseAudio).set({ status: 'ready', error: null, updatedAt: new Date() }).where(and(eq(creatorAuthoredCourseAudio.id, id), eq(creatorAuthoredCourseAudio.token, token), eq(creatorAuthoredCourseAudio.status, 'running')));
  } catch {
    await database.update(creatorAuthoredCourseAudio).set({ status: 'failed', error: 'Local audio generation did not finish. Saved scripts and completed clips are retained. Retry to generate missing clips.', updatedAt: new Date() }).where(and(eq(creatorAuthoredCourseAudio.id, id), eq(creatorAuthoredCourseAudio.token, token), eq(creatorAuthoredCourseAudio.status, 'running')));
  }
}

export async function authoredCourseAudioClip(ownerId: string, courseId: string, revisionId: string, slideId: string) {
  const database = await db();
  const [revision] = await database.select().from(creatorAuthoredCourseRevisions).where(and(eq(creatorAuthoredCourseRevisions.id, revisionId), eq(creatorAuthoredCourseRevisions.courseId, courseId), eq(creatorAuthoredCourseRevisions.ownerId, ownerId)));
  if (!revision) throw new ApiError(404, 'not_found', 'Course revision not found.');
  const rows = await database.select().from(creatorAuthoredCourseAudio).where(and(eq(creatorAuthoredCourseAudio.courseId, courseId), eq(creatorAuthoredCourseAudio.ownerId, ownerId), eq(creatorAuthoredCourseAudio.revisionId, revisionId))).orderBy(desc(creatorAuthoredCourseAudio.createdAt));
  const clip = rows.flatMap(row => row.clips).find(item => item.slideId === slideId);
  if (!clip) throw new ApiError(404, 'audio_not_found', 'No saved narration audio exists for this slide.');
  return { bytes: await readFile(storagePath(clip.key)), clip };
}
