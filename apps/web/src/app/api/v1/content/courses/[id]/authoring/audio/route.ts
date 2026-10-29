import { after } from 'next/server';
import { getSessionUser } from '@/server/auth';
import { authoredCourseAudioState, startAuthoredCourseAudio, processAuthoredCourseAudio } from '@/server/authored-course-audio';
import { body, handle, ok } from '@/server/http';
import { z } from 'zod/v4';

type Context = { params: Promise<{ id: string }> };
const Start = z.object({ revisionId: z.uuid() }).strict();
export const GET = handle(async (request: Request, { params }: Context) => {
  const user = await getSessionUser(); const { id } = await params; const revisionId = new URL(request.url).searchParams.get('revisionId') ?? undefined;
  if (revisionId && !z.uuid().safeParse(revisionId).success) return ok({ error: { code: 'invalid_revision', message: 'Revision ID must be a UUID.' } }, 400);
  return ok(await authoredCourseAudioState(user.id, id, revisionId));
});
export const POST = handle(async (request: Request, { params }: Context) => {
  const user = await getSessionUser(); const { id } = await params; const input = await body(request, Start);
  await authoredCourseAudioState(user.id, id, input.revisionId);
  const job = await startAuthoredCourseAudio(user.id, id, input.revisionId);
  if (job.token) after(async () => processAuthoredCourseAudio(job.id, job.token!, user.id, id));
  return ok({ jobId: job.id, status: job.status, started: !!job.token }, job.token ? 202 : 200);
});
