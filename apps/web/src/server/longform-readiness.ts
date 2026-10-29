import 'server-only';
import { productionState } from './module-production';
import { productionAudioState } from './production-audio';
import { narrationDurationValid } from '@/lib/longform-production';

export async function longformReadiness(userId: string, courseId: string, runId: string, moduleId: string) {
  const state = await productionState(userId, courseId, runId, moduleId);
  const plan = state.jobs.find(j => j.input.unit?.kind === 'plan' && !j.outdated);
  const planRevision = plan?.revisions[0];
  const planApproved = plan?.status === 'ready' && plan.reviews.find(r => r.revisionId === planRevision?.id)?.verdict === 'approved';
  const videos = await Promise.all(['v1', 'v2', 'v3', 'v4', 'v5'].map(async key => {
    const job = state.jobs.find(j => j.input.unit?.key === key && !j.outdated);
    const revision = job?.revisions[0];
    const scriptsApproved = job?.status === 'ready' && job.reviews.find(r => r.revisionId === revision?.id)?.verdict === 'approved';
    const audioState = job && revision ? await productionAudioState(userId, courseId, runId, moduleId, job.id) : null;
    const audio = audioState?.jobs.find(j => j.current && j.status === 'ready');
    const audioReady = !!(audio && revision && revision.content.slides.length >= 7 && revision.content.slides.length <= 9 && audio.clips.length === revision.content.slides.length && audio.clips.every(c => narrationDurationValid(c.seconds)));
    const checkpointReady = !job?.input.unit || job.input.unit.kind !== 'video' || !job.input.unit.outline.checkpoint || revision?.content.checkpoint?.questions.length === 2;
    return { checkpointReady, checkpointQuestions: revision?.content.checkpoint?.questions.length ?? 0, key, jobId: job?.id ?? null, slideCount: revision?.content.slides.length ?? 0, scriptsApproved: !!scriptsApproved, audioReady, readyClips: audio?.clips.length ?? 0, seconds: audio?.clips.reduce((n, c) => n + c.seconds, 0) ?? 0 };
  }));
  return { planApproved: !!planApproved, activitiesReady: !!planApproved, videos, ready: state.eligible && state.format === 'longform-v1' && !!planApproved && videos.every(v => v.scriptsApproved && v.audioReady && v.checkpointReady), activityMinutes: planRevision?.content.plan?.activities.activityMinutes ?? 0 };
}
