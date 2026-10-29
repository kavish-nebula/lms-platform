import 'server-only';
import { z } from 'zod/v4';
import { getPublishedAuthoredCourse } from './authored-publication';
import { authoredDelivery } from '@/lib/authored-delivery';
import { correctChoiceIndices } from '@/lib/assessment-answers';
import { gradeWithKeys } from '@/data/mock-grader';
import { ApiError } from './http';

export const AuthoredAssessmentInput = z.object({
  revisionId: z.uuid(), moduleId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).optional(),
  responses: z.record(z.string().max(80), z.union([z.string().max(10), z.array(z.string().max(10)).max(5)])).refine(r => Object.keys(r).length <= 100),
}).strict();

/** Always select keys from the published snapshot, never from a learner payload. */
export async function gradeAuthoredAssessment(courseId: string, request: z.infer<typeof AuthoredAssessmentInput>) {
  const input = AuthoredAssessmentInput.parse(request);
  const release = await getPublishedAuthoredCourse(courseId);
  if (!release) throw new ApiError(404, 'not_found', 'Released course not found.');
  if (release.revisionId !== input.revisionId) throw new ApiError(409, 'release_changed', 'The released course changed. Reload before submitting your answers.');
  const courseModule = input.moduleId === undefined ? undefined : release.content.modules.find(m => m.id === input.moduleId);
  if (input.moduleId !== undefined && !courseModule?.moduleQuiz) throw new ApiError(404, 'not_found', 'Released module quiz not found.');
  const questions = courseModule ? courseModule.moduleQuiz!.questions : release.content.courseEnd.masteryGate.questions;
  for (const [id, response] of Object.entries(input.responses)) {
    const question = questions.find(q => q.id === id);
    const values = Array.isArray(response) ? response : [response];
    if (!question || (question.selectionType === 'multiple') !== Array.isArray(response) || new Set(values).size !== values.length || values.some(value => !question.choices.some((_, i) => String(i) === value))) {
      throw new ApiError(400, 'invalid_answer', 'Unknown question, selection type or answer option.');
    }
  }
  const delivery = authoredDelivery(release);
  const block = courseModule ? delivery.modules.find(m => m.module_id === courseModule.id)!.blocks.find(b => b.stage === 'gate')! : delivery.finale.final;
  if (block.stage !== 'gate') throw new ApiError(404, 'not_found', 'Released assessment not found.');
  const keys = Object.fromEntries(questions.map(q => [q.id, q.selectionType === 'multiple' ? correctChoiceIndices(q).map(String) : String(q.correct)]));
  const explanations = Object.fromEntries(questions.map(q => [q.id, q.explanation]));
  const result = gradeWithKeys(block, input.responses, keys, explanations);
  // Preserve the no-feedback-until-passed rule on the wire, not just in the UI.
  if (!result.passed) result.review = result.review.map(({ id, correct }) => ({ id, correct }));
  return result;
}
