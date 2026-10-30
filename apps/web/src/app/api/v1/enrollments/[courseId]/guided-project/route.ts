import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { ApiError, body, handle, ok } from '@/server/http';
import { GuidedRequest, guidedAction, guidedWork } from '@/server/guided-project';

type Context = { params: Promise<{ courseId: string }> };
export const GET = handle(async (req: Request, { params }: Context) => {
  const revisionId = new URL(req.url).searchParams.get('revisionId');
  if (!z.uuid().safeParse(revisionId).success) throw new ApiError(400, 'invalid_revision', 'A published revision ID is required.');
  return ok({ work: await guidedWork((await getSessionUser()).id, (await params).courseId, revisionId!) });
});
export const POST = handle(async (req: Request, { params }: Context) => ok(await guidedAction((await getSessionUser()).id, (await params).courseId, await body(req, GuidedRequest))));
