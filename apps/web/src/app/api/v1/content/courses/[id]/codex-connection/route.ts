import { getSessionUser } from '@/server/auth';
import { createCodexGrant, revokeCodexGrant } from '@/server/authored-course';
import { body, handle, ok } from '@/server/http';
import { z } from 'zod/v4';

type Context = { params: Promise<{ id: string }> };
const Revoke = z.object({ grantId: z.uuid() }).strict();
export const POST = handle(async (_request: Request, { params }: Context) => {
  const user = await getSessionUser(); const { id } = await params;
  return ok(await createCodexGrant(user.id, id), 201);
});
export const DELETE = handle(async (request: Request, { params }: Context) => {
  const user = await getSessionUser(); const { id } = await params; const input = await body(request, Revoke);
  await revokeCodexGrant(user.id, id, input.grantId); return ok({ revoked: true });
});
