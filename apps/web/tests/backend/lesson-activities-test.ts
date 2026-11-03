import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EMPTY_BRIEF } from '@/lib/content-creator';
import { createCreatorDraft, getCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { saveLessonActivities, listLessonActivities, getLessonActivities } from '@/server/lesson-activities';
import { getSessionUser } from '@/server/auth';
import { db, closeDb, appRoot } from '@/server/db/client';
import { users, profiles, stepProgress } from '@/server/db/schema';

const owner = await getSessionUser(); const database = await db();
await database.insert(users).values({ id: 'activity-other-owner', name: 'Other owner', email: 'activity-other@example.test' });
const before = { profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) };
const draft = await createCreatorDraft(owner.id, { brief: { ...EMPTY_BRIEF, title: 'Draft activities', objectives: [{ text: 'Review a supplied AI draft.', bloom: 'Analyze' }], sourceLibrary: { version: 1, modules: [{ id: 'M1', title: 'Review drafts', topics: [{ id: 'T1', title: 'Evidence' }] }], sources: [{ id: 'S1', revision: 1, title: 'Draft source', scope: 'topic', moduleId: 'M1', topicId: 'T1', objectiveIds: ['O1'], text: '', reference: 'Source awaiting review' }] } } });
const linked = { objectiveIds: ['O1'], sourceIds: ['S1'] };
const input = { expectedBriefRevision: draft.revision, moduleId: 'M1', topicId: 'T1', title: 'Check the evidence', sourceSnapshots: [{ sourceId: 'S1', revision: 1, evidenceText: 'Review AI output against the supplied source.' }], content: {
  problemHook: { title: 'Can you trust this?', situation: 'The AI adds an unsupported cause.', question: 'What needs checking?', ...linked },
  workedExamples: [{ id: 'EX1', title: 'Compare the claim', problem: 'The source says unknown.', reasoning: ['Read the source.', 'Remove the unsupported cause.'], result: 'Cause unknown.', ...linked }],
  guidedPractice: { title: 'Review another claim', instructions: 'Try before viewing feedback.', steps: [{ id: 'STEP1', instruction: 'Compare the response with the source.', hint: 'Look for the unknown cause.', evidence: 'Preserve the uncertainty.', ...linked }] },
} };
await assert.rejects(saveLessonActivities('activity-other-owner', draft.id, input), { status: 404 });
await assert.rejects(saveLessonActivities(owner.id, draft.id, { ...input, expectedBriefRevision: 99 }), { status: 409 });
await assert.rejects(saveLessonActivities(owner.id, draft.id, { ...input, topicId: 'Tother' }), { status: 422 });
await assert.rejects(saveLessonActivities(owner.id, draft.id, { ...input, sourceSnapshots: [{ ...input.sourceSnapshots[0], revision: 9 }] }), { status: 422 });
await assert.rejects(saveLessonActivities(owner.id, draft.id, { ...input, sourceSnapshots: [{ ...input.sourceSnapshots[0], sourceId: 'Sforeign' }] }), { status: 422 });
const unknown = structuredClone(input); unknown.content.problemHook.objectiveIds = ['O99'];
await assert.rejects(saveLessonActivities(owner.id, draft.id, unknown), { status: 422 });
const duplicate = structuredClone(input); duplicate.content.guidedPractice.steps[0].id = 'EX1';
await assert.rejects(saveLessonActivities(owner.id, draft.id, duplicate), { status: 422 });
const activity = await saveLessonActivities(owner.id, draft.id, input);
assert.equal(activity.status, 'needs_review', 'Unreviewed evidence must never become approved course content.');
assert.equal((await listLessonActivities(owner.id, draft.id)).length, 1);
assert.deepEqual((await getLessonActivities(owner.id, draft.id, activity.id)).content, input.content);
await assert.rejects(getLessonActivities('activity-other-owner', draft.id, activity.id), { status: 404 });
await assert.rejects(getLessonActivities(owner.id, draft.id, '../outside'), { status: 404 });
assert.deepEqual(await getCreatorDraft(owner.id, draft.id), draft, 'A specialist draft must not rewrite the brief.');
await updateCreatorDraft(owner.id, draft.id, { brief: { ...draft.brief, title: 'Changed brief' }, revision: draft.revision });
assert.equal((await listLessonActivities(owner.id, draft.id))[0].outdated, true);
assert.deepEqual({ profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) }, before);
// Only the generated test course's UUID directory is removed.
const root = path.resolve(appRoot(), '.data', 'lesson-activities'); const dir = path.resolve(root, draft.id);
assert(dir.startsWith(root + path.sep)); await fs.rm(dir, { recursive: true, force: true });
await closeDb(); console.log('Lesson activity ownership, version, source, stale-state and learner-isolation checks passed.');
