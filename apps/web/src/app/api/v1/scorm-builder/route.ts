import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { body, handle, ok } from '@/server/http';
import { activateScormPilot, importScormTopic, listScormImports, previewScormTopic, readScorm } from '@/server/scorm-builder';

export const GET = handle(async (req: Request) => {
  const user = await getSessionUser();
  const query = new URL(req.url).searchParams;
  const courseName = query.get('courseName'); const topicId = query.get('topicId');
  if (courseName && topicId) {
    const topic = await previewScormTopic(courseName, topicId);
    return ok({ preview: { topicId: topic.topicId, title: topic.title, version: topic.sourceVersion, status: topic.status, objectives: topic.objectives, concepts: topic.concepts.length, lessons: topic.concepts.reduce((n, c) => n + c.sub_concepts.length, 0) } });
  }
  if (courseName) return ok({ structure: await readScorm('get_course_structure', { courseName }) });
  return ok({ library: await readScorm('list_courses', {}), imports: await listScormImports(user.id) });
});
export const POST = handle(async (req: Request) => {
  const user = await getSessionUser();
  const input = await body(req, z.discriminatedUnion('action', [
    z.object({ action: z.literal('import'), courseName: z.string().regex(/^[A-Za-z0-9_-]+$/).max(120), topicId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(160), expectedVersion: z.number().int().nonnegative() }),
    z.object({ action: z.literal('activate'), importId: z.uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  ]));
  return ok(input.action === 'import' ? await importScormTopic(user.id, input.courseName, input.topicId, input.expectedVersion) : await activateScormPilot(user.id, input.importId, input.fingerprint));
});
