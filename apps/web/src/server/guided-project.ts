import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from './db/client';
import { enrollments, guidedProjectWork, guidedProjectSubmissions, publishedAuthoredCourses } from './db/schema';
import { sandboxProject } from './project-sandbox';
import { findEnrollment } from './repo';
import { ApiError } from './http';
import { runSandbox } from '@/lib/project-sandbox';
import { gradeExplanations, type GuidedWork } from '@/lib/guided-project';

export const GuidedRequest = z.object({
  revisionId: z.uuid(), version: z.number().int().nonnegative(), action: z.enum(['save', 'run', 'submit']),
  stageId: z.string().min(1).max(60),
  answers: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,59}$/), z.string().max(4000)).refine(a => Object.keys(a).length <= 30),
  caseId: z.string().min(1).max(60).optional(),
}).strict();

async function scope(userId: string, courseId: string, revisionId: string) {
  const context = await sandboxProject(courseId);
  if (context.release.revisionId !== revisionId) throw new ApiError(409, 'release_changed', 'This project has a newer release. Reload; your earlier explanations are retained.');
  if (!context.definition.guided) throw new ApiError(404, 'not_guided', 'This project does not have a guided exploration.');
  const enrollment = await findEnrollment(userId, courseId);
  if (!enrollment) throw new ApiError(403, 'not_enrolled', 'Enroll in this course to run examples or submit explanations.');
  return { ...context, guided: context.definition.guided, enrollment };
}

const view = (row: typeof guidedProjectWork.$inferSelect): GuidedWork => ({ answers: row.answers, runCaseIds: row.runCaseIds, stageId: row.stageId, version: row.version, report: row.report, submissionId: row.submissionId, submittedAt: row.submittedAt?.toISOString() ?? null });

export async function guidedWork(userId: string, courseId: string, revisionId: string): Promise<GuidedWork> {
  const { enrollment, guided } = await scope(userId, courseId, revisionId);
  const [row] = await (await db()).select().from(guidedProjectWork).where(and(eq(guidedProjectWork.enrollmentId, enrollment.id), eq(guidedProjectWork.revisionId, revisionId)));
  return row ? view(row) : { answers: {}, runCaseIds: [], stageId: guided.stages[0]!.id, version: 0, report: null, submissionId: null, submittedAt: null };
}

export async function guidedAction(userId: string, courseId: string, request: z.infer<typeof GuidedRequest>) {
  const input = GuidedRequest.parse(request);
  const { definition, project, guided, enrollment } = await scope(userId, courseId, input.revisionId);
  if (!guided.stages.some(s => s.id === input.stageId) || Object.keys(input.answers).some(id => !guided.prompts.some(p => p.id === id))) throw new ApiError(400, 'invalid_explanation', 'Use only this project’s stages and explanation questions.');
  const test = input.action === 'run' ? definition.tests.find(t => t.id === input.caseId) : undefined;
  if (input.action === 'run' && !test) throw new ApiError(400, 'invalid_case', 'Choose one of the supplied examples.');
  // The implementation and inputs always come from the released package, never the request.
  const run = test ? runSandbox(guided.artifact, test.inputs) : undefined;
  if (run?.error) throw new ApiError(422, 'example_failed', 'The supplied example could not run. Your explanations have been retained.');
  return (await db()).transaction(async tx => {
    const [release] = await tx.select().from(publishedAuthoredCourses).where(eq(publishedAuthoredCourses.courseId, courseId)).for('update');
    if (release?.revisionId !== input.revisionId) throw new ApiError(409, 'release_changed', 'The released project changed. Reload before saving.');
    await tx.select().from(enrollments).where(eq(enrollments.id, enrollment.id)).for('update');
    const where = and(eq(guidedProjectWork.enrollmentId, enrollment.id), eq(guidedProjectWork.revisionId, input.revisionId));
    const [old] = await tx.select().from(guidedProjectWork).where(where);
    if ((old?.version ?? 0) !== input.version) throw new ApiError(409, 'project_conflict', 'Another tab saved newer explanations. Your text is retained; reload the saved copy to reconcile.');
    const runCaseIds = [...new Set([...(old?.runCaseIds ?? []), ...(test ? [test.id] : [])])];
    const changed = !old || JSON.stringify(Object.entries(old.answers).sort()) !== JSON.stringify(Object.entries(input.answers).sort());
    const report = input.action === 'submit' ? gradeExplanations(definition, input.answers, runCaseIds, project.rubric) : changed ? null : old.report;
    if (input.action === 'submit' && (report!.missingCaseIds.length || guided.prompts.some(p => !input.answers[p.id]?.trim()))) throw new ApiError(400, 'project_incomplete', 'Run both examples and answer every explanation question before submitting.');
    let submissionId: string | null = changed ? null : old?.submissionId ?? null;
    const submittedAt = input.action === 'submit' ? new Date() : changed ? null : old?.submittedAt ?? null;
    if (input.action === 'submit') {
      const [submission] = await tx.insert(guidedProjectSubmissions).values({ enrollmentId: enrollment.id, revisionId: input.revisionId, answers: input.answers, runCaseIds, report: report! }).returning();
      submissionId = submission.id;
    }
    const row = { enrollmentId: enrollment.id, revisionId: input.revisionId, answers: input.answers, runCaseIds, stageId: input.stageId, version: input.version + 1, report, submissionId, submittedAt, updatedAt: new Date() };
    await tx.insert(guidedProjectWork).values(row).onConflictDoUpdate({ target: [guidedProjectWork.enrollmentId, guidedProjectWork.revisionId], set: row });
    return { work: view(row), ...(run ? { run, caseId: test!.id } : {}) };
  });
}
