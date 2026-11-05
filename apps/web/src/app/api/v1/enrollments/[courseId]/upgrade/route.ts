import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { body, handle, ok } from '@/server/http';
import { upgradeEnrollment } from '@/server/repo';
import { enrollmentOf } from '@/server/planner/service';
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
 const {courseId}=await params;const user=await getSessionUser();const {findEnrollment}=await import('@/server/repo');const {getPublishedAuthoredCourse}=await import('@/server/authored-publication');
 const enrollment=await findEnrollment(user.id,courseId);const latest=await getPublishedAuthoredCourse(courseId);const current=enrollment?await getPublishedAuthoredCourse(courseId,user.id):undefined;
 const {db}=await import('@/server/db/client');const {enrollments,courseEditions,creatorAuthoredCourseRevisions,guidedProjectSubmissions}=await import('@/server/db/schema');const {and,eq,isNotNull,desc}=await import('drizzle-orm');const d=await db();
 const archived=await d.select({id:enrollments.id,editionId:enrollments.editionId,archivedAt:enrollments.archivedAt,title:creatorAuthoredCourseRevisions.content}).from(enrollments).leftJoin(courseEditions,eq(courseEditions.id,enrollments.editionId)).leftJoin(creatorAuthoredCourseRevisions,eq(creatorAuthoredCourseRevisions.id,courseEditions.revisionId)).where(and(eq(enrollments.userId,user.id),eq(enrollments.courseId,courseId),isNotNull(enrollments.archivedAt))).orderBy(desc(enrollments.archivedAt)).limit(50);
 const history=await Promise.all(archived.map(async e=>({enrollmentId:e.id,title:e.title?.title??'Earlier edition',archivedAt:e.archivedAt?.toISOString(),completedTopics:(await(await import('@/server/repo')).progressFor(e.id)).length,projectReports:(await d.select({report:guidedProjectSubmissions.report}).from(guidedProjectSubmissions).where(eq(guidedProjectSubmissions.enrollmentId,e.id))).map(s=>({passed:s.report.passed,percent:s.report.percent}))})));
 return ok({history,targetRevisionId:latest?.revisionId,available:!!enrollment&&!!latest&&latest.revisionId!==current?.revisionId,editionId:enrollment?.editionId??null,title:latest?.content.title,moduleCount:latest?.content.modules.length});
});
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params; const user = await getSessionUser();
  const input = await body(req, z.object({ expectedEditionId: z.uuid().nullable() }).strict());
  await upgradeEnrollment(user.id, courseId, input.expectedEditionId);
  return ok({ enrollment: await enrollmentOf(user, courseId) });
});
