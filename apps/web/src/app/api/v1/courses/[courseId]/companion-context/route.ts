import { getCourse, getModule } from '@/data';
import type { ModuleContent } from '@/data/types';
import { coursePassages } from '@/lib/companion';
import { getSessionUser } from '@/server/auth';
import { ApiError, handle, ok } from '@/server/http';

/** Assistant context is private and resolves the learner's enrolled edition. */
export const GET = handle(async (_request: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  const user = await getSessionUser();
  const course = await getCourse(courseId, user.id);
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  const modules = (await Promise.all(course.modules.map(m => getModule(courseId, m.module_id, user.id))))
    .filter((m): m is ModuleContent => !!m);
  const response = ok({ course, passages: coursePassages(course, modules) });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
