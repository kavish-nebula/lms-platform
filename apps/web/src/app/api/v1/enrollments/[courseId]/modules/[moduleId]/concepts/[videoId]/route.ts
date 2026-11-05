import { getSessionUser } from '@/server/auth';
import { handle, ok } from '@/server/http';
import { queueConcept } from '@/server/adapt/live';

/** Enrollment/profile/release-scoped delivery; no assessment answers or keys are
 * supplied to the model, and incomplete text/audio never becomes playable. */
type Context = { params: Promise<{ courseId: string; moduleId: string; videoId: string }> };
async function view({ params }: Context, retry: boolean) {
  const { courseId, moduleId, videoId } = await params;
  const job = await queueConcept(await getSessionUser(), courseId, moduleId, videoId, retry);
  const ready = job.status === 'ready';
  const content = ready ? job.content as unknown as import('@/lib/personalized-concept').PersonalizedConcept & { audio: Record<string, string> } : undefined;
  return ok({ concept: { id: job.id, status: job.status, ...(content ? { scenes: content.scenes.map((scene, i) => ({ ...scene, audio: content.audio[`scene${i}`] })) } : {}) } });
}
export const GET = handle(async (_request: Request, context: Context) => view(context, false));
export const POST = handle(async (_request: Request, context: Context) => view(context, true));
