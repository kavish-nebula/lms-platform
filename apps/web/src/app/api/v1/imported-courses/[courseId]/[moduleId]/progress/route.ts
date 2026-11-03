import * as z from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { ApiError, body, handle, ok } from '@/server/http';
import { readPackageState, savePackageState } from '@/server/imported-courses';

const State = z.object({ version: z.literal(1), cmi: z.record(z.string().max(200), z.string().max(100_000)), storage: z.record(z.string().max(250), z.string().max(200_000)) });
type Context = { params: Promise<{ courseId: string; moduleId: string }> };
export const GET = handle(async (_req: Request, { params }: Context) => {
  const { courseId, moduleId } = await params;
  return ok({ state: await readPackageState((await getSessionUser()).id, courseId, moduleId) });
});
export const PUT = handle(async (req: Request, { params }: Context) => {
  const { courseId, moduleId } = await params;
  const state = await body(req, State);
  if (Object.keys(state.cmi).some(k => !k.startsWith('cmi.')) || Object.keys(state.cmi).length > 1000 || Object.keys(state.storage).length > 200 || JSON.stringify(state).length > 500_000)
    throw new ApiError(400, 'invalid_state', 'Module progress is too large or invalid.');
  await savePackageState((await getSessionUser()).id, courseId, moduleId, state);
  return ok({ saved: true });
});
