import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { appRoot, db } from './db/client';
import { creatorCourses, creatorProductionJobs, creatorScriptReviews, creatorSmeReviews, creatorProductionAudio as audio } from './db/schema';
import { productionState, assertCurrentProduction } from './module-production';
import { ApiError } from './http';
import { speakProduction, type ProductionSpeaker } from './production-speech';
import type { ProductionRevision } from '@/lib/module-production';
import type { ProductionAudioClip, ProductionAudioState, ProductionVoice } from '@/lib/production-audio';
import { sameCourseBrief } from '@/lib/content-creator';
import { LONGFORM_MAX_SECONDS, narrationDurationValid } from '@/lib/longform-production';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const settings = (longform = false): ProductionVoice => ({ provider: 'kokoro', model: process.env.KOKORO_MODEL ?? 'onnx-community/Kokoro-82M-v1.0-ONNX', voice: process.env.KOKORO_VOICE ?? 'am_michael', dtype: process.env.KOKORO_DTYPE ?? 'fp32', device: process.env.KOKORO_DEVICE ?? 'cpu', version: longform ? 2 : 1 });
const configured = () => process.env.AUDIO !== 'off' && process.env.KOKORO !== 'off';
const root = () => path.join(appRoot(), '.data', 'creator-audio');
const file = (jobId: string, key: string) => path.join(root(), jobId, `${key}.wav`);
const lease = () => new Date(Date.now() + 35 * 60 * 1000);
const clipHash = (revision: ProductionRevision, slideId: string, voice: ProductionVoice) => digest({ slideId, narration: revision.narrationHashes[slideId], pronunciation: revision.content.slides.find(s => s.id === slideId)!.pronunciationNotes, voice });

async function context(userId: string, courseId: string, runId: string, moduleId: string, jobId: string) {
  const state = await productionState(userId, courseId, runId, moduleId);
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) throw new ApiError(404, 'not_found', 'Production package not found.');
  const revision = job.revisions[0];
  const review = job.reviews.find(r => r.revisionId === revision?.id);
  const eligible = state.eligible && !job.outdated && job.status === 'ready' && !!revision && review?.verdict === 'approved' && job.input.unit?.kind !== 'plan';
  return { job, revision, review, eligible: !!eligible, reason: !state.eligible || job.outdated ? 'A current Stage 3 approval is required before generating audio.' : !eligible ? 'Save the narration scripts and approve that exact revision before generating audio.' : 'Approved scripts are ready for local Kokoro narration. Listen to each clip before release.' };
}

export async function productionAudioState(userId: string, courseId: string, runId: string, moduleId: string, jobId: string): Promise<ProductionAudioState> {
  const c = await context(userId, courseId, runId, moduleId, jobId); const database = await db();
  await database.update(audio).set({ status: 'failed', error: 'Audio processing was interrupted or timed out. Retry explicitly.', updatedAt: new Date() }).where(and(eq(audio.jobId, jobId), eq(audio.status, 'running'), lt(audio.leaseUntil, new Date())));
  const rows = await database.select().from(audio).where(eq(audio.jobId, jobId)).orderBy(desc(audio.createdAt));
  for (const row of rows.filter(r => r.status === 'ready')) {
    if (c.job.input.unit?.kind === 'video' && row.clips.some(clip => !narrationDurationValid(clip.seconds))) {
      row.status = 'failed'; row.error = 'Narration must measure 300–420 seconds per slide. Revise and reapprove the affected scripts.';
      await database.update(audio).set({ status: row.status, error: row.error, updatedAt: new Date() }).where(eq(audio.id, row.id));
    }
    const present = await Promise.all(row.clips.map(async clip => { try { return (await stat(file(jobId, clip.key))).size > 44; } catch { return false; } }));
    if (present.some(value => !value)) {
      row.status = 'failed'; row.error = 'Saved audio is missing. Retry to restore missing clips.';
      await database.update(audio).set({ status: row.status, error: row.error, updatedAt: new Date() }).where(eq(audio.id, row.id));
    }
  }
  const minimumSeconds = c.job.input.unit?.kind === 'video' ? c.job.input.unit.minSeconds : 0;
  const maximumSeconds = minimumSeconds ? LONGFORM_MAX_SECONDS : undefined;
  return { eligible: c.eligible, reason: c.reason, configured: configured(), minimumSeconds, maximumSeconds, jobs: rows.map(row => ({ id: row.id, revisionId: row.revisionId, reviewId: row.reviewId, status: row.status, clips: row.clips, voice: row.voice, error: row.error, attempts: row.attempts, createdAt: row.createdAt.toISOString(), shortSlides: row.clips.filter(clip => clip.seconds < minimumSeconds).map(clip => clip.slideId), longSlides: row.clips.filter(clip => maximumSeconds !== undefined && clip.seconds > maximumSeconds).map(clip => clip.slideId), current: c.eligible && row.revisionId === c.revision.id && row.reviewId === c.review!.id && row.voiceKey === digest(settings(minimumSeconds > 0)) })) };
}

