import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { appRoot, db } from './db/client';
import { importedCourseProgress } from './db/schema';
import { ApiError } from './http';
import { emptyPackageState, importedCourse, importedModule, type PackageState } from '@/lib/imported-courses';

export function requireImportedModule(courseId: string, moduleId: string) {
  const course = importedCourse(courseId);
  const unit = importedModule(courseId, moduleId);
  if (!course || !unit) throw new ApiError(404, 'not_found', 'Imported module not found.');
  return { course, module: unit };
}

export async function readPackageState(userId: string, courseId: string, moduleId: string) {
  const { module: unit } = requireImportedModule(courseId, moduleId);
  const [row] = await (await db()).select().from(importedCourseProgress).where(and(
    eq(importedCourseProgress.userId, userId), eq(importedCourseProgress.courseId, courseId),
    eq(importedCourseProgress.moduleId, moduleId), eq(importedCourseProgress.revision, unit.revision),
  ));
  return row?.state ?? emptyPackageState();
}

export async function savePackageState(userId: string, courseId: string, moduleId: string, state: PackageState) {
  const { module: unit } = requireImportedModule(courseId, moduleId);
  await (await db()).insert(importedCourseProgress).values({ userId, courseId, moduleId, revision: unit.revision, state }).onConflictDoUpdate({
    target: [importedCourseProgress.userId, importedCourseProgress.courseId, importedCourseProgress.moduleId, importedCourseProgress.revision],
    set: { state, updatedAt: new Date() },
  });
}

export async function packageHtml(courseId: string, moduleId: string) {
  requireImportedModule(courseId, moduleId);
  return fs.readFile(path.join(appRoot(), 'public', 'course-packages', courseId, moduleId, 'index.html'), 'utf8');
}
