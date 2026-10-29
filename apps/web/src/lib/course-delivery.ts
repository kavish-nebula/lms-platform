export const DELIVERY_STRUCTURES = ['legacy', 'six-stage-v1', 'codex-ild-v2'] as const;
export type DeliveryStructure = typeof DELIVERY_STRUCTURES[number];
export const MODULE_FLOW = ['hook', 'concept', 'worked_example', 'guided_practice', 'scenario', 'quiz'] as const;
export const COURSE_END_FLOW = ['mastery_gate', 'reflection', 'spaced_review'] as const;
export const CODEX_MODULE_FLOW = ['hook', 'concept', 'worked_example', 'guided_practice', 'scenario'] as const;
export const CODEX_COURSE_END_FLOW = ['mini_project', 'mastery_gate', 'reflection'] as const;
export const STAGE_LABELS: Record<string, string> = { hook: 'Problem Hook', concept: 'Concept Explainer', worked_example: 'Worked Example', guided_practice: 'Guided Practice', scenario: 'Scenario Lab', quiz: 'Formative checks in each video', mini_project: 'Mini Project', mastery_gate: 'Mastery Gate', reflection: 'Reflection', spaced_review: 'Spaced Review' };

/** Delivery layout is separate from immutable SME source and media revisions. */
export function moduleDeliverySteps(steps: { kind: string; activity: string; minutes: number }[]) {
  return MODULE_FLOW.map(kind => ({ kind, activity: steps.find(s => s.kind === kind)?.activity ?? (kind === 'quiz' ? 'Check this module’s concepts with its module quiz; course-wide mastery is assessed after the last module.' : 'Prepare this learning stage from the reviewed module sources.'), minutes: steps.find(s => s.kind === kind)?.minutes }));
}
