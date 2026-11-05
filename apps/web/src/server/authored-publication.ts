import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from './db/client';
import { courseEditions, enrollments, creatorCourses, creatorAuthoredCourseRevisions as revisions, creatorAuthoredCourseReviews as reviews, publishedAuthoredCourses as releases } from './db/schema';
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
    // Snapshot the previous edition and pin existing learners before changing the live pointer.
    const [previous] = await tx.select().from(releases).where(eq(releases.courseId, courseId));
    if (previous) {
      await tx.insert(courseEditions).values({ courseId, revisionId: previous.revisionId, reviewId: previous.reviewId, publishedAt: previous.publishedAt }).onConflictDoNothing();
      const [old] = await tx.select().from(courseEditions).where(and(eq(courseEditions.courseId, courseId), eq(courseEditions.revisionId, previous.revisionId)));
      await tx.update(enrollments).set({ editionId: old.id }).where(and(eq(enrollments.courseId, courseId), isNull(enrollments.editionId)));
    }
    await tx.insert(courseEditions).values({ courseId, revisionId: head.id, reviewId: review.id }).onConflictDoNothing();
    const [release] = await tx.insert(releases).values({ courseId, revisionId: head.id, reviewId: review.id, publishedBy: ownerId }).onConflictDoUpdate({ target: releases.courseId, set: { revisionId: head.id, reviewId: review.id, publishedBy: ownerId, publishedAt: new Date() } }).returning();
    return { ...release, href: `/learn/courses/${courseId}` };
  });
}

export async function listPublishedAuthoredCourses() {
  return (await db()).select({ courseId: releases.courseId, revisionId: releases.revisionId, publishedAt: releases.publishedAt, content: revisions.content }).from(releases).innerJoin(revisions, eq(revisions.id, releases.revisionId)).orderBy(desc(releases.publishedAt));
}

export async function getPublishedAuthoredCourse(courseId: string, userId?: string) {
  if (!z.uuid().safeParse(courseId).success) return undefined;
  if (userId) {
    const d = await db();
    const [enrollment] = await d.select().from(enrollments).where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, userId), isNull(enrollments.archivedAt)));
    if (enrollment?.editionId) {
      const [pinned] = await d.select({ courseId: courseEditions.courseId, revisionId: revisions.id, ownerId: revisions.ownerId, publishedAt: courseEditions.publishedAt, content: revisions.content }).from(courseEditions).innerJoin(revisions, eq(revisions.id, courseEditions.revisionId)).where(and(eq(courseEditions.id, enrollment.editionId), eq(courseEditions.courseId, courseId)));
      if (pinned) return pinned;
      throw new ApiError(409, 'edition_unavailable', 'The enrolled course edition is unavailable.');
    }
  }
  const [release] = await (await db()).select({ courseId: releases.courseId, revisionId: releases.revisionId, ownerId: revisions.ownerId, publishedAt: releases.publishedAt, content: revisions.content }).from(releases).innerJoin(revisions, eq(revisions.id, releases.revisionId)).where(eq(releases.courseId, courseId));
  return release;
}
