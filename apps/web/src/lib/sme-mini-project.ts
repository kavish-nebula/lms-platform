import { z } from 'zod/v4';
import type { CourseBriefData } from './content-creator';
import type { AuthoredCoursePackageData } from './authored-course';

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,29}$/);
const text = z.string().max(12000);
export const MiniProjectTask = z.object({
  id, title: z.string().max(200), instruction: text, expectedEvidence: text, criterion: text,
  moduleIds: z.array(id).max(12), objectiveIds: z.array(id).max(60), sourceIds: z.array(id).max(60),
}).strict();
export const MiniProjectPlan = z.object({ title: z.string().max(200), brief: text, deliverable: text, tasks: z.array(MiniProjectTask).max(30) }).strict();
export type MiniProjectPlanData = z.infer<typeof MiniProjectPlan>;

export function miniProjectPlanIssues(brief: { sourceLibrary?: CourseBriefData['sourceLibrary']; objectives: { text: string }[] }) {
  const library = brief.sourceLibrary, plan = library?.miniProject;
  if (!plan) return [];
  const issues: string[] = [];
  const objectives = new Set(brief.objectives.flatMap((o, i) => o.text.trim() ? [`O${i + 1}`] : []));
  if (!plan.title.trim() || !plan.brief.trim() || !plan.deliverable.trim() || !plan.tasks.length) issues.push('Mini project: supply a name, task brief, final deliverable and at least one task.');
  for (const task of plan.tasks) {
    if (!task.title.trim() || !task.instruction.trim() || !task.expectedEvidence.trim() || !task.criterion.trim()) issues.push(`${task.id}: complete the task, instructions, expected evidence and success criterion.`);
    if (!task.moduleIds.length || task.moduleIds.some(id => !library.modules.some(m => m.id === id))) issues.push(`${task.id}: select existing course modules.`);
    if (!task.objectiveIds.length || task.objectiveIds.some(id => !objectives.has(id))) issues.push(`${task.id}: map the task to course objectives.`);
    if (!task.sourceIds.length || task.sourceIds.some(id => !library.sources.some(s => s.id === id && !s.purpose))) issues.push(`${task.id}: cite existing teaching sources, not assessment or activity answers.`);
  }
  for (const unit of library.modules) if (!plan.tasks.some(t => t.moduleIds.includes(unit.id))) issues.push(`Mini project: include a task applying ${unit.id}.`);
  for (const [i, objective] of brief.objectives.entries()) if (objective.text.trim() && !plan.tasks.some(t => t.objectiveIds.includes(`O${i + 1}`))) issues.push(`Mini project: include objective O${i + 1}.`);
  return issues;
}

/** A task brief is an assembly input, not a claim that a runnable workspace exists. */
export function smeMiniProject(brief: CourseBriefData) {
  const plan = brief.sourceLibrary?.miniProject;
  if (!plan) return undefined;
  const tasks = plan.tasks.map(t => ({ ...t, title: t.title.trim(), instruction: t.instruction.trim(), expectedEvidence: t.expectedEvidence.trim(), criterion: t.criterion.trim() }));
  return { title: plan.title.trim(), brief: plan.brief.trim(), deliverable: plan.deliverable.trim(), tasks, rubric: tasks.map(t => t.criterion), objectiveIds: [...new Set(tasks.flatMap(t => t.objectiveIds))], sourceIds: [...new Set(tasks.flatMap(t => t.sourceIds))] };
}

export function smeMiniProjectIssues(project: AuthoredCoursePackageData['courseEnd']['miniProject'], brief: CourseBriefData) {
  const expected = smeMiniProject(brief);
  if (!expected) return [];
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  const changed = Object.entries(expected).some(([key, value]) => JSON.stringify(canonical(project[key as keyof typeof expected])) !== JSON.stringify(canonical(value)));
  const issues = changed ? ['Preserve the saved SME mini-project name, task brief, deliverable, task IDs, instructions, criteria and coverage links.'] : [];
  if (!project.sandbox?.guided) issues.push('Prepare a ready-made in-course guided workflow, cases and explanation grading before publishing this mini-project workspace.');
  return issues;
}
