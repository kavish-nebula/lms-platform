import { getSessionUser } from '@/server/auth';
import { getCodexCourseContext } from '@/server/authored-course';
import { handle, ok } from '@/server/http';

export const GET = handle(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const user = await getSessionUser();
  return ok({ context: await getCodexCourseContext(user.id, (await context.params).id) });
});
