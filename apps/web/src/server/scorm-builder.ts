import 'server-only';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './db/client';
import { scormTopicImports, users } from './db/schema';
import { ApiError } from './http';
import { normalizeScormTopic, scormCourseId, scormDelivery } from '@/lib/scorm-topic';

export type ScormReader = (name: string, args: Record<string, unknown>) => Promise<unknown>;
const readTools = new Set(['list_courses', 'get_course_structure', 'get_topic', 'list_releases', 'get_release']);
export const readScorm: ScormReader = async (name, args) => {
  if (!readTools.has(name)) throw new ApiError(400, 'read_only', 'Unsupported source read.');
  const c = new Client({ name: 'nebula-lms-importer', version: '1.0.0' });
  try {
    const auth = JSON.parse(await readFile(path.join(process.env.SCORM_AUTH_DIR || path.join(os.homedir(), '.scorm-auth'), 'credentials.json'), 'utf8'));
    if (!auth.apiKey) throw new Error();
    await c.connect(new StreamableHTTPClientTransport(new URL('https://scorm-builder-app-759854934093.asia-south1.run.app/mcp'), { requestInit: { headers: { Authorization: `Bearer ${auth.apiKey}` } } }));
    const result = await c.callTool({ name, arguments: args }, undefined, { timeout: 30_000 });
    if (result.isError) throw new Error();
    const block = (result.content as { type: string; text?: string }[]).find(b => b.type === 'text');
    const data = JSON.parse(block?.text || '{}');
    if (data.success === false) throw new Error();
    return data;
  } catch { throw new ApiError(502, 'source_unavailable', 'Could not read SCORM Builder. Check its MCP login and course permissions.'); }
  finally { await c.close(); }
};

export async function listScormImports(ownerId: string) {
  const rows = await (await db()).select().from(scormTopicImports).where(eq(scormTopicImports.ownerId, ownerId)).orderBy(desc(scormTopicImports.importedAt));
  return rows.map(r => ({ id: r.id, courseId: r.courseId, topicId: r.topicId, title: r.source.title, version: r.source.sourceVersion, status: r.source.status, active: r.active, fingerprint: r.fingerprint }));
}
export async function previewScormTopic(courseName: string, topicId: string, reader: ScormReader = readScorm) {
  const response = await reader('get_topic', { topicId }) as { topic: Record<string, unknown> };
  try { return normalizeScormTopic(response.topic, courseName); }
  catch { throw new ApiError(422, 'invalid_source', 'This source topic is missing valid objectives, teaching or quiz answers. Review it in SCORM Builder before importing.'); }
}
export async function importScormTopic(ownerId: string, courseName: string, topicId: string, expectedVersion: number, reader: ScormReader = readScorm) {
  const source = await previewScormTopic(courseName, topicId, reader);
  if (source.topicId !== topicId || source.sourceVersion !== expectedVersion) throw new ApiError(409, 'source_changed', 'The source changed. Refresh its preview before importing.');
  const structure = await reader('get_course_structure', { courseName }) as { modules: { num: number; topics: { topicId: string; title: string }[] }[] };
  const hierarchy = structure.modules.map(m => ({ num: m.num, topics: m.topics.map(t => ({ topicId: t.topicId, title: t.title })) }));
  if (!hierarchy.some(m => m.topics.some(t => t.topicId === topicId))) throw new ApiError(409, 'source_changed', 'Topic no longer belongs to the selected course.');
  const fingerprint = createHash('sha256').update(JSON.stringify(source)).digest('hex');
  const database = await db();
  await database.insert(scormTopicImports).values({ ownerId, courseId: scormCourseId(courseName), topicId, source, hierarchy, fingerprint }).onConflictDoNothing();
  const [row] = await database.select().from(scormTopicImports).where(and(eq(scormTopicImports.ownerId, ownerId), eq(scormTopicImports.topicId, topicId), eq(scormTopicImports.fingerprint, fingerprint)));
  return { id: row!.id, fingerprint, topicId, status: 'imported', warnings: ['Source content is a draft unless its published release has been selected.', 'Concept/topic quizzes are retained; no course-wide final or new midpoint questions have been invented.', 'External practical tasks require review before in-course delivery.'] };
}
export async function activateScormPilot(ownerId: string, importId: string, fingerprint: string) {
  const database = await db();
  return database.transaction(async tx => {
    // Serialize creator activation across topics/revisions.
    await tx.select().from(users).where(eq(users.id, ownerId)).for('update');
    const [row] = await tx.select().from(scormTopicImports).where(and(eq(scormTopicImports.id, importId), eq(scormTopicImports.ownerId, ownerId)));
    if (!row || row.fingerprint !== fingerprint) throw new ApiError(409, 'import_changed', 'Reload the imported revision.');
    await tx.update(scormTopicImports).set({ active: false }).where(eq(scormTopicImports.topicId, row.topicId));
    await tx.update(scormTopicImports).set({ active: true }).where(eq(scormTopicImports.id, importId));
    return { href: `/learn/courses/${row.courseId}/${'M' + row.source.moduleId}/explainer`, courseId: row.courseId };
  });
}
export async function scormCourseDelivery(courseId: string) {
  if (courseId !== 'ai-for-production' && !courseId.startsWith('scorm-')) return undefined;
  const rows = await (await db()).select().from(scormTopicImports).where(and(eq(scormTopicImports.courseId, courseId), eq(scormTopicImports.active, true))).orderBy(scormTopicImports.topicId);
  return scormDelivery(rows);
}

export async function activeScormCourses() {
  const rows = await (await db()).select().from(scormTopicImports).where(eq(scormTopicImports.active, true));
  return [...Map.groupBy(rows, row => row.courseId).values()].flatMap(group => { const delivery = scormDelivery(group); return delivery ? [delivery.course] : []; });
}
