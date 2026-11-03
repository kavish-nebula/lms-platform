import assert from 'node:assert/strict';
import { importedCourses } from '@/lib/imported-courses';
import { getSessionUser } from '@/server/auth';
import { readPackageState, savePackageState, requireImportedModule } from '@/server/imported-courses';
import { PUT } from '@/app/api/v1/imported-courses/[courseId]/[moduleId]/progress/route';
import { GET as media } from '@/app/api/v1/imported-courses/[courseId]/[moduleId]/media/[file]/route';

const user = await getSessionUser();
const courseId = 'ai-for-production', moduleId = 'M1';
const state = { version: 1 as const, cmi: { 'cmi.location': 'concept-2', 'cmi.score.raw': '80' }, storage: { notes: 'Saved explanation' } };
await savePackageState(user.id, courseId, moduleId, state);
assert.deepEqual(await readPackageState(user.id, courseId, moduleId), state);
const unit = importedCourses[0].modules[0], oldRevision = unit.revision;
unit.revision = 'test-next-revision';
assert.deepEqual((await readPackageState(user.id, courseId, moduleId)).cmi, {}, 'Different package revisions have separate progress');
unit.revision = oldRevision;
assert.deepEqual(await readPackageState(user.id, courseId, moduleId), state);
assert.deepEqual((await readPackageState('another-learner', courseId, moduleId)).cmi, {});
assert.throws(() => requireImportedModule('../escape', moduleId), { code: 'not_found' });
const ctx = { params: Promise.resolve({ courseId, moduleId }) };
const bad = await PUT(new Request('http://local/progress', { method: 'PUT', body: JSON.stringify({ ...state, cmi: { 'not-cmi': 'x' } }) }), ctx);
assert.equal(bad.status, 400);
assert.deepEqual(await readPackageState(user.id, courseId, moduleId), state, 'Invalid writes preserve saved state');
const unknown = await media(new Request('http://local/media'), { params: Promise.resolve({ courseId, moduleId, file: '../secret' }) });
assert.equal(unknown.status, 404);
const clip = await media(new Request('http://local/media', { headers: { range: 'bytes=0-15' } }), { params: Promise.resolve({ courseId, moduleId, file: 'nebula_speech_98bf476d.wav' }) });
assert([206, 307].includes(clip.status));
if (clip.status === 206) {
  assert.equal(clip.headers.get('content-type'), 'audio/wav');
  assert.equal((await clip.arrayBuffer()).byteLength, 16);
}
console.log('PASS imported course: scoped persistence, revision isolation, bounded writes, registered media and seekable narration');
