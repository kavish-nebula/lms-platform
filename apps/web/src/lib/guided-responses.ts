/** Browser practice drafts are separate from graded evidence and completion. */
export type PracticeResponse = { answer: string; comparedAnswer?: string };
export type PracticeResponses = Record<string, PracticeResponse>;

export function guidedResponseKey(courseId: string, moduleId: string, edition: string) {
  return `lms-guided-responses:v1:${courseId}:${moduleId}:${encodeURIComponent(edition)}`;
}

export function readPracticeResponses(raw: string | null, stepIds: string[]): PracticeResponses {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== 1 || !parsed.responses || typeof parsed.responses !== 'object') return {};
    return Object.fromEntries(stepIds.flatMap(id => {
      const item = parsed.responses[id];
      if (typeof item?.answer !== 'string') return [];
      const answer = item.answer.slice(0, 6000);
      return [[id, { answer, ...(typeof item.comparedAnswer === 'string' && item.comparedAnswer === answer.trim() ? { comparedAnswer: item.comparedAnswer } : {}) }]];
    }));
  } catch { return {}; }
}

export function updatePracticeAnswer(responses: PracticeResponses, id: string, answer: string): PracticeResponses {
  // Editing after comparison requires another self-review, not a stale checkmark.
  return { ...responses, [id]: { answer: answer.slice(0, 6000) } };
}

export function comparePracticeAnswer(responses: PracticeResponses, id: string): PracticeResponses {
  const answer = responses[id]?.answer ?? '';
  return answer.trim() ? { ...responses, [id]: { answer, comparedAnswer: answer.trim() } } : responses;
}

export function practiceResponsesReady(responses: PracticeResponses, stepIds: string[]) {
  return stepIds.length > 0 && stepIds.every(id => !!responses[id]?.answer.trim() && responses[id].comparedAnswer === responses[id].answer.trim());
}
