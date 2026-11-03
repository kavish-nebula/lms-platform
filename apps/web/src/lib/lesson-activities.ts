import { z } from 'zod/v4';
import { AuthoredCoursePackage } from './authored-course';
import type { CourseBriefData } from './content-creator';

const unit = AuthoredCoursePackage.shape.modules.element;
// Teaching-only handoffs are deliberately separate from validated course packages.
export const LessonActivities = unit.pick({ problemHook: true, workedExamples: true, guidedPractice: true });
export const SaveLessonActivities = z.object({
  expectedBriefRevision: z.number().int().positive(),
  moduleId: z.string().max(30), topicId: z.string().max(30), title: z.string().trim().min(1).max(200),
  sourceSnapshots: z.array(z.object({ sourceId: z.string().max(30), revision: z.number().int().positive(), assetId: z.uuid().optional(), evidenceText: z.string().trim().min(1).max(100000) }).strict()).min(1).max(30),
  content: LessonActivities,
}).strict();
export type LessonActivityInput = z.infer<typeof SaveLessonActivities>;
export type LessonActivityDraft = Omit<LessonActivityInput, 'expectedBriefRevision'> & {
  id: string; courseId: string; briefRevision: number; createdAt: string; status: 'needs_review'; outdated: boolean;
};

export function lessonActivityIssues(input: LessonActivityInput, brief: CourseBriefData): string[] {
  const issues: string[] = [];
  const unit = brief.sourceLibrary?.modules.find(m => m.id === input.moduleId);
  if (!unit?.topics.some(t => t.id === input.topicId)) issues.push('Choose a topic in the saved module outline.');
  const snapshots = new Map(input.sourceSnapshots.map(s => [s.sourceId, s]));
  if (snapshots.size !== input.sourceSnapshots.length) issues.push('Source snapshots must be unique.');
  for (const snapshot of input.sourceSnapshots) {
    const source = brief.sourceLibrary?.sources.find(s => s.id === snapshot.sourceId);
    if (!source || source.scope !== 'topic' || source.moduleId !== input.moduleId || source.topicId !== input.topicId) issues.push(`Source ${snapshot.sourceId} does not belong to this topic.`);
    else if (source.revision !== snapshot.revision || source.video?.assetId !== snapshot.assetId) issues.push(`Source ${snapshot.sourceId} changed; refresh its evidence before saving.`);
  }
  const linked = [input.content.problemHook, ...input.content.workedExamples, ...input.content.guidedPractice.steps];
  for (const item of linked) {
    for (const sourceId of item.sourceIds) if (!snapshots.has(sourceId)) issues.push(`Missing evidence snapshot ${sourceId}.`);
    for (const objective of item.objectiveIds) {
      if (!/^O[1-9]\d*$/.test(objective) || !brief.objectives[Number(objective.slice(1)) - 1]?.text.trim()) issues.push(`Unknown objective ${objective}.`);
      else if (!item.sourceIds.some(id => brief.sourceLibrary?.sources.find(s => s.id === id)?.objectiveIds.includes(objective))) issues.push(`Supply mapped evidence for ${objective}.`);
    }
  }
  const ids = [...input.content.workedExamples.map(e => e.id), ...input.content.guidedPractice.steps.map(s => s.id)];
  if (new Set(ids).size !== ids.length) issues.push('Activity IDs must be unique.');
  return [...new Set(issues)];
}
