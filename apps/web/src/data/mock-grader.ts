/**
 * MOCK ONLY. Stands in for POST /v1/assessment-attempts/{id}/submit so the
 * final-check UI can be exercised without a backend. In the real system the
 * answer key never reaches the browser (backend-plan.md section 7). Delete
 * this file and fixtures/mock-gate-keys.json when the Player API exists.
 */
import keysJson from "@lms/fixtures/mock-gate-keys.json";
import type { GateBlock } from "./types";
import { exactChoices } from '@/lib/assessment-answers';

const KEYS = keysJson as unknown as Record<string, Record<string, string | string[]>>;

export type GateResponse = string | string[] | undefined;

export type GateResult = {
  score: number;
  total: number;
  ratio: number;
  passed: boolean;
  perObjective: { objective_id: string; correct: number; total: number }[];
  failedObjectives: string[];
  /** per question: right or not, and why (shown only once the check is passed) */
  review: { id: string; correct: boolean; explain?: string }[];
};

function isCorrect(key: string | string[] | undefined, response: GateResponse) {
  if (key == null || response == null) return false;
  if (Array.isArray(key)) {
    return exactChoices(Array.isArray(response) ? response : [response], key);
  }
  if (Array.isArray(response) && response.length !== 1) return false;
  const value = Array.isArray(response) ? response[0] : response;
  return (value ?? "").trim().toLowerCase() === key;
}

/**
 * Pre-check: right answers per lesson (0-2). Ungraded, never shown as a
 * score; it only sets how much support each lesson opens with.
 */
export function scorePrecheck(items: { id: string; lesson: string }[], responses: Record<string, string | null>) {
  const keys = KEYS.precheck ?? {};
  const lessons: Record<string, number> = {};
  for (const item of items) {
    lessons[item.lesson] ??= 0;
    if (responses[item.id] && responses[item.id] === keys[item.id]) lessons[item.lesson]! += 1;
  }
  return lessons;
}

export async function gradeGate(
  checkId: string,
  block: GateBlock,
  responses: Record<string, GateResponse>,
): Promise<GateResult> {
  if (block.authoredAssessment) {
    const { courseId, revisionId, moduleId } = block.authoredAssessment;
    const response = await fetch(`/api/v1/courses/${courseId}/assessment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId, moduleId, responses }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? 'Could not check your answers. Please retry.');
    return result.result as GateResult;
  }
  // Simulate network latency so loading states are visible.
  await new Promise((r) => setTimeout(r, 600));
  const keys = KEYS[checkId] ?? {};
  const explain = KEYS[`${checkId}_explain`] ?? {};
  return gradeWithKeys(block, responses, keys, explain);
}

/** The same scoring rule with a server-selected key for a released package. */
export function gradeWithKeys(block: GateBlock, responses: Record<string, GateResponse>, keys: Record<string, string | string[]>, explain: Record<string, string | string[]> = {}): GateResult {
  const review: GateResult["review"] = [];

  const per = new Map<string, { correct: number; total: number }>();
  let score = 0;
  for (const item of block.items) {
    const ok = isCorrect(keys[item.id], responses[item.id]);
    if (ok) score++;
    const why = explain[item.id];
    review.push({ id: item.id, correct: ok, explain: typeof why === "string" ? why : undefined });
    for (const objective of new Set(item.objective_ids ?? [item.objective_id])) {
      const row = per.get(objective) ?? { correct: 0, total: 0 };
      row.total++;
      if (ok) row.correct++;
      per.set(objective, row);
    }
  }

  const total = block.items.length;
  const ratio = total ? score / total : 0;
  const perObjective = block.objectives_tested.map((objective_id) => ({
    objective_id,
    ...(per.get(objective_id) ?? { correct: 0, total: 0 }),
  }));
  // to revisit: any area with no right answer (a module check passes on the overall score alone,
  // but a lesson missed entirely is still worth pointing back to)
  const failedObjectives = perObjective
    .filter((o) => o.total > 0 && o.correct < Math.max(1, block.min_correct_per_objective))
    .map((o) => o.objective_id);
  const eachArea = perObjective.every((o) => o.total === 0 || o.correct >= block.min_correct_per_objective);

  return {
    score,
    total,
    ratio,
    passed: ratio >= block.pass_threshold && eachArea,
    perObjective,
    failedObjectives,
    review,
  };
}
