import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from './db/client';
import { creatorCourses, creatorAuthoredCourseRevisions as revisions, creatorAuthoredCourseReviews as reviews, publishedAuthoredCourses as releases } from './db/schema';
import { ApiError } from './http';

export const PublishAuthoredCourse = z.object({ revisionId: z.uuid(), reviewId: z.uuid() }).strict();

export async function publishAuthoredCourse(ownerId: string, courseId: string, input: z.infer<typeof PublishAuthoredCourse>) {
  const request = PublishAuthoredCourse.parse(input);
  return (await db()).transaction(async tx => {
    const [course] = await tx.select().from(creatorCourses).where(and(eq(creatorCourses.id, courseId), eq(creatorCourses.ownerId, ownerId))).for('update');
    if (!course) throw new ApiError(404, 'not_found', 'Course draft not found.');
    const [head] = await tx.select().from(revisions).where(eq(revisions.courseId, courseId)).orderBy(desc(revisions.version)).limit(1);
    if (!head || head.id !== request.revisionId || head.briefRevision !== course.revision) throw new ApiError(409, 'revision_outdated', 'Publish only the latest revision for the current brief.');
    const [review] = await tx.select().from(reviews).where(eq(reviews.revisionId, head.id)).orderBy(desc(reviews.version)).limit(1);
    if (!review || review.id !== request.reviewId || review.verdict !== 'approved') throw new ApiError(409, 'approval_required', 'The latest review must approve this exact revision.');
    const [release] = await tx.insert(releases).values({ courseId, revisionId: head.id, reviewId: review.id, publishedBy: ownerId }).onConflictDoUpdate({ target: releases.courseId, set: { revisionId: head.id, reviewId: review.id, publishedBy: ownerId, publishedAt: new Date() } }).returning();
    return { ...release, href: `/learn/courses/${courseId}` };
  });
}

export async function listPublishedAuthoredCourses() {
  return (await db()).select({ courseId: releases.courseId, revisionId: releases.revisionId, publishedAt: releases.publishedAt, content: revisions.content }).from(releases).innerJoin(revisions, eq(revisions.id, releases.revisionId)).orderBy(desc(releases.publishedAt));
}

export async function getPublishedAuthoredCourse(courseId: string) {
  if (!z.uuid().safeParse(courseId).success) return undefined;
  const [release] = await (await db()).select({ courseId: releases.courseId, revisionId: releases.revisionId, ownerId: revisions.ownerId, publishedAt: releases.publishedAt, content: revisions.content }).from(releases).innerJoin(revisions, eq(revisions.id, releases.revisionId)).where(eq(releases.courseId, courseId));
  return release;
}
