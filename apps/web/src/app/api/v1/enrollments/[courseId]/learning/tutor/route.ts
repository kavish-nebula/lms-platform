import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { handle, body, ok } from '@/server/http';
import { askLearningTutor, tutorHistory } from '@/server/learning/tutor';
export const GET = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params, user = await getSessionUser();
  return ok(await tutorHistory(user.id, courseId, new URL(req.url).searchParams.get('topicId') ?? ''));
});
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params, user = await getSessionUser();
  const input = await body(req, z.object({ topicId: z.string().min(1).max(200), action: z.enum(['simple', 'example', 'reason', 'practice', 'ask']), message: z.string().max(600).default('') }).strict());
  return ok(await askLearningTutor(user.id, courseId, input.topicId, input.action, input.message));
});
