import { getSessionUser } from '@/server/auth';
import { ApiError, handle, ok } from '@/server/http';
import { queueModule } from '@/server/adapt/live';
import { chalkboardEnabled, prepareChalkboard } from '@/server/adapt/chalkboard';
import { continuousNarration } from '@/server/adapt/continuous-audio';
import { hookScenes, hookTeachingScene, type VideoHook } from '@/lib/video-first-hook';
import * as repo from '@/server/repo';
import { learnerAnswers } from '@/lib/setup';

type Context = { params: Promise<{ courseId: string; moduleId: string }> };
async function view(context: Context, retry: boolean) {
  if (!chalkboardEnabled()) return ok({ enabled: false });
  const { courseId, moduleId } = await context.params, user = await getSessionUser();
  const current = await queueModule(user, courseId, moduleId, 'hook');
  const job = current.activities.find(j => j.videoId === 'activity:hook');
  if (!job || job.status !== 'ready') return ok({ enabled: true, status: job?.status ?? 'queued' });
  const content = job.content as unknown as { problemHook: VideoHook; audio: Record<string, string> };
  if (!content.problemHook || !content.audio) throw new ApiError(409, 'hook_unavailable', 'Matching case narration is not ready.');
  const scenes = hookScenes(content.problemHook).map(s => ({ ...hookTeachingScene(s, content.problemHook.title), sourceIds: content.problemHook.sourceIds, objectiveIds: content.problemHook.objectiveIds }));
  const playback = await continuousNarration({ enrollmentId: job.enrollmentId, moduleId, revisionId: job.id, scenes, audio: content.audio });
  const enrollment = await repo.findEnrollment(user.id, courseId), profile = await repo.getProfile(user.id);
  const answers = learnerAnswers(profile?.answers, enrollment?.answers ?? {});
  const chalkboard = await prepareChalkboard({ enrollmentId: job.enrollmentId, moduleId, revisionId: job.id, title: content.problemHook.title, field: [answers.field, answers.domainOther, answers.studyFieldOther].filter(Boolean).join(' '), scenes, playback, retry });
  return ok({ enabled: true, status: chalkboard.status, id: job.id, hook: content.problemHook, scenes, chalkboard, playback: { ...playback, video: chalkboard.video, captions: chalkboard.captions } });
}
export const GET = handle(async (_request: Request, context: Context) => view(context, false));
export const POST = handle(async (_request: Request, context: Context) => view(context, true));
