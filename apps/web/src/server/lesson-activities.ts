import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod/v4';
import { SaveLessonActivities, lessonActivityIssues, type LessonActivityDraft } from '@/lib/lesson-activities';
import { getCreatorDraft } from './content-creator';
import { appRoot } from './db/client';
import { ApiError } from './http';

const directory = (courseId: string) => path.join(appRoot(), '.data', 'lesson-activities', z.uuid().parse(courseId));
export async function listLessonActivities(ownerId: string, courseId: string) {
  const brief = await getCreatorDraft(ownerId, courseId);
  const dir = directory(courseId);
  const files = await fs.readdir(dir).catch(() => []);
  const entries: LessonActivityDraft[] = await Promise.all(files.filter(f => /^[a-f0-9-]{36}\.json$/.test(f)).map(async f => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))));
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(entry => ({ ...entry, outdated: entry.briefRevision !== brief.revision }));
}
export async function getLessonActivities(ownerId: string, courseId: string, activityId: string) {
  if (!z.uuid().safeParse(activityId).success) throw new ApiError(404, 'not_found', 'Activity draft not found.');
  const entry = (await listLessonActivities(ownerId, courseId)).find(e => e.id === activityId);
  if (!entry) throw new ApiError(404, 'not_found', 'Activity draft not found.');
  return entry;
}
export async function saveLessonActivities(ownerId: string, courseId: string, raw: unknown) {
  const input = SaveLessonActivities.parse(raw);
  const brief = await getCreatorDraft(ownerId, courseId);
  if (brief.revision !== input.expectedBriefRevision) throw new ApiError(409, 'brief_changed', 'The course brief changed. Reload before saving activities.');
  const issues = lessonActivityIssues(input, brief.brief);
  if (issues.length) throw new ApiError(422, 'invalid_activities', issues.join(' '));
  // This stores an unapproved specialist handoff, never an incomplete course package.
  const { expectedBriefRevision, ...fragment } = input;
  const entry: LessonActivityDraft = { ...fragment, id: randomUUID(), courseId, briefRevision: expectedBriefRevision, createdAt: new Date().toISOString(), status: 'needs_review', outdated: false };
  if ((await getCreatorDraft(ownerId, courseId)).revision !== expectedBriefRevision) throw new ApiError(409, 'brief_changed', 'The course brief changed during saving.');
  const dir = directory(courseId); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${entry.id}.json`), JSON.stringify(entry), { flag: 'wx' });
  return entry;
}
