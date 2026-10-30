import type { ProjectSandboxData } from './project-sandbox';

export type GuidedReport = {
  passed: boolean; score: number; total: number; percent: number;
  criteria: { id: string; label: string; passed: boolean; earned: number; possible: number; feedback: string }[];
  missingCaseIds: string[];
};
export type GuidedWork = {
  answers: Record<string, string>; runCaseIds: string[]; stageId: string; version: number;
  report: GuidedReport | null; submissionId: string | null; submittedAt: string | null;
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const normalized = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Transparent concept checks, not an LLM judgement or an inferred proficiency score. */
export function gradeExplanations(definition: ProjectSandboxData, answers: Record<string, string>, runCaseIds: string[], rubric: string[]): GuidedReport {
  const guided = definition.guided;
  if (!guided) throw new Error('This project has no guided exploration.');
  const criteria = guided.prompts.map(prompt => {
    const criterion = definition.criteria.find(c => c.id === prompt.criterionId)!;
    const answer = answers[prompt.id] ?? '';
    const longEnough = words(answer).length >= prompt.minWords;
    const text = ` ${normalized(answer)} `;
    const conceptsPresent = prompt.conceptGroups.every(group => group.some(phrase => text.includes(` ${normalized(phrase)} `)));
    const passed = longEnough && conceptsPresent;
    return { id: criterion.id, label: rubric[criterion.rubricIndex]!, passed, earned: passed ? criterion.weight : 0, possible: criterion.weight,
      feedback: passed ? 'The explanation meets the stated length and concept checks.' : !longEnough ? `Explain your reasoning in at least ${prompt.minWords} words.` : 'Revisit the question and hint. Explain the observed result and the operation that caused it.' };
  });
  const score = criteria.reduce((n, c) => n + c.earned, 0); const total = criteria.reduce((n, c) => n + c.possible, 0);
  const missingCaseIds = definition.tests.filter(t => !runCaseIds.includes(t.id)).map(t => t.id);
  return { passed: missingCaseIds.length === 0 && score * 100 >= total * (definition.passPercent ?? 100), score, total, percent: total ? score * 100 / total : 0, criteria, missingCaseIds };
}
