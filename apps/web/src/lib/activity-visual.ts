import type { AuthoredCoursePackageData } from './authored-course';

export type ActivityVideoStage = 'worked' | 'guided';
/** Keep the example and practice evidence separate from assessment answers. */
export function activityVisualSource(module: AuthoredCoursePackageData['modules'][number], stage: ActivityVideoStage) {
  const items = stage === 'worked' ? module.workedExamples : module.guidedPractice.steps;
  const title = stage === 'worked' ? `${module.title}: worked examples` : module.guidedPractice.title;
  const text = stage === 'worked'
    ? module.workedExamples.map(e => [e.title, e.problem, ...e.reasoning, e.result].join('\n')).join('\n\n')
    : [module.guidedPractice.title, module.guidedPractice.instructions, ...module.guidedPractice.steps.flatMap(s => [s.instruction, s.hint, s.evidence])].join('\n');
  return { title, text, sourceIds: [...new Set(items.flatMap(s => s.sourceIds))] };
}
