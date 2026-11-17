import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/server/db/client';
import { getSessionUser } from '@/server/auth';
import * as schema from '@/server/db/schema';
import * as repo from '@/server/repo';
import { COURSE_REVIEW_CHECKS, type AuthoredCoursePackageData, type CourseReviewChecklist } from '@/lib/authored-course';
import type { CourseBriefData } from '@/lib/content-creator';
import { PILOT_COURSE, PILOT_REVISION } from '@/server/learning/pilot-policy';

/** Test-only fixture copy of an already published snapshot; never runs on live PostgreSQL. */
export async function seedLearningPilot() {
  if (process.env.DATABASE_URL || process.env.PGLITE_DIR !== 'memory://' && !process.env.PGLITE_DIR?.includes('.data/tests/')) throw new Error('Pilot fixtures require an isolated test database.');
  const d = await db(), owner = await getSessionUser();
  const root = path.resolve('../../fixtures/authored-courses/ai-for-production-module1');
  const content = JSON.parse(fs.readFileSync(path.join(root, 'course.json'), 'utf8')) as AuthoredCoursePackageData;
  const brief = JSON.parse(fs.readFileSync(path.join(root, 'brief.json'), 'utf8')) as CourseBriefData;
  await d.insert(schema.creatorCourses).values({ id: PILOT_COURSE, ownerId: owner.id, brief }).onConflictDoNothing();
  await d.insert(schema.creatorAuthoredCourseRevisions).values({ id: PILOT_REVISION, courseId: PILOT_COURSE, ownerId: owner.id, version: 1, briefRevision: content.briefRevision, content, createdBy: owner.id }).onConflictDoNothing();
  const [review] = await d.insert(schema.creatorAuthoredCourseReviews).values({ courseId: PILOT_COURSE, revisionId: PILOT_REVISION, version: 1, verdict: 'approved', checklist: Object.fromEntries(COURSE_REVIEW_CHECKS.map(k => [k, true])) as CourseReviewChecklist, feedback: 'ISOLATED FIXTURE ONLY: copy of published course; no live approval.', reviewerId: owner.id, reviewerName: 'Test fixture' }).returning();
  const [edition] = await d.insert(schema.courseEditions).values({ courseId: PILOT_COURSE, revisionId: PILOT_REVISION, reviewId: review.id }).returning();
  await d.insert(schema.publishedAuthoredCourses).values({ courseId: PILOT_COURSE, revisionId: PILOT_REVISION, reviewId: review.id, publishedBy: owner.id });
  await repo.saveProfile(owner.id, { field: 'finance', domain: 'other', domainOther: 'Finance and audit', role: 'accounts', tools: ['sheets'], coding: 'none', style: 'steps' }, []);
  await repo.upsertEnrollment(owner.id, PILOT_COURSE, { answers: {}, supportOverride: 'auto', pace: null, precheck: null });
  await d.insert(schema.users).values({ id: 'learning-healthcare', name: 'Isolated learner', email: 'learning-healthcare@example.test' });
  await repo.saveProfile('learning-healthcare', { field: 'healthcare', domain: 'healthcare', role: 'clinician', coding: 'none', style: 'steps' }, []);
  await repo.upsertEnrollment('learning-healthcare', PILOT_COURSE, { answers: {}, supportOverride: 'auto', pace: null, precheck: null });
  return { owner, edition, content };
}
