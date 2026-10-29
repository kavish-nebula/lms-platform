import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from './db/client';
import { authoredProjectWork, authoredProjectSubmissions, enrollments, publishedAuthoredCourses } from './db/schema';
import { getPublishedAuthoredCourse } from './authored-publication';
import { findEnrollment } from './repo';
import { ApiError } from './http';
import { SandboxArtifact, gradeSandbox, publicSandbox, runSandbox, type SandboxWork, type SandboxArtifactData } from '@/lib/project-sandbox';

export const SandboxRequest = z.object({ revisionId: z.uuid(), version: z.number().int().nonnegative(), artifact: SandboxArtifact, action: z.enum(['save', 'run', 'test', 'submit']) }).strict();

export async function sandboxProject(courseId: string) {
  const release = await getPublishedAuthoredCourse(courseId);
  const project = release?.content.courseEnd.miniProject;
  if (!release || !project?.sandbox) throw new ApiError(404, 'no_sandbox', 'This released course has no configured project sandbox.');
  return { release, project, definition: project.sandbox };
}

export async function publicSandboxProject(courseId: string) {
  const { release, project, definition } = await sandboxProject(courseId);
  return { courseId, revisionId: release.revisionId, title: project.title, brief: project.brief, deliverable: project.deliverable, rubric: project.rubric, sandbox: publicSandbox(definition) };
}
export type PublicSandboxProject = Awaited<ReturnType<typeof publicSandboxProject>>;

async function scoped(userId: string, courseId: string, revisionId: string) {
  const context = await sandboxProject(courseId);
  if (context.release.revisionId !== revisionId) throw new ApiError(409, 'release_changed', 'The published project changed. Reload the course; your previous release draft is retained.');
  const enrollment = await findEnrollment(userId, courseId);
  if (!enrollment) throw new ApiError(403, 'not_enrolled', 'Enroll in this course to save or submit its project.');
  return { ...context, enrollment };
}

export async function sandboxWork(userId: string, courseId: string, revisionId: string): Promise<SandboxWork> {
  const { enrollment } = await scoped(userId, courseId, revisionId);
  const [work] = await (await db()).select().from(authoredProjectWork).where(and(eq(authoredProjectWork.enrollmentId, enrollment.id), eq(authoredProjectWork.revisionId, revisionId)));
  return work ? { artifact: work.artifact, version: work.version, report: work.report, submissionId: work.submissionId, submittedAt: work.submittedAt?.toISOString() ?? null } : { artifact: null, version: 0, report: null, submissionId: null, submittedAt: null };
}

function checkFields(artifact: SandboxArtifactData, fields: { id: string }[]) {
  if (Object.keys(artifact.values).length !== fields.length || fields.some(f => !Object.hasOwn(artifact.values, f.id))) throw new ApiError(400, 'invalid_artifact', 'The artifact must contain exactly the project fields.');
}

export async function sandboxAction(userId: string, courseId: string, request: z.infer<typeof SandboxRequest>) {
  const input = SandboxRequest.parse(request);
  const { definition, enrollment } = await scoped(userId, courseId, input.revisionId);
  checkFields(input.artifact, definition.fields);
  if (input.action === 'run') return { run: runSandbox(input.artifact, Object.fromEntries(definition.inputs.map(i => [i.id, i.sample]))) };
  if (input.action === 'test') return { report: gradeSandbox(definition, input.artifact) };
  const database = await db();
  return database.transaction(async tx => {
    const [release] = await tx.select().from(publishedAuthoredCourses).where(eq(publishedAuthoredCourses.courseId, courseId)).for('update');
    if (release?.revisionId !== input.revisionId) throw new ApiError(409, 'release_changed', 'The published project changed. Reload before saving.');
    await tx.select().from(enrollments).where(eq(enrollments.id, enrollment.id)).for('update');
    const where = and(eq(authoredProjectWork.enrollmentId, enrollment.id), eq(authoredProjectWork.revisionId, input.revisionId));
    const [old] = await tx.select().from(authoredProjectWork).where(where);
    if ((old?.version ?? 0) !== input.version) throw new ApiError(409, 'project_conflict', 'Another tab saved newer work. Your draft is retained; reload the server copy before saving again.');
    const report = input.action === 'submit' ? gradeSandbox(definition, input.artifact) : null;
    const submittedAt = report ? new Date() : null;
    let submissionId: string | null = null;
    if (report) {
      const [submission] = await tx.insert(authoredProjectSubmissions).values({ enrollmentId: enrollment.id, revisionId: input.revisionId, artifact: input.artifact, report }).returning();
      submissionId = submission.id;
    }
    const work = { enrollmentId: enrollment.id, revisionId: input.revisionId, artifact: input.artifact, version: input.version + 1, report, submittedAt, submissionId, updatedAt: new Date() };
    await tx.insert(authoredProjectWork).values(work).onConflictDoUpdate({ target: [authoredProjectWork.enrollmentId, authoredProjectWork.revisionId], set: work });
    return { work: { artifact: work.artifact, version: work.version, report, submittedAt: submittedAt?.toISOString() ?? null, submissionId } satisfies SandboxWork };
  });
}
