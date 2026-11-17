import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { handle, body, ok, ApiError } from '@/server/http';
import { learningService } from '@/server/learning/service';

const Input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), topicId: z.string().max(200), kind: z.enum(['diagnostic', 'review']) }).strict(),
  z.object({ action: z.literal('submit'), attemptId: z.uuid(), responses: z.record(z.string(), z.array(z.number().int().min(0).max(20)).max(20)) }).strict(),
  z.object({ action: z.literal('cancel'), attemptId: z.uuid() }).strict(),
  z.object({ action: z.literal('complete'), topicId: z.string().max(200) }).strict(),
]);
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params, user = await getSessionUser();
  try { return ok({ enabled: true, ...await learningService.state(user.id, courseId) }); }
  catch (e) { if (e instanceof ApiError && e.code === 'learning_unavailable') return ok({ enabled: false }); throw e; }
});
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params, user = await getSessionUser(), input = await body(req, Input);
  if (input.action === 'start') return ok(await learningService.start(user.id, courseId, input.topicId, input.kind));
  if (input.action === 'complete') { await learningService.complete(user.id, courseId, input.topicId); return ok({ completed: true }); }
  const result = await learningService.submit(user.id, courseId, input.attemptId, input.action === 'submit' ? input.responses : {}, input.action === 'cancel');
  if (input.action === 'submit' && !result.replayed) await learningService.refreshSupport(user.id, courseId);
  return ok(result);
});
