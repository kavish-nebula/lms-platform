/** Shared choice semantics for authored packages, video checks and server grading. */
export type ChoiceKey = { correct?: number; correctIndices?: number[]; selectionType?: 'single' | 'multiple' };

export function correctChoiceIndices(question: ChoiceKey): number[] {
  return question.selectionType === 'multiple' ? question.correctIndices ?? [] : question.correct === undefined ? [] : [question.correct];
}

/** No partial credit: missing, extra or repeated selections do not match. */
export function exactChoices<T extends string | number>(response: readonly T[], key: readonly T[]): boolean {
  return key.length > 0 && response.length === key.length && new Set(response).size === response.length && key.every(choice => response.includes(choice));
}
