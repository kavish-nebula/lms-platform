import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from './db/client';
import { creatorMcpGrants } from './db/schema';
import { ApiError } from './http';
import { authoredCourseState, saveAuthoredCourse } from './authored-course';
import { AuthoredCoursePackage } from '@/lib/authored-course';
import { publishAuthoredCourse } from './authored-publication';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export type CreatorMcpGrant = { id: string; ownerId: string; allowPublication: boolean };
export async function listCreatorMcpGrants(ownerId: string) {
  return (await db()).select({ id: creatorMcpGrants.id, allowPublication: creatorMcpGrants.allowPublication, expiresAt: creatorMcpGrants.expiresAt })
    .from(creatorMcpGrants).where(and(eq(creatorMcpGrants.ownerId, ownerId), isNull(creatorMcpGrants.revokedAt), gt(creatorMcpGrants.expiresAt, new Date()))).orderBy(desc(creatorMcpGrants.createdAt));
}
export async function createCreatorMcpGrant(ownerId: string, allowPublication = false) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60_000);
  const [grant] = await (await db()).insert(creatorMcpGrants).values({ ownerId, tokenHash: hash(token), expiresAt, allowPublication }).returning({ id: creatorMcpGrants.id });
  return { ...grant, token, allowPublication, expiresAt: expiresAt.toISOString() };
}
export async function revokeCreatorMcpGrant(ownerId: string, id: string) {
  const [grant] = await (await db()).update(creatorMcpGrants).set({ revokedAt: new Date() }).where(and(eq(creatorMcpGrants.id, id), eq(creatorMcpGrants.ownerId, ownerId), isNull(creatorMcpGrants.revokedAt))).returning({ id: creatorMcpGrants.id });
  if (!grant) throw new ApiError(404, 'not_found', 'Connection not found.');
}
export async function resolveCreatorMcpGrant(token: string): Promise<CreatorMcpGrant> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, 'unauthorized', 'Invalid creator connection.');
  const [grant] = await (await db()).select().from(creatorMcpGrants).where(and(eq(creatorMcpGrants.tokenHash, hash(token)), isNull(creatorMcpGrants.revokedAt), gt(creatorMcpGrants.expiresAt, new Date())));
  if (!grant) throw new ApiError(401, 'unauthorized', 'Creator connection expired or revoked.');
  return { id: grant.id, ownerId: grant.ownerId, allowPublication: grant.allowPublication };
}
export function parseMcpJson(text: string) {
  try { return JSON.parse(text) as unknown; }
  catch { throw new ApiError(400, 'invalid_json', 'Supply valid JSON text. Read the authoring schemas first.'); }
}

export const FocusedEdit = z.object({ courseId: z.uuid(), moduleId: z.string().min(1).max(80), expectedBriefRevision: z.number().int().positive(), expectedVersion: z.number().int().nonnegative() });
type Edit = z.infer<typeof FocusedEdit>;
/** Focused edits clone the complete head and pass through its normal validator
 * and optimistic lock. Unrelated content is never supplied by the specialist. */
export async function saveCreatorFragment(ownerId: string, input: Edit, fragment: unknown, videoId?: string) {
  const request = FocusedEdit.parse(input);
  const state = await authoredCourseState(ownerId, request.courseId);
  const head = state.revisions[0];
  if (!head) throw new ApiError(409, 'package_required', 'Save a complete initial course package before focused lesson or quiz edits.');
  if (state.course.revision !== request.expectedBriefRevision || head.version !== request.expectedVersion) throw new ApiError(409, 'revision_conflict', 'Brief or package changed. Reload both before editing.');
  const content = structuredClone(head.content);
  const unit = content.modules.find(m => m.id === request.moduleId);
  if (!unit) throw new ApiError(404, 'not_found', 'Module not found.');
  const schema = AuthoredCoursePackage.shape.modules.element;
  if (videoId !== undefined) {
    const lesson = schema.shape.conceptExplainer.shape.videos.element.parse(fragment);
    if (lesson.id !== videoId) throw new ApiError(422, 'stable_id', 'Keep the existing lesson ID.');
    const index = unit.conceptExplainer.videos.findIndex(v => v.id === videoId);
    if (index < 0) throw new ApiError(404, 'not_found', 'Lesson not found.');
    unit.conceptExplainer.videos[index] = lesson;
  } else unit.moduleQuiz = schema.shape.moduleQuiz.unwrap().parse(fragment);
  return saveAuthoredCourse(ownerId, request.courseId, { expectedBriefRevision: request.expectedBriefRevision, expectedVersion: request.expectedVersion, content });
}

export async function publishCreatorMcpCourse(grant: CreatorMcpGrant, courseId: string, revisionId: string, reviewId: string) {
  if (!grant.allowPublication) throw new ApiError(403, 'publication_not_enabled', 'This connection can save drafts only. Publish in the creator workspace or create an explicitly publication-enabled connection.');
  return publishAuthoredCourse(grant.ownerId, courseId, { revisionId, reviewId });
}
