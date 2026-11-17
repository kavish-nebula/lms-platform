import { getSessionUser } from '@/server/auth';
import { handle, ok } from '@/server/http';
import { queueConcept } from '@/server/adapt/live';
import { continuousConceptEnabled } from '@/lib/continuous-concept';
import { continuousNarration } from '@/server/adapt/continuous-audio';
import { chalkboardEnabled, prepareChalkboard } from '@/server/adapt/chalkboard';
import { conceptRoute } from '@/lib/chalkboard';
import { getModule } from '@/data';
import * as repo from '@/server/repo';
import { learningService } from '@/server/learning/service';
import { learnerAnswers } from '@/lib/setup';

/** Enrollment/profile/release-scoped delivery; no assessment answers or keys are
 * supplied to the model, and incomplete text/audio never becomes playable. */
type Context = { params: Promise<{ courseId: string; moduleId: string; videoId: string }> };
async function view({ params }: Context, retry: boolean) {
  const { courseId, moduleId, videoId } = await params;
  const user = await getSessionUser();
  // Render retries reuse approved text and audio; they do not request a new LLM
  // derivative or discard a ready narration track.
  const job = await queueConcept(user, courseId, moduleId, videoId, retry);
  const ready = job.status === 'ready';
  const content = ready ? job.content as unknown as import('@/lib/personalized-concept').PersonalizedConcept & { audio: Record<string, string> } : undefined;
  const useBoard = chalkboardEnabled();
  const playback = content && (useBoard || continuousConceptEnabled(courseId)) ? await continuousNarration({ enrollmentId:job.enrollmentId,moduleId,revisionId:job.id,scenes:content.scenes,audio:content.audio }) : undefined;
  const mod = useBoard ? await getModule(courseId, moduleId, user.id) : null;
  const videos = mod?.blocks.find(b => b.stage === 'explainer')?.videos ?? [], index = videos.findIndex(v => v.id === videoId);
  const enrollment = useBoard ? await repo.findEnrollment(user.id, courseId) : null;
  const profile = useBoard ? await repo.getProfile(user.id) : null;
  const answers = learnerAnswers(profile?.answers, enrollment?.answers ?? {});
  let evidence: Awaited<ReturnType<typeof learningService.state>> | null = null;
  if (useBoard && moduleId === 'M1') try { evidence = await learningService.state(user.id, courseId); } catch { /* Other editions use their original progress. */ }
  const priorProgress = enrollment ? await repo.progressFor(enrollment.id) : [];
  const route = useBoard ? conceptRoute(videos[index]?.title ?? '', videos.slice(0, Math.max(0, index)).map(v => ({ title: v.title, href: `/learn/courses/${courseId}/${moduleId}/explainer?v=${v.id}`, demonstrated: !!evidence?.topics.find(t => t.id === v.id)?.disposition || priorProgress.some(p => p.moduleId === moduleId && p.stage === 'explainer') }))) : undefined;
  const chalkboard = content && playback && useBoard ? await prepareChalkboard({ enrollmentId: job.enrollmentId, moduleId, revisionId: job.id, title: videos[index]?.title ?? content.scenes[0].title, field: [answers.field, answers.domainOther, answers.studyFieldOther].filter(Boolean).join(' '), scenes: content.scenes, playback, retry }) : undefined;
  return ok({ concept: { id: job.id, status: job.status, ...(route ? { route } : {}), ...(chalkboard ? { chalkboard } : {}), ...(content ? { scenes: content.scenes.map((scene, i) => ({ ...scene, audio: content.audio[`scene${i}`] })), ...(playback ? { playback: { ...playback, ...(chalkboard?.video ? { video: chalkboard.video, captions: chalkboard.captions } : {}) } } : {}) } : {}) } });
}
export const GET = handle(async (_request: Request, context: Context) => view(context, false));
export const POST = handle(async (_request: Request, context: Context) => view(context, true));
