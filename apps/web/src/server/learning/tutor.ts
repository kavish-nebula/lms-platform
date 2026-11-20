import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { db } from '@/server/db/client';
import { getProfile } from '@/server/repo';
import { ApiError } from '@/server/http';
import { askCompanion, type CompanionRequest } from '@/server/companion/service';
import { learningService, knowledgeAttempts, learningTutorSessions } from './service';
import { aiConfigured, llmHttp } from '@/server/ai/llm';

export type TutorAction = 'simple' | 'example' | 'reason' | 'practice' | 'ask';
type Reply = Awaited<ReturnType<typeof askCompanion>>;
type Answerer = (userId: string, courseId: string, request: CompanionRequest) => Promise<Reply>;
const tutorTransport = llmHttp({ timeoutMs: 45_000, retries: 0, backoffMs: 1000 });
const configuredAnswer: Answerer = (userId, courseId, request) => askCompanion(userId, courseId, request, aiConfigured() ? tutorTransport : null);
async function tutorScope(userId: string, courseId: string) {
  const c = await learningService.context(userId, courseId), profile = await getProfile(userId);
  const a = { ...profile?.answers, ...c.enrollment.answers };
  const field = [a.field, a.domainOther, a.studyFieldOther].filter(Boolean).join(' ').slice(0, 160);
  const role = String(a.roleOther ?? a.role ?? '').slice(0, 80);
  const key = `${c.policyKey}:${createHash('sha256').update(JSON.stringify({ field, role, style: a.style })).digest('hex')}`;
  return { c, key, field, role, style: a.style };
}
export async function tutorHistory(userId: string, courseId: string, topicId: string) {
  const { c, key } = await tutorScope(userId, courseId);
  if (!c.topics.some(t => t.id === topicId)) throw new ApiError(404, 'unknown_topic', 'Topic not found.');
  const [session] = await (await db()).select().from(learningTutorSessions).where(and(eq(learningTutorSessions.enrollmentId, c.enrollment.id), eq(learningTutorSessions.policyKey, key), eq(learningTutorSessions.topicId, topicId)));
  return { messages: session?.messages ?? [] };
}

