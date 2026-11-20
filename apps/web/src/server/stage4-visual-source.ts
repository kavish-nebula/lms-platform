import 'server-only';
import { createHash } from 'node:crypto';
import { listBlueprints } from './creator-blueprints';
import { getCreatorDraft } from './content-creator';
import { getSmeReview } from './creator-sme-review';
import { ApiError } from './http';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './db/client';
import { creatorAuthoredCourseRevisions } from './db/schema';
import { activityVisualSource } from '@/lib/activity-visual';

/** Reviewed SME evidence, not a published package, is the Stage 4 input. */
export async function stage4VisualTargets(ownerId: string, courseId: string, moduleId?: string) {
  const course = await getCreatorDraft(ownerId, courseId);
  const run = (await listBlueprints(ownerId, courseId)).find(r => r.status === 'ready' && !r.outdated);
  if (!run?.output) throw new ApiError(409, 'visual_blueprint_required', 'Generate and review the current blueprint before creating module videos.');
  const reviews = await getSmeReview(ownerId, courseId, run.id);
  const modules = course.brief.sourceLibrary?.modules ?? [];
  const [prepared] = await (await db()).select().from(creatorAuthoredCourseRevisions).where(and(eq(creatorAuthoredCourseRevisions.courseId, courseId), eq(creatorAuthoredCourseRevisions.ownerId, ownerId), eq(creatorAuthoredCourseRevisions.briefRevision, course.revision))).orderBy(desc(creatorAuthoredCourseRevisions.version)).limit(1);
  const approved = modules.filter(m => (!moduleId || m.id === moduleId) && reviews.summary.latest[m.id]?.verdict === 'approved' && Object.values(reviews.summary.latest[m.id].checklist).every(Boolean));
  if (moduleId && !approved.length) throw new ApiError(409, 'visual_approval_required', 'Approve this module with all seven Stage 3 checks before creating videos.');
  return approved.flatMap(module => {
    const approval = reviews.summary.latest[module.id];
    const all = run.input.sources.filter(s => s.scope === 'course' || s.moduleId === module.id);
    const hook = all.filter(s => s.moduleId === module.id && s.purpose === 'problem-hook');
    const targets = [
      ...(hook.length ? [{ videoId: `draft_${module.id}_hook`, title: course.brief.sourceLibrary!.sources.find(s => s.id === hook[0].id)!.title, kind: 'hook' as const, selected: hook }] : []),
      ...module.topics.map(topic => ({ videoId: `draft_${topic.id}`, title: topic.title, kind: 'concept' as const, selected: all.filter(s => s.topicId === topic.id && s.purpose !== 'problem-hook') })),
    ];
    const teachingTargets = targets.filter(target => target.selected.some(s => s.text.trim())).map(target => {
      const records = [...target.selected, ...all.filter(s => s.scope === 'course')];
      const text = records.map(s => s.text).join('\n\n');
      const context = { systemPrompt: course.brief.systemPrompt, instructions: module.instructions, objectives: run.input.objectives.filter(o => module.instructions?.objectiveIds.includes(o.id)), audience: course.brief.audience };
      return { courseId, courseTitle: course.brief.title, moduleId: module.id, videoId: target.videoId, title: target.title, kind: target.kind, origin: 'stage4' as const, runId: run.id, approvalId: approval.id, briefRevision: course.revision, releaseId: null, sourceIds: records.map(s => s.id), text, context,
        identity: createHash('sha256').update(JSON.stringify({ version: 'stage4-visual-v1', briefRevision: course.revision, runId: run.id, approvalId: approval.id, target: target.videoId, records, context })).digest('hex') };
    });
    const unit = prepared?.content.modules.find(m => m.id === module.id);
    const activityTargets = unit ? (['worked', 'guided'] as const).map(kind => {
      const activity = activityVisualSource(unit, kind);
      const records = all.filter(s => activity.sourceIds.includes(s.id));
      const context = { systemPrompt: course.brief.systemPrompt, instructions: module.instructions, objectives: run.input.objectives.filter(o => unit.objectiveIds.includes(o.id)), audience: course.brief.audience };
      const videoId = `draft_${module.id}_${kind}`;
      return { courseId, courseTitle: course.brief.title, moduleId: module.id, videoId, title: activity.title, kind, origin: 'stage4' as const, runId: run.id, approvalId: approval.id, briefRevision: course.revision, releaseId: null, sourceIds: activity.sourceIds, text: [activity.text, ...records.map(s => s.text)].join('\n\n'), context,
        identity: createHash('sha256').update(JSON.stringify({ version: 'stage4-activity-v1', briefRevision: course.revision, runId: run.id, approvalId: approval.id, videoId, activity, records, context })).digest('hex') };
    }) : [];
    return [...teachingTargets, ...activityTargets];
  });
}
export async function stage4VisualSource(ownerId: string, courseId: string, videoId: string) {
  const target = (await stage4VisualTargets(ownerId, courseId)).find(t => t.videoId === videoId);
  if (!target) throw new ApiError(409, 'visual_approval_required', 'This topic has no current Stage 3 approval or teaching source. Recheck the module in Stage 3.');
  return target;
}
