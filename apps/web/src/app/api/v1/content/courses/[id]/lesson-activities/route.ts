import { getSessionUser } from '@/server/auth';
import { body, handle, ok } from '@/server/http';
import { SaveLessonActivities } from '@/lib/lesson-activities';
import { listLessonActivities, saveLessonActivities } from '@/server/lesson-activities';

type Context = { params: Promise<{ id: string }> };
export const GET = handle(async (_request: Request, { params }: Context) => ok({ activities: await listLessonActivities((await getSessionUser()).id, (await params).id) }));
export const POST = handle(async (request: Request, { params }: Context) => ok({ activity: await saveLessonActivities((await getSessionUser()).id, (await params).id, await body(request, SaveLessonActivities)) }, 201));
