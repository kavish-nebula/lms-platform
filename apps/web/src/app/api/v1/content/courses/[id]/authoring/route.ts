import { getSessionUser } from '@/server/auth';
import { authoredCourseState, SaveAuthoredCourse, saveAuthoredCourse } from '@/server/authored-course';
import { body, handle, ok } from '@/server/http';

type Context = { params: Promise<{ id: string }> };
export const GET = handle(async (_request: Request, { params }: Context) => {
  const user = await getSessionUser();
  return ok(await authoredCourseState(user.id, (await params).id));
});
export const POST = handle(async (request: Request, { params }: Context) => {
  const user = await getSessionUser();
  return ok({ revision: await saveAuthoredCourse(user.id, (await params).id, await body(request, SaveAuthoredCourse)) }, 201);
});
