import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { body, handle, ok } from '@/server/http';
import { createCreatorMcpGrant, listCreatorMcpGrants, revokeCreatorMcpGrant } from '@/server/creator-mcp';

export const GET = handle(async () => {
  const response = ok({ connections: await listCreatorMcpGrants((await getSessionUser()).id) });
  response.headers.set('Cache-Control', 'no-store'); return response;
});
export const POST = handle(async (request: Request) => {
  const { allowPublication } = await body(request, z.object({ allowPublication: z.boolean().default(false) }).strict());
  const response = ok({ connection: await createCreatorMcpGrant((await getSessionUser()).id, allowPublication) }, 201);
  response.headers.set('Cache-Control', 'no-store'); return response;
});
export const DELETE = handle(async (request: Request) => {
  const { id } = await body(request, z.object({ id: z.uuid() }).strict());
  await revokeCreatorMcpGrant((await getSessionUser()).id, id);
  return ok({ revoked: true });
});
