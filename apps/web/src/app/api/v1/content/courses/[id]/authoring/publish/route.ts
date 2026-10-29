import { getSessionUser } from '@/server/auth';
import { PublishAuthoredCourse, publishAuthoredCourse } from '@/server/authored-publication';
import { body, handle, ok } from '@/server/http';

export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getSessionUser();
  return ok({ release: await publishAuthoredCourse(user.id, (await params).id, await body(request, PublishAuthoredCourse)) });
});