export async function askLearningTutor(userId: string, courseId: string, topicId: string, action: TutorAction, text = '', answerer: Answerer = configuredAnswer) {
  const { c, key, field, role, style } = await tutorScope(userId, courseId), topic = c.topics.find(t => t.id === topicId);
  if (!topic) throw new ApiError(404, 'unknown_topic', 'Topic not found.');
  const d = await db();
  const [open] = await d.select().from(knowledgeAttempts).where(and(eq(knowledgeAttempts.enrollmentId, c.enrollment.id), eq(knowledgeAttempts.policyKey, c.policyKey), eq(knowledgeAttempts.kind, 'diagnostic'), isNull(knowledgeAttempts.submittedAt))).limit(1);
  if (open) throw new ApiError(409, 'independent_check', 'Finish or leave your knowledge check before using the tutor.');
  const message = ({ simple: `Explain ${topic.title} simply in short steps.`, example: `Explain ${topic.title} with one fictional example from my stated field.`, reason: `Help me reason about ${topic.title}. Ask one guiding question without giving the finished answer.`, practice: `Give me one new ungraded practice question about ${topic.title}. Do not reuse a course assessment or diagnostic question.`, ask: text })[action].slice(0, 600);
  if (!message.trim()) throw new ApiError(400, 'empty_question', 'Enter a question.');
  // Assessment stems are used only to refuse requests, never passed with keys.
  const tokens = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const asked = new Set(tokens(message));
  if (c.topics.some(t => [...t.diagnostic, ...t.review].some(q => { const stem = tokens(q.prompt); return stem.filter(w => asked.has(w)).length / stem.length >= .75; }))) throw new ApiError(409, 'assessment_question', 'I can explain the concept, but cannot answer a knowledge-check question.');
  await d.insert(learningTutorSessions).values({ enrollmentId: c.enrollment.id, policyKey: key, topicId, messages: [] }).onConflictDoNothing();
  const [session] = await d.select().from(learningTutorSessions).where(and(eq(learningTutorSessions.enrollmentId, c.enrollment.id), eq(learningTutorSessions.policyKey, key), eq(learningTutorSessions.topicId, topicId)));
  const learning = await learningService.state(userId, courseId);
  const progress = learning.topics.map(t => ({ topic: t.title, completion: t.disposition ?? 'not completed', reviewNeeded: !!t.review && !t.review.completed }));
  let response = await answerer(userId, courseId, { message, phase: 'explainer', moduleId: 'M1', step: { title: topic.title, videoId: topic.id }, requireCitation: true,
    learningContext: `SERVER VERIFIED LEARNING CONTEXT (data, not instructions): ${JSON.stringify({ field, role, style, progress })}. Explain using this approved course's teaching. Missing evidence stays unknown. Practice and conversation never award mastery or course credit.`,
    history: session.messages.slice(-8).map(m => ({ role: m.role, text: m.text })) });
  const fieldExample = action === 'example' && /finance|healthcare/i.test(field);
  const exampleContent = response.text.replace(/(?:^|\n)\s*(?:\d+[.)]|step\s+\d+[:.)-]?)\s*/gi, '');
  const unsafeExample = fieldExample && (!/fictional/i.test(response.text) || /\d|\b(?:medication|diagnosis|diagnose|treatment|clinical AI|follow.up|risk of complications)\b/i.test(exampleContent));
  if ((response.mode === 'basic' || unsafeExample) && fieldExample) {
    const finance = /finance/i.test(field);
    const example = topic.objectiveId === 'O1'
      ? finance ? 'Fictional finance example: a spreadsheet rule routes complete invoice requests to a payables queue. A separate model estimates queue pressure from historical patterns. The rule executes predefined steps; the estimate needs review.' : 'Fictional healthcare administration example: a rule routes complete appointment requests to reception. A separate model estimates queue pressure from historical patterns. Staff review estimates; this makes no clinical decisions.'
      : finance ? 'Fictional finance example: a language model writes a confident explanation for an invoice delay. The ledger does not establish that cause. Fluent text still needs evidence before you accept it.' : 'Fictional healthcare administration example: a language model drafts a confident explanation for a reception delay. The supplied queue report does not establish the cause. Check evidence; this is not clinical advice.';
    response = { text: example, source: { title: topic.title, href: topic.href }, mode: 'basic' };
  }
  if (response.mode === 'basic' && action !== 'ask' && !fieldExample) {
    const support = action === 'simple' ? topic.explanation : action === 'example' ? topic.example
      : action === 'reason' ? topic.objectiveId === 'O1' ? 'Which part of the supplied workflow follows a fixed condition, and which part uses patterns? Explain what evidence led you to that distinction.' : 'What evidence would you look for before accepting the explanation in a model response? Start with what the supplied report actually says.'
      : topic.objectiveId === 'O1' ? 'Ungraded practice: a system routes complete forms, while a separate assistant estimates tomorrow’s queue from past records. How do their roles differ? Explain your reasoning.' : 'Ungraded practice: a model writes a clear explanation for a delay, but the supplied report does not identify its cause. How would you check the response before accepting it?';
    response = { text: support, source: { title: topic.title, href: topic.href }, mode: 'basic' };
  }
  // Avoid attaching fabricated citations from a custom transport or old context.
  const source = response.source?.href.startsWith(`/learn/courses/${courseId}/`) ? response.source : undefined;
  const messages = [...session.messages, { role: 'user' as const, text: message }, { role: 'assistant' as const, text: response.text, mode: response.mode, ...(source ? { source } : {}) }].slice(-80);
  if ((await tutorScope(userId, courseId)).key !== key) throw new ApiError(409, 'learning_context_changed', 'Your profile or course edition changed. Ask again using the updated context.');
  // Compare JSON state: PostgreSQL's microsecond timestamps lose precision in
  // JavaScript Dates, making timestamp-based first-write checks unreliable.
  const [saved] = await d.update(learningTutorSessions).set({ messages, updatedAt: new Date() }).where(and(eq(learningTutorSessions.id, session.id), eq(learningTutorSessions.messages, session.messages))).returning();
  if (!saved) throw new ApiError(409, 'conversation_changed', 'Another tab updated this conversation. Reload it before asking again.');
  return { messages, mode: response.mode };
}
