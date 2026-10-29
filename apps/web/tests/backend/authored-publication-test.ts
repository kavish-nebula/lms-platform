import assert from 'node:assert/strict';
import { EMPTY_BRIEF } from '@/lib/content-creator';
import { COURSE_REVIEW_CHECKS, type CourseReviewChecklist, type AuthoredCoursePackageData } from '@/lib/authored-course';
import { createCreatorDraft } from '@/server/content-creator';
import { saveAuthoredCourse, reviewAuthoredCourse } from '@/server/authored-course';
import { getPublishedAuthoredCourse, listPublishedAuthoredCourses, publishAuthoredCourse } from '@/server/authored-publication';
import { getSessionUser } from '@/server/auth';
import { getCourse, getCourses, getModule, getFinale } from '@/data';
import { POST as assess } from '@/app/api/v1/courses/[courseId]/assessment/route';
import { saveSetup, recordProgress } from '@/server/planner/service';
import * as repo from '@/server/repo';
import { previewKey, previewFor } from '@/lib/preview-progress';
import { startAuthoredCourseAudio, processAuthoredCourseAudio } from '@/server/authored-course-audio';
import { GET as releasedAudio } from '@/app/api/v1/courses/[courseId]/released-audio/[revisionId]/[slideId]/route';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const user = await getSessionUser();
assert.equal(previewKey('ai-agent', 'm1'), 'lms-progress:m1', 'Legacy learner keys stay valid.');
const previews = { [previewKey('course-a', 'M1')]: ['hook'], [previewKey('course-b', 'M1')]: ['guided'] };
assert.deepEqual(previewFor('course-a', { 'lms-progress:m1': ['worked'] }, previews), { M1: ['hook'] });
assert.deepEqual(previewFor('ai-agent', { 'lms-progress:m1': ['worked'] }, previews), { m1: ['worked'] });
const draft = await createCreatorDraft(user.id, { brief: { ...EMPTY_BRIEF, title: 'Publication test', sourceText: 'A fictional source.', objectives: [{ text: 'Identify the supplied fact.', bloom: 'Remember' }] } });
const links = { objectiveIds: ['O1'], sourceIds: ['S1'] };
const q = (id: string) => ({ id, prompt: 'Which fact is supplied?', choices: ['A', 'B'], correct: 0, hint: 'Read the source.', explanation: 'A is supplied.', ...links });
const content: AuthoredCoursePackageData = {
  schemaVersion: 1, title: 'Publication test', subject: 'Fictional source', briefRevision: draft.revision, durationMinutes: 10,
  sources: [{ id: 'S1', kind: 'sme', title: 'Test', reference: 'A fictional source.' }],
  objectiveEvidence: [{ objectiveId: 'O1', objective: 'Identify the supplied fact.', sourceIds: ['S1'] }],
  modules: [{ id: 'M1', title: 'First module', durationMinutes: 5, ...links,
    problemHook: { title: 'Question', situation: 'A supplied fact.', question: 'Which fact?', ...links },
    conceptExplainer: { videos: [{ id: 'V1', title: 'Facts', plannedMinutes: 1, slides: [{ id: 'SL1', title: 'Fact', body: ['A'], narration: 'The fact is A.', ...links }], midpointQuiz: { afterSlideId: 'SL1', questions: [q('Q1'), q('Q2')] } }] },
    workedExamples: [{ id: 'EX1', title: 'Example', problem: 'Find A.', reasoning: ['Read.'], result: 'A', ...links }],
    guidedPractice: { title: 'Practice', instructions: 'Find A.', steps: [{ id: 'GP1', instruction: 'Read.', hint: 'Look for A.', evidence: 'A', ...links }] },
    scenarioLab: { title: 'Scenario', scenarios: [{ id: 'SC1', title: 'Find', situation: 'A is supplied.', challenge: 'Find it.', expectedEvidence: 'A', ...links }] },
  }],
  courseEnd: { miniProject: { title: 'Project', brief: 'Find A.', deliverable: 'A', rubric: ['Uses A.'], ...links }, masteryGate: { title: 'Check', instructions: 'Select A.', passPercent: 80, questions: [q('MG1')] }, reflection: { prompts: ['What did you find?'] } },
};
const head = await saveAuthoredCourse(user.id, draft.id, { expectedBriefRevision: draft.revision, expectedVersion: 0, content });
assert.equal(await getPublishedAuthoredCourse(draft.id), undefined);
assert.equal(await getCourse(draft.id), undefined, 'Unpublished courses stay out of the shared learner data.');
await assert.rejects(publishAuthoredCourse(user.id, draft.id, { revisionId: head.id, reviewId: head.id }), { status: 409 });
const checklist = Object.fromEntries(COURSE_REVIEW_CHECKS.map(k => [k, true])) as CourseReviewChecklist;
const review = await reviewAuthoredCourse(user.id, user, draft.id, { revisionId: head.id, expectedReviewVersion: 0, verdict: 'approved', checklist, feedback: 'Test approval.' });
await assert.rejects(publishAuthoredCourse('another-owner', draft.id, { revisionId: head.id, reviewId: review.id }), { status: 404 });
await publishAuthoredCourse(user.id, draft.id, { revisionId: head.id, reviewId: review.id });
assert.deepEqual((await getPublishedAuthoredCourse(draft.id))?.content, content);
assert.equal((await listPublishedAuthoredCourses()).length, 1);
assert.equal((await getCourses()).filter(c => c.course_id === draft.id).length, 1);
assert.equal((await getCourse(draft.id))?.authoredRevisionId, head.id);
const playerModule = await getModule(draft.id, 'M1');
assert.deepEqual(playerModule?.stages_included, ['hook', 'explainer', 'worked', 'guided', 'lab']);
const hook = playerModule?.blocks.find(b => b.stage === 'hook');
assert(hook?.stage === 'hook' && hook.reveal.timeline.length > 0, 'The shared hook replay needs authored frames.');
const video = playerModule?.blocks.find(b => b.stage === 'explainer');
assert(video?.stage === 'explainer');
assert.equal(video.videos?.[0]?.midQuiz.length, 2);
assert.equal(video.videos?.[0]?.quizAfter, 0);
assert(video.videos?.[0]?.id.startsWith(draft.id), 'Watched-video state cannot collide across courses.');
const finale = await getFinale(draft.id);
assert.equal(finale?.final.authoredAssessment?.revisionId, head.id);
assert(!JSON.stringify(finale?.final.items).includes('"correct"'), 'Final answer keys stay off the learner payload.');
const assessment = (revisionId: string, responses: Record<string, string>) => assess(new Request('http://localhost/assessment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revisionId, responses }) }), { params: Promise.resolve({ courseId: draft.id }) });
const passed = await assessment(head.id, { MG1: '0' });
assert.equal((await passed.json()).result.passed, true);
assert.equal((await (await assessment(head.id, { MG1: '1' })).json()).result.passed, false);
assert.equal((await assessment(head.id, { MG1: '99' })).status, 400);
assert.equal((await assessment(draft.id, { MG1: '0' })).status, 409);
process.env.AUDIO = 'on'; process.env.KOKORO = 'on';
const wav = Buffer.alloc(48); wav.write('RIFF', 0); wav.writeUInt32LE(40, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4, 40);
const audio = await startAuthoredCourseAudio(user.id, draft.id, head.id);
await processAuthoredCourseAudio(audio.id, audio.token!, user.id, draft.id, async (dir, clips, _voice, completed) => {
  for (const clip of clips) { await writeFile(path.join(dir, `${clip.key}.wav`), wav); await completed(clip.key); }
});
const clipRequest = (revisionId: string, range?: string) => releasedAudio(new Request('http://localhost/clip', { headers: range ? { range } : {} }), { params: Promise.resolve({ courseId: draft.id, revisionId, slideId: 'SL1' }) });
const fullClip = await clipRequest(head.id);
assert.equal(fullClip.status, 200); assert.equal(fullClip.headers.get('content-length'), '48');
const clipRange = await clipRequest(head.id, 'bytes=0-43');
assert.equal(clipRange.status, 206); assert.equal((await clipRange.arrayBuffer()).byteLength, 44);
assert.equal((await clipRequest(head.id, 'bytes=-4')).headers.get('content-range'), 'bytes 44-47/48');
assert.equal((await clipRequest(head.id, 'bytes=999-')).status, 416);
assert.equal((await clipRequest(draft.id)).status, 404, 'Unpublished revision audio is never exposed to learners.');
process.env.AUDIO = 'off'; process.env.KOKORO = 'off';
const enrollment = await saveSetup(user, draft.id, { answers: {}, supportOverride: 'auto', pace: null }, () => {});
assert.equal(enrollment.courseId, draft.id);
assert(enrollment.plan, 'The shared enrollment flow builds a study plan for the released course.');
await recordProgress(user, draft.id, 'M1', 'hook', () => {});
const enrolled = await repo.findEnrollment(user.id, draft.id);
assert(enrolled);
assert((await repo.progressFor(enrolled.id)).some(row => row.moduleId === 'M1' && row.stage === 'hook'), 'Shared player completion persists to the learner database.');
assert.equal((await getCourse('ai-agent'))?.title, 'Build Your First AI Agent', 'The reference course remains available.');
await publishAuthoredCourse(user.id, draft.id, { revisionId: head.id, reviewId: review.id });
assert.equal((await listPublishedAuthoredCourses()).length, 1, 'Repeated publishing does not duplicate the catalog card.');
const newer = await saveAuthoredCourse(user.id, draft.id, { expectedBriefRevision: draft.revision, expectedVersion: 1, content: { ...content, title: 'Unapproved edit' } });
assert.equal((await getPublishedAuthoredCourse(draft.id))?.content.title, 'Publication test', 'New authoring drafts cannot change released learner content.');
await assert.rejects(publishAuthoredCourse(user.id, draft.id, { revisionId: head.id, reviewId: review.id }), { status: 409 });
await assert.rejects(publishAuthoredCourse(user.id, draft.id, { revisionId: newer.id, reviewId: review.id }), { status: 409 });
const approved = await reviewAuthoredCourse(user.id, user, draft.id, { revisionId: newer.id, expectedReviewVersion: 0, verdict: 'approved', checklist, feedback: '' });
await reviewAuthoredCourse(user.id, user, draft.id, { revisionId: newer.id, expectedReviewVersion: 1, verdict: 'revision_requested', checklist, feedback: 'Needs work.' });
await assert.rejects(publishAuthoredCourse(user.id, draft.id, { revisionId: newer.id, reviewId: approved.id }), { status: 409 });
assert.equal(await getPublishedAuthoredCourse('invalid-id'), undefined);
console.log('PASS authored learner delivery: approval and revision gates, native catalog/player/enrollment, isolated preview keys, persistent module progress, server final grading, seekable released narration, and reference course preservation.');
