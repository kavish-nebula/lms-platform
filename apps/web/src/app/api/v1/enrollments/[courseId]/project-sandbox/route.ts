import { getSessionUser } from '@/server/auth';
import { ApiError, body, handle, ok } from '@/server/http';
import { SandboxRequest, sandboxAction, sandboxWork } from '@/server/project-sandbox';
import { z } from 'zod/v4';

type Context = { params: Promise<{ courseId: string }> };
export const GET = handle(async (request: Request, { params }: Context) => {
  const revisionId = new URL(request.url).searchParams.get('revisionId');
  if (!z.uuid().safeParse(revisionId).success) throw new ApiError(400, 'invalid_revision', 'A published revision ID is required.');
  return ok({ work: await sandboxWork((await getSessionUser()).id, (await params).courseId, revisionId!) });
});
export const POST = handle(async (request: Request, { params }: Context) => ok(await sandboxAction((await getSessionUser()).id, (await params).courseId, await body(request, SandboxRequest))));