export async function startProductionAudio(userId: string, courseId: string, runId: string, moduleId: string, input: { jobId: string; revisionId: string; reviewId: string }) {
  const database = await db();
  await productionAudioState(userId, courseId, runId, moduleId, input.jobId);
  const c = await context(userId, courseId, runId, moduleId, input.jobId);
  if (!c.eligible || c.revision.id !== input.revisionId || c.review!.id !== input.reviewId) throw new ApiError(409, 'script_approval_required', c.reason);
  // Share the course lock with script saves and SME decisions so approval cannot
  // change between the eligibility check and creating the audio job.
  return database.transaction(async tx => {
    const [course] = await tx.select().from(creatorCourses).where(and(eq(creatorCourses.id, courseId), eq(creatorCourses.ownerId, userId))).for('update');
    const [head] = await tx.select().from(creatorProductionJobs).where(eq(creatorProductionJobs.id, input.jobId));
    const [sme] = await tx.select().from(creatorSmeReviews).where(and(eq(creatorSmeReviews.runId, runId), eq(creatorSmeReviews.moduleId, moduleId))).orderBy(desc(creatorSmeReviews.version)).limit(1);
    const [review] = await tx.select().from(creatorScriptReviews).where(and(eq(creatorScriptReviews.jobId, input.jobId), eq(creatorScriptReviews.revisionId, input.revisionId))).orderBy(desc(creatorScriptReviews.version)).limit(1);
    if (!course || !sameCourseBrief(course.brief, c.job.input.run.input.brief) || head.currentRevision !== c.revision.version || sme?.id !== c.job.input.approval.id || review?.id !== input.reviewId || review.verdict !== 'approved') throw new ApiError(409, 'script_approval_required', 'Source or script approval changed. Reload before generating audio.');
    await assertCurrentProduction(tx, head, userId, courseId, moduleId);
    if (!configured()) throw new ApiError(503, 'speech_unavailable', 'Enable the local Kokoro speech service to generate narration.');
    const voice = settings(c.job.input.unit?.kind === 'video'); const voiceKey = digest(voice); const token = randomUUID();
    const [created] = await tx.insert(audio).values({ jobId: input.jobId, revisionId: input.revisionId, reviewId: input.reviewId, voiceKey, voice, token, leaseUntil: lease() }).onConflictDoNothing().returning();
    if (created) return { id: created.id, token };
    const [existing] = await tx.select().from(audio).where(and(eq(audio.revisionId, input.revisionId), eq(audio.reviewId, input.reviewId), eq(audio.voiceKey, voiceKey)));
    if (existing.status !== 'failed') return { id: existing.id, token: null };
    if (c.job.input.unit?.kind === 'video' && existing.clips.some(clip => clip.seconds < 300)) throw new ApiError(409, 'narration_too_short', 'Edit and reapprove the short scripts before generating again. Do not add silence or slow playback to meet the minimum.');
    if (c.job.input.unit?.kind === 'video' && existing.clips.some(clip => clip.seconds > LONGFORM_MAX_SECONDS)) throw new ApiError(409, 'narration_too_long', 'Shorten and reapprove the affected scripts before generating again. Do not accelerate playback or cut off speech to meet the maximum.');
    await tx.update(audio).set({ status: 'running', error: null, token, attempts: sql`${audio.attempts} + 1`, leaseUntil: lease(), updatedAt: new Date() }).where(eq(audio.id, existing.id));
    return { id: existing.id, token };
  });
}

