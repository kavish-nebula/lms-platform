import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getCourse, getModule } from '@/data';
import { db } from '@/server/db/client';
import { knowledgeAttempts, topicProgress, learningReviews, learningTutorSessions, signals } from '@/server/db/schema';
import * as repo from '@/server/repo';
import { ApiError } from '@/server/http';
import { pilotTopics, publicQuestion } from './pilot-policy';
import type { Course, ModuleContent } from '@/data/types';
import { ruleRevision } from '@/server/planner/policy';

type Loader = (userId: string, courseId: string) => Promise<{ course: Course | null | undefined; module: ModuleContent | null | undefined }>;
export function createLearningService(load: Loader = async (userId, courseId) => ({ course: await getCourse(courseId, userId), module: await getModule(courseId, 'M1', userId) })) {
  async function context(userId: string, courseId: string) {
    const enrollment = await repo.findEnrollment(userId, courseId);
    if (!enrollment) throw new ApiError(404, 'not_enrolled', 'Enroll to use your personal learning path.');
    const { course, module } = await load(userId, courseId);
    const topics = course && module ? pilotTopics(course, module) : [];
    if (!course || !module || !topics.length) throw new ApiError(409, 'learning_unavailable', 'Knowledge-based learning is not enabled for this edition.');
    const policyKey = createHash('sha256').update(JSON.stringify({ version: 1, edition: enrollment.editionId, source: course.version, module: module.version, topics })).digest('hex');
    return { enrollment, course, module, topics, policyKey };
  }
  async function state(userId: string, courseId: string) {
    const c = await context(userId, courseId), d = await db();
    const where = and(eq(topicProgress.enrollmentId, c.enrollment.id), eq(topicProgress.policyKey, c.policyKey));
    const [progress, reviews, attempts, legacyProgress] = await Promise.all([
      d.select().from(topicProgress).where(where),
      d.select().from(learningReviews).where(and(eq(learningReviews.enrollmentId, c.enrollment.id), eq(learningReviews.policyKey, c.policyKey))),
      d.select().from(knowledgeAttempts).where(and(eq(knowledgeAttempts.enrollmentId, c.enrollment.id), eq(knowledgeAttempts.policyKey, c.policyKey))),
      repo.progressFor(c.enrollment.id),
    ]);
    return { policyKey: c.policyKey, enrollmentId: c.enrollment.id, moduleId: 'M1', topics: c.topics.map(t => {
      const p = progress.find(p => p.topicId === t.id), r = reviews.find(r => r.topicId === t.id), diagnostic = attempts.find(a => a.topicId === t.id && a.kind === 'diagnostic');
      return { id: t.id, title: t.title, objectiveId: t.objectiveId, sourceIds: t.sourceIds, href: t.href,
        disposition: p?.disposition ?? (legacyProgress.some(p => p.moduleId === 'M1' && p.stage === 'explainer') ? 'completed' : null), diagnosticTaken: !!diagnostic?.submittedAt,
        review: r ? { reason: r.reason, completed: !!r.completedAt, explanation: t.explanation, example: t.example } : null,
        openAttempt: attempts.find(a => a.topicId === t.id && !a.submittedAt)?.id ?? null };
    }) };
  }
  async function start(userId: string, courseId: string, topicId: string, kind: 'diagnostic' | 'review') {
    const c = await context(userId, courseId), topic = c.topics.find(t => t.id === topicId);
    if (!topic) throw new ApiError(404, 'unknown_topic', 'Topic not found.');
    return (await db()).transaction(async tx => {
      await tx.execute(sql`SELECT id FROM enrollments WHERE id = ${c.enrollment.id} FOR UPDATE`);
      if (kind === 'review') {
        const [r] = await tx.select().from(learningReviews).where(and(eq(learningReviews.enrollmentId, c.enrollment.id), eq(learningReviews.policyKey, c.policyKey), eq(learningReviews.topicId, topicId), isNull(learningReviews.completedAt)));
        if (!r) throw new ApiError(409, 'no_review', 'There is no outstanding review for this topic.');
      }
      const prior = await tx.select().from(knowledgeAttempts).where(and(eq(knowledgeAttempts.enrollmentId, c.enrollment.id), eq(knowledgeAttempts.policyKey, c.policyKey), eq(knowledgeAttempts.topicId, topicId), eq(knowledgeAttempts.kind, kind)));
      if (kind === 'diagnostic' && prior.some(a => a.submittedAt)) throw new ApiError(409, 'diagnostic_taken', 'Use the lesson and targeted review after this knowledge check.');
      let attempt = prior.find(a => !a.submittedAt);
      if (!attempt) [attempt] = await tx.insert(knowledgeAttempts).values({ enrollmentId: c.enrollment.id, policyKey: c.policyKey, topicId, kind, questionIds: topic[kind].map(q => q.id) }).returning();
      return { attemptId: attempt!.id, kind, topicId, title: topic.title, questions: topic[kind].map(publicQuestion) };
    });
  }
  async function submit(userId: string, courseId: string, attemptId: string, responses: Record<string, number[]>, cancel = false) {
    const c = await context(userId, courseId);
    return (await db()).transaction(async tx => {
      await tx.execute(sql`SELECT id FROM enrollments WHERE id = ${c.enrollment.id} FOR UPDATE`);
      const [attempt] = await tx.select().from(knowledgeAttempts).where(and(eq(knowledgeAttempts.id, attemptId), eq(knowledgeAttempts.enrollmentId, c.enrollment.id), eq(knowledgeAttempts.policyKey, c.policyKey)));
      if (!attempt) throw new ApiError(404, 'attempt_not_found', 'This knowledge check is not available.');
      if (attempt.submittedAt) return { passed: attempt.passed, cancelled: attempt.passed === null, replayed: true };
      const topic = c.topics.find(t => t.id === attempt.topicId)!;
      const bank = topic[attempt.kind as 'diagnostic' | 'review'];
      if (!cancel && (Object.keys(responses).length !== bank.length || bank.some(q => !Array.isArray(responses[q.id]) || !responses[q.id].length || new Set(responses[q.id]).size !== responses[q.id].length || responses[q.id].some(n => !Number.isInteger(n) || n < 0 || n >= q.options.length) || q.correct.length === 1 && responses[q.id].length !== 1))) throw new ApiError(400, 'incomplete_check', 'Answer each question using the provided options.');
      const passed = cancel ? null : bank.every(q => JSON.stringify([...responses[q.id]].sort()) === JSON.stringify([...q.correct].sort()));
      await tx.update(knowledgeAttempts).set({ responses: cancel ? {} : responses, passed, submittedAt: new Date() }).where(eq(knowledgeAttempts.id, attempt.id));
      if (passed && attempt.kind === 'diagnostic') await tx.insert(topicProgress).values({ enrollmentId: c.enrollment.id, policyKey: c.policyKey, topicId: topic.id, disposition: 'demonstrated', attemptId: attempt.id }).onConflictDoNothing();
      if (passed) await tx.update(learningReviews).set({ completedAt: new Date(), updatedAt: new Date() }).where(and(eq(learningReviews.enrollmentId, c.enrollment.id), eq(learningReviews.policyKey, c.policyKey), eq(learningReviews.topicId, topic.id)));
      if (passed === false) await tx.insert(learningReviews).values({ enrollmentId: c.enrollment.id, policyKey: c.policyKey, topicId: topic.id, reason: `Your ${attempt.kind === 'diagnostic' ? 'knowledge check' : 'review practice'} suggests another look at ${topic.title}.` }).onConflictDoUpdate({ target: [learningReviews.enrollmentId, learningReviews.policyKey, learningReviews.topicId], set: { completedAt: null, updatedAt: new Date() } });
      const lesson = c.module.blocks.find(b => b.stage === 'explainer')?.videos?.find(v => v.id === topic.id)?.lesson;
      if (!cancel) await tx.insert(signals).values({ enrollmentId: c.enrollment.id, kind: 'knowledge_check', moduleId: 'M1', lesson, payload: { verified: true, correct: passed, passed, topicId: topic.id, objectiveId: topic.objectiveId, attemptKind: attempt.kind, policyKey: c.policyKey, missedLessons: passed ? [] : [lesson] }, idempotencyKey: `knowledge:${attempt.id}` }).onConflictDoNothing();
      return { passed, cancelled: cancel, replayed: false };
    });
  }
  async function complete(userId: string, courseId: string, topicId: string) {
    const c = await context(userId, courseId), video = c.module.blocks.find(b => b.stage === 'explainer')?.videos?.find(v => v.id === topicId);
    if (!c.topics.some(t => t.id === topicId) || !video) throw new ApiError(404, 'unknown_topic', 'Topic not found.');
    const evidence = await (await db()).select().from(signals).where(and(eq(signals.enrollmentId, c.enrollment.id), eq(signals.moduleId, 'M1')));
    if (['mid', 'end'].some(section => (section === 'mid' ? video.midQuiz : video.endQuiz).some((_, i) => !evidence.some(s => s.kind === 'video_check' && s.payload.verified === true && s.payload.videoId === topicId && s.payload.section === section && s.payload.question === i)))) throw new ApiError(409, 'checks_required', 'Complete the video knowledge checks before recording the topic as completed.');
    await (await db()).transaction(async tx => {
      await tx.execute(sql`SELECT id FROM enrollments WHERE id = ${c.enrollment.id} FOR UPDATE`);
      await tx.insert(topicProgress).values({ enrollmentId: c.enrollment.id, policyKey: c.policyKey, topicId, disposition: 'completed' }).onConflictDoNothing();
    });
  }
  async function recordMistakes(userId: string, courseId: string, fresh: repo.SignalRow[]) {
    let c: Awaited<ReturnType<typeof context>>;
    try { c = await context(userId, courseId); } catch (e) { if (e instanceof ApiError && e.code === 'learning_unavailable') return; throw e; }
    for (const topic of c.topics) {
      const video = c.module.blocks.find(b => b.stage === 'explainer')?.videos?.find(v => v.id === topic.id);
      const missed = fresh.some(s => s.moduleId === 'M1' && s.payload.verified === true && (
        s.kind === 'video_check' && s.payload.videoId === topic.id && s.payload.correct === false
        || s.kind === 'module_check' && (Array.isArray(s.payload.failedObjectives) && s.payload.failedObjectives.includes(topic.objectiveId) || Array.isArray(s.payload.missedLessons) && s.payload.missedLessons.includes(video?.lesson))
        || s.kind === 'scenario_answer' && s.lesson === video?.lesson && s.payload.correct === false));
      if (!missed) continue;
      await (await db()).transaction(async tx => {
        await tx.execute(sql`SELECT id FROM enrollments WHERE id = ${c.enrollment.id} FOR UPDATE`);
        await tx.insert(learningReviews).values({ enrollmentId: c.enrollment.id, policyKey: c.policyKey, topicId: topic.id, reason: `Your latest graded course check suggests reviewing ${topic.title}.` }).onConflictDoUpdate({ target: [learningReviews.enrollmentId, learningReviews.policyKey, learningReviews.topicId], set: { completedAt: null, updatedAt: new Date() } });
        await tx.delete(topicProgress).where(and(eq(topicProgress.enrollmentId, c.enrollment.id), eq(topicProgress.policyKey, c.policyKey), eq(topicProgress.topicId, topic.id), eq(topicProgress.disposition, 'demonstrated')));
      });
    }
  }
  async function refreshSupport(userId: string, courseId: string) {
    const c = await context(userId, courseId);
    const current = (await repo.plansFor(c.enrollment.id)).find(p => p.status === 'ready');
    if (!current?.plan) return;
    const evidence = (await repo.signalsFor(c.enrollment.id)).filter(s => s.kind === 'knowledge_check' && s.payload.verified === true && s.payload.policyKey === c.policyKey);
    const revised = ruleRevision(current.plan, evidence);
    if (revised) await repo.insertPlan(c.enrollment.id, { status: 'ready', source: current.source, trigger: 'signals', plan: revised, changes: revised.changes, completedAt: new Date() });
  }
  return { context, state, start, submit, complete, recordMistakes, refreshSupport };
}
export const learningService = createLearningService();
export type LearningState = Awaited<ReturnType<typeof learningService.state>>;
export { knowledgeAttempts, learningTutorSessions, learningReviews, topicProgress };
