import { getSessionUser } from '@/server/auth';
import { reviewAuthoredCourse, SaveCourseReview } from '@/server/authored-course';
import { body, handle, ok } from '@/server/http';

type Context = { params: Promise<{ id: string }> };
export const POST = handle(async (request: Request, { params }: Context) => {
  const user = await getSessionUser();
  return ok({ review: await reviewAuthoredCourse(user.id, user, (await params).id, await body(request, SaveCourseReview)) }, 201);
});