export function wavSeconds(bytes: Buffer): number {
  if (bytes.length <= 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.toString('ascii', 12, 16) !== 'fmt ' || bytes.readUInt16LE(20) !== 1 || bytes.toString('ascii', 36, 40) !== 'data') throw new Error('Invalid PCM narration file.');
  const rate = bytes.readUInt32LE(28); const length = bytes.readUInt32LE(40);
  if (!rate || !length || length > bytes.length - 44) throw new Error('Incomplete narration file.');
  return length / rate;
}

export async function processProductionAudio(id: string, token: string, userId: string, courseId: string, runId: string, moduleId: string, speaker: ProductionSpeaker = speakProduction) {
  const database = await db();
  const [row] = await database.select().from(audio).where(and(eq(audio.id, id), eq(audio.token, token), eq(audio.status, 'running')));
  if (!row) return;
  try {
    const c = await context(userId, courseId, runId, moduleId, row.jobId);
    if (!c.eligible || c.revision.id !== row.revisionId || c.review!.id !== row.reviewId) throw new Error('Source approval changed.');
    const prior = await database.select().from(audio).where(and(eq(audio.jobId, row.jobId), eq(audio.voiceKey, row.voiceKey)));
    const clips: ProductionAudioClip[] = []; const todo: { key: string; text: string; slideId: string; narrationHash: string }[] = [];
    for (const slide of c.revision.content.slides) {
      const hash = clipHash(c.revision, slide.id, row.voice);
      const cached = prior.flatMap(p => p.clips).find(p => p.key.endsWith(`/${hash}`));
      let reusable = false;
      if (cached) { try { wavSeconds(await readFile(file(row.jobId, cached.key))); reusable = true; } catch { /* Missing local media is regenerated. */ } }
      if (cached && reusable) clips.push({ ...cached, slideId: slide.id, reused: true });
      else todo.push({ key: hash, text: slide.narration, slideId: slide.id, narrationHash: c.revision.narrationHashes[slide.id] });
    }
    const update = () => database.update(audio).set({ clips: c.revision.content.slides.flatMap(s => clips.filter(p => p.slideId === s.id)), updatedAt: new Date() }).where(and(eq(audio.id, id), eq(audio.token, token), eq(audio.status, 'running')));
    await update();
    const dir = path.join(root(), row.jobId, id, token);
    await speaker(dir, todo, row.voice, async key => {
      const item = todo.find(t => t.key === key); if (!item) return;
      const relative = `${id}/${token}/${key}`;
      const seconds = wavSeconds(await readFile(file(row.jobId, relative)));
      if (!clips.some(p => p.slideId === item.slideId)) clips.push({ slideId: item.slideId, key: relative, narrationHash: item.narrationHash, seconds, reused: false });
      await update();
    });
    if (clips.length !== c.revision.content.slides.length) throw new Error('Some narration clips are missing.');
    const minimum = c.job.input.unit?.kind === 'video' ? c.job.input.unit.minSeconds : 0;
    const invalid = clips.filter(clip => minimum ? !narrationDurationValid(clip.seconds) : false);
    await database.update(audio).set({ status: invalid.length ? 'failed' : 'ready', error: invalid.length ? `${invalid.length} slide(s) fall outside 300–420 seconds. Revise and reapprove their scripts. Completed clips are retained for preview.` : null, updatedAt: new Date() }).where(and(eq(audio.id, id), eq(audio.token, token), eq(audio.status, 'running')));
  } catch {
    await database.update(audio).set({ status: 'failed', error: 'Audio could not finish. Saved scripts and completed clips are retained. Retry to generate missing clips.', updatedAt: new Date() }).where(and(eq(audio.id, id), eq(audio.token, token), eq(audio.status, 'running')));
  }
}

export async function productionAudioFile(userId: string, courseId: string, runId: string, moduleId: string, jobId: string, audioId: string, slideId: string) {
  const state = await productionAudioState(userId, courseId, runId, moduleId, jobId);
  const clip = state.jobs.find(j => j.id === audioId)?.clips.find(c => c.slideId === slideId);
  if (!clip) throw new ApiError(404, 'not_found', 'Narration clip not found.');
  try { const bytes = await readFile(file(jobId, clip.key)); wavSeconds(bytes); return bytes; }
  catch { throw new ApiError(404, 'media_missing', 'This clip is missing. Retry narration generation.'); }
}
