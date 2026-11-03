import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { EMPTY_BRIEF, type CourseBriefData } from '@/lib/content-creator';
import { parseTranscriptVtt } from '@/lib/concept-video-source';
import { createCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { getSessionUser } from '@/server/auth';
import { db, closeDb } from '@/server/db/client';
import { users, enrollments, profiles, stepProgress } from '@/server/db/schema';
import { uploadConceptVideo, reviewVideoTranscript, assertVideoSources, serveConceptVideo, transcribeConceptVideo } from '@/server/concept-videos';
import { generateVideoModule, videoModuleDrafts } from '@/server/video-first-authoring';
import { authoredDelivery } from '@/lib/authored-delivery';
import { saveAuthoredCourse, reviewAuthoredCourse, getCodexCourseContext } from '@/server/authored-course';
import { publishAuthoredCourse } from '@/server/authored-publication';
import { startBlueprint, processBlueprint } from '@/server/creator-blueprints';
import { blueprintInput } from '@/lib/instructional-blueprint';
import { blueprintShape } from '@/server/blueprint-ai';
import { saveSmeReview } from '@/server/creator-sme-review';
import { EMPTY_SME_CHECKLIST } from '@/lib/sme-review';
import { COURSE_REVIEW_CHECKS, type AuthoredCoursePackageData } from '@/lib/authored-course';
import { POST as videoPost } from '@/app/api/v1/content/courses/[id]/videos/route';

const testRoot = path.join(process.cwd(), '.data', 'video-first-test', crypto.randomUUID());
process.env.LMS_VIDEO_DIR = testRoot;
await fs.mkdir(testRoot, { recursive: true });
const clip = path.join(testRoot, 'sample.mp4');
execFileSync(ffmpeg!, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=navy:s=640x360:r=10:d=6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', clip], { windowsHide: true });
const owner = await getSessionUser(); const database = await db();
await database.insert(users).values({ id: 'video-learner', name: 'Video learner', email: 'video-learner@example.test' });
const untouched = { profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) };
let draft = await createCreatorDraft(owner.id, { brief: { ...EMPTY_BRIEF, title: 'Source-grounded AI drafts', subject: 'AI at work', audience: 'Employees', outcomes: 'Review AI drafts.', dependencies: 'Inputs before review', objectives: [{ text: 'Identify the need to review an AI draft.', bloom: 'Understand' }] } });
await assert.rejects(uploadConceptVideo('video-learner', draft.id, new File(['x'], 'a.mp4', { type: 'video/mp4' })), { status: 404 });
await assert.rejects(uploadConceptVideo(owner.id, draft.id, new File(['bad'], 'a.mp4', { type: 'video/mp4' })), { status: 422 });
await assert.rejects(uploadConceptVideo(owner.id, draft.id, new File(['x'], 'x.html', { type: 'text/html' })), { status: 422 });
const asset = await uploadConceptVideo(owner.id, draft.id, new File([await fs.readFile(clip)], 'review-drafts.mp4', { type: 'video/mp4' }));
assert.equal(asset.durationSeconds, 6);
const form = new FormData(); form.set('file', new File([await fs.readFile(clip)], 'browser-upload.mp4', { type: 'video/mp4' }));
assert.equal((await videoPost(new Request('http://localhost/api/videos', { method: 'POST', body: form }), { params: Promise.resolve({ id: draft.id }) })).status, 201);
assert.equal((await videoPost(new Request('http://localhost/api/videos', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': String(252 * 1024 * 1024) }, body: 'bad' }), { params: Promise.resolve({ id: draft.id }) })).status, 413);
const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nUse AI to draft from supplied notes.\n\n00:00:03.000 --> 00:00:06.000\nReview the draft against those notes before sharing it.';
assert.equal(parseTranscriptVtt(vtt, 6).checkpointSeconds, 3);
assert.throws(() => parseTranscriptVtt(vtt.replace('00:00:06.000', '00:00:08.000'), 6));
const transcript = await reviewVideoTranscript(owner.id, draft.id, asset.id, vtt);
const brief: CourseBriefData = { ...draft.brief, sourceLibrary: { version: 1, modules: [{ id: 'M1', title: 'Draft and review', topics: [{ id: 'T1', title: 'Review drafts' }] }], sources: [{ id: 'Svideo', revision: 1, title: 'Review an AI draft', scope: 'topic', moduleId: 'M1', topicId: 'T1', objectiveIds: ['O1'], text: transcript.text, reference: 'Uploaded recording', video: { assetId: asset.id, transcriptId: transcript.id, durationSeconds: 6, checkpointSeconds: 3 } }] } };
draft = await updateCreatorDraft(owner.id, draft.id, { brief, revision: 1 });
await assertVideoSources(owner.id, draft.id, draft.brief);
const tampered = structuredClone(draft.brief); tampered.sourceLibrary!.sources[0].text += ' invented';
await assert.rejects(assertVideoSources(owner.id, draft.id, tampered), { code: 'transcript_changed' });
await assert.rejects(serveConceptVideo('video-learner', draft.id, asset.id, new Request('http://localhost/media')), { status: 404 });
const ranged = await serveConceptVideo(owner.id, draft.id, asset.id, new Request('http://localhost/media', { headers: { Range: 'bytes=0-15' } }));
assert.equal(ranged.status, 206); assert.equal((await ranged.arrayBuffer()).byteLength, 16);
assert.equal((await serveConceptVideo(owner.id, draft.id, asset.id, new Request('http://localhost/media', { headers: { Range: 'bytes=999999999-' } }))).status, 416);
assert.equal((await serveConceptVideo(owner.id, draft.id, asset.id, new Request('http://localhost/media', { headers: { Range: 'bytes=-16' } }))).headers.get('Content-Length'), '16');
const captions = await serveConceptVideo(owner.id, draft.id, asset.id, new Request(`http://localhost/media?transcript=${transcript.id}`));
assert((await captions.text()).startsWith('WEBVTT'));
process.env.TRANSCRIPTION_PROVIDER = 'gemini'; process.env.AUDIO_API_KEY = 'test-only';
const draftTranscript = await transcribeConceptVideo(owner.id, draft.id, asset.id, async (_url, init) => {
  const body = JSON.parse(String(init?.body)); assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'audio/mp3');
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ cues: transcript.cues }) }] } }] });
});
assert.equal(draftTranscript.status, 'needs_review');
const linked = { objectiveIds: ['O1'], sourceIds: ['Svideo'] };
const question = (id: string) => ({ id, prompt: 'Select one answer: what should AI draft from?', choices: ['The supplied notes', 'Unsupported guesses'], correct: 0, hint: 'Use the recording.', explanation: 'Use the supplied notes.', ...linked });
const generated = await generateVideoModule(owner.id, draft.id, 'M1', draft.revision, async request => {
  const input = JSON.parse(request.messages[1].content);
  assert(input.fixedVideos[0].slides[0].narration.includes('supplied notes'));
  assert(!input.fixedVideos[0].slides[0].narration.includes('sharing'));
  const content = { id: 'M1', title: 'Draft and review', durationMinutes: 15, ...linked,
    problemHook: { title: 'A draft to check', situation: 'An AI draft is ready to share.', question: 'What should happen first?', ...linked },
    conceptExplainer: { videos: input.fixedVideos.map((video: Record<string, unknown>) => ({ ...video, midpointQuiz: { afterSlideId: input.fixedVideos[0].midpointQuiz.afterSlideId, questions: [question('M1Q1'), question('M1Q2')] } })) },
    workedExamples: [{ id: 'M1E1', title: 'Check a summary', problem: 'Compare a draft with notes.', reasoning: ['Read notes', 'Check draft claims'], result: 'Flag unsupported claims.', ...linked }],
    guidedPractice: { title: 'Review the draft', instructions: 'Compare with notes.', steps: [{ id: 'M1P1', instruction: 'Find an unsupported claim.', hint: 'Check each claim.', evidence: 'One supported correction.', ...linked }] },
    scenarioLab: { title: 'A new draft', scenarios: [{ id: 'M1C1', title: 'A new request', situation: 'An AI draft adds a date.', challenge: 'Review the date.', expectedEvidence: 'Flag the unsupported date.', ...linked }] },
    moduleQuiz: { title: 'Module check', instructions: 'Select one answer.', questions: [question('M1MQ1')] },
  };
  return { choices: [{ message: { content: JSON.stringify(content) } }] };
});
assert.equal(generated.content.conceptExplainer.videos[0].uploadedVideo!.assetId, asset.id);
assert.equal(generated.content.narratedStages, undefined);
assert.deepEqual(await fs.readFile(path.join(testRoot, draft.id, asset.id, 'video')), await fs.readFile(clip), 'Generation must not rewrite the recording.');
assert.equal((await videoModuleDrafts(owner.id, draft.id))[0].outdated, false);
const context = await getCodexCourseContext(owner.id, draft.id); assert.equal(context.videoModuleDrafts.length, 1);
const run = await startBlueprint(owner.id, draft.id, draft.revision);
await processBlueprint(run.run.id, run.token!, async () => ({ choices: [{ message: { content: JSON.stringify(blueprintShape(blueprintInput(draft.brief, 'codex-ild-v2'))) } }] }));
await saveSmeReview(owner, draft.id, run.run.id, { moduleId: 'M1', expectedVersion: 0, verdict: 'approved', checklist: Object.fromEntries(Object.keys(EMPTY_SME_CHECKLIST).map(k => [k, true])) as typeof EMPTY_SME_CHECKLIST, feedback: '', priority: 'Optional' });
const pkg: AuthoredCoursePackageData = { schemaVersion: 1, title: draft.brief.title, subject: draft.brief.subject, durationMinutes: 20, briefRevision: draft.revision, blueprintRunId: run.run.id,
  objectiveEvidence: [{ objectiveId: 'O1', objective: draft.brief.objectives[0].text, sourceIds: ['Svideo'] }], sources: [{ id: 'Svideo', kind: 'sme', title: 'Reviewed video', reference: 'Uploaded source' }], modules: [generated.content],
  courseEnd: { miniProject: { title: 'Review a supplied draft', brief: 'Explain a source-grounded correction.', deliverable: 'Explanation', rubric: ['Uses source evidence'], ...linked }, masteryGate: { title: 'Final check', instructions: 'Select one answer.', passPercent: 80, questions: [question('FinalQ1')] }, reflection: { prompts: ['How will you review a draft?'] } },
};
const saved = await saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: draft.revision, expectedVersion: 0, content: pkg });
const review = await reviewAuthoredCourse(owner.id, owner, draft.id, { revisionId: saved.id, expectedReviewVersion: 0, verdict: 'approved', checklist: Object.fromEntries(COURSE_REVIEW_CHECKS.map(k => [k, true])) as Record<typeof COURSE_REVIEW_CHECKS[number], boolean>, feedback: '' });
await publishAuthoredCourse(owner.id, draft.id, { revisionId: saved.id, reviewId: review.id });
await database.insert(enrollments).values({ userId: 'video-learner', courseId: draft.id, answers: {} });
const learnerMedia = await serveConceptVideo('video-learner', draft.id, asset.id, new Request('http://localhost/media', { headers: { Range: 'bytes=0-31' } }));
assert.equal(learnerMedia.status, 206); assert.equal((await learnerMedia.arrayBuffer()).byteLength, 32);
const delivered = authoredDelivery({ courseId: draft.id, revisionId: saved.id, content: pkg });
const lesson = delivered.modules[0].blocks.find(b => b.stage === 'explainer');
assert(lesson?.stage === 'explainer' && lesson.videos?.[0].uploadedVideo?.src.includes(asset.id));
assert(lesson?.stage === 'explainer' && !lesson.videos?.[0].audio?.length);
assert.deepEqual({ profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) }, untouched);
if (process.env.VIDEO_FIRST_UI_SEED === '1') {
  await database.insert(profiles).values({ userId: owner.id, answers: {}, needs: [] }).onConflictDoNothing();
  await database.insert(enrollments).values({ userId: owner.id, courseId: draft.id, answers: {} });
  await fs.writeFile(path.join(process.cwd(), '.data', 'video-first-ui.json'), JSON.stringify({ courseId: draft.id, assetId: asset.id, videoRoot: testRoot, href: `/learn/courses/${draft.id}/M1/explainer` }));
} else {
  await assert.rejects(generateVideoModule(owner.id, draft.id, 'M1', draft.revision, async () => {
    await updateCreatorDraft(owner.id, draft.id, { brief: { ...draft.brief, audience: 'Changed audience during generation' }, revision: draft.revision });
    return { choices: [{ message: { content: JSON.stringify(generated.content) } }] };
  }), { code: 'brief_changed' });
  const changed = structuredClone(draft.brief); changed.sourceLibrary!.sources[0].video!.transcriptId = undefined;
  await updateCreatorDraft(owner.id, draft.id, { brief: changed, revision: draft.revision + 1 });
  assert.equal((await videoModuleDrafts(owner.id, draft.id))[0].outdated, true);
}
await closeDb();
console.log('PASS video-first: real upload/probe/audio extraction, reviewed captions, source binding, generated activities, unchanged original recording, owner/learner access, range/seek streaming, approval/publication, stale drafts and unchanged learner records');
