import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
import { MODULE_CORE_PROMPT, MODULE_CORE_VERSION, moduleReadiness } from '@/lib/module-authoring';
import { sourceCoverage } from '@/lib/source-library';
import { courseAuthoringSystem } from '@/lib/course-authoring-prompt';
import { moduleInputHash } from '@/server/video-first-authoring';
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
import { queueModule, queueSlide, queueConcept, claimJob, finishJob, jobsFor } from '@/server/adapt/live';
import { adaptedModule } from '@/server/adapt/service';
import * as repo from '@/server/repo';
import { hookScenes, hookSceneAt, hookNarration } from '@/lib/video-first-hook';
import { prepareVideoHookAudio, videoHookAudio } from '@/server/video-hook-audio';
import { GET as hookAudioGet } from '@/app/api/v1/courses/[courseId]/hook-audio/[moduleId]/route';
import { conceptTemplate, conceptCanSeek, validatePersonalizedConcept } from '@/lib/personalized-concept';
import { healthcareAutomationConcept, healthcareAutomationBridges } from '@/lib/healthcare-automation-concept';

// A full learner-context derivative remains separate from its original recording.
const productionSnapshot = JSON.parse(await fs.readFile(path.resolve('../../fixtures/authored-courses/ai-for-production-module1/course.json'), 'utf8')) as AuthoredCoursePackageData;
const productionVideo = authoredDelivery({ courseId: 'dd1fec93-8c51-4f2d-9e0c-943823062c76', revisionId: crypto.randomUUID(), content: productionSnapshot }).modules[0].blocks.find(b => b.stage === 'explainer')!;
assert(productionVideo.stage === 'explainer');
const fixedVideo = productionVideo.videos![0];
const sourceTemplate = conceptTemplate(fixedVideo), sourceBefore = structuredClone(sourceTemplate);
const healthcare = healthcareAutomationConcept(sourceTemplate, 'dd1fec93-8c51-4f2d-9e0c-943823062c76', fixedVideo.title, { answers: { field: 'healthcare' } })!;
assert(healthcare && healthcare.scenes.every(s => s.visual === 'healthcare' && /clinic|reception/i.test(s.narration)));
assert.deepEqual(sourceTemplate, sourceBefore, 'Original transcript/template is never edited.');
assert.deepEqual(healthcare.scenes.map(s => [s.id, s.phase, s.sourceIds, s.objectiveIds]), sourceTemplate.scenes.map(s => [s.id, s.phase, s.sourceIds, s.objectiveIds]));
assert(healthcare.scenes.filter(s => s.phase === 'before').some(s => /PLC/.test(s.narration)));
assert(healthcare.scenes.filter(s => s.phase === 'before').some(s => /70 degrees/.test(s.narration)));
assert(!healthcareAutomationConcept(sourceTemplate, 'unrelated-course', fixedVideo.title, { answers: { field: 'healthcare' } }));
assert(!healthcareAutomationConcept(sourceTemplate, 'dd1fec93-8c51-4f2d-9e0c-943823062c76', fixedVideo.title, { answers: { field: 'finance' } }));
assert(!healthcareAutomationConcept(sourceTemplate, 'dd1fec93-8c51-4f2d-9e0c-943823062c76', 'Another lesson', { answers: { field: 'healthcare' } }));
const revisedHealthcare = structuredClone(healthcare); revisedHealthcare.scenes.forEach((s,i) => { s.bridge = healthcareAutomationBridges[i]; });
validatePersonalizedConcept(healthcare, revisedHealthcare);
const healthcareRoot = path.resolve('../../fixtures/authored-courses/ai-for-production-module1/healthcare-automation');
const savedHealthcare = JSON.parse(await fs.readFile(path.join(healthcareRoot, 'lesson.json'), 'utf8'));
assert.deepEqual(savedHealthcare.scenes.map((s: { narration: string; bridge: string }) => [s.narration, s.bridge]), revisedHealthcare.scenes.map(s => [s.narration, s.bridge]));
const healthcareAudio = JSON.parse(await fs.readFile(path.join(healthcareRoot, 'audio-manifest.json'), 'utf8'));
assert.equal(healthcareAudio.clips.length, revisedHealthcare.scenes.length);
assert(healthcareAudio.measuredDurationSeconds > 60 && healthcareAudio.measuredDurationSeconds <= 420);
for (const clip of healthcareAudio.clips) {
  const bytes = await fs.readFile(path.join(healthcareRoot, clip.file));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.length, clip.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256);
}

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
  assert.equal('audioTimestamp' in body.generationConfig, false, 'Gemini API must not receive the Vertex-only timestamp option');
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
assert.equal(delivered.course.subjectLabel, pkg.subject);
assert.equal(delivered.course.domain, pkg.subject);
assert.deepEqual(delivered.course.skills, pkg.modules.map(m => m.title));
const practice = delivered.modules[0].blocks.find(b => b.stage === 'guided');
assert(practice?.stage === 'guided');
assert.deepEqual(practice.presentation?.phases?.map(p => p.body), pkg.modules[0].guidedPractice.steps.map(s => s.instruction));
assert.equal(delivered.course.finale?.steps.at(-1)?.title, 'Reflect on your learning');
const lesson = delivered.modules[0].blocks.find(b => b.stage === 'explainer');
assert(lesson?.stage === 'explainer' && lesson.videos?.[0].uploadedVideo?.src.includes(asset.id));
assert(lesson?.stage === 'explainer' && !lesson.videos?.[0].audio?.length);
assert.deepEqual({ profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) }, untouched);
const hookFixture = { ...pkg.modules[0].problemHook, situation: 'Fictional case.\nDOC-A: The value is 3.5, not 35.\nA draft makes an unsupported claim.' };
const scenes = hookScenes(hookFixture);
assert(scenes.length >= 4);
assert.equal(hookNarration(hookFixture), `${hookFixture.situation} ${hookFixture.question}`.replace(/\s+/g, ' '));
assert.equal(scenes.at(-1)!.kind, 'question');
assert.equal(hookSceneAt(scenes, 0), 0);
assert.equal(hookSceneAt(scenes, scenes[1].start), 1);
assert.equal(hookSceneAt(scenes, scenes[1].start - 0.00000001), 1);
assert.equal(hookSceneAt(scenes, 1), scenes.length - 1);
await assert.rejects(videoHookAudio('stranger', draft.id, 'M1'), { status: 404 });
let speechCalls = 0;
const hookWav = path.join(testRoot, 'hook.wav');
execFileSync(ffmpeg!, ['-v', 'error', '-i', clip, '-vn', '-c:a', 'pcm_s16le', '-fflags', '+bitexact', '-map_metadata', '-1', hookWav], { windowsHide: true });
const hookVoice = async (dir: string, clips: { key: string; text: string }[]) => {
  speechCalls++;
  assert.equal(clips.map(c => c.text).join(' '), hookNarration(pkg.modules[0].problemHook));
  await fs.mkdir(dir, { recursive: true });
  for (const c of clips) await fs.copyFile(hookWav, path.join(dir, `${c.key}.wav`));
  return new Set(clips.map(c => c.key));
};
await Promise.all([prepareVideoHookAudio(owner.id, draft.id, 'M1', hookVoice), prepareVideoHookAudio(owner.id, draft.id, 'M1', hookVoice)]);
assert.equal(speechCalls, 1, 'Simultaneous hook requests share one rendering job.');
await prepareVideoHookAudio(owner.id, draft.id, 'M1', hookVoice);
assert.equal(speechCalls, 1, 'Original hook speech is cached by release and voice.');
assert((await videoHookAudio('video-learner', draft.id, 'M1')).length > 0);
const hookRange = await hookAudioGet(new Request('http://localhost/hook', { headers: { Range: 'bytes=0-3' } }), { params: Promise.resolve({ courseId: draft.id, moduleId: 'M1' }) });
assert.equal(hookRange.status, 206); assert.equal(await hookRange.text(), 'RIFF');
assert.equal((await hookAudioGet(new Request('http://localhost/hook', { headers: { Range: 'bytes=999999-' } }), { params: Promise.resolve({ courseId: draft.id, moduleId: 'M1' }) })).status, 416);
process.env.ADAPTIVE_PYTHON_ENABLED = 'true';
const learner = { ...owner, id: 'video-learner' };
await repo.saveProfile(learner.id, { domain: 'healthcare', role: 'admin' }, []);
const queued = await queueModule(learner, draft.id, 'M1');
assert.equal(queued.activities.length, 4);
assert.equal(queued.hook, null);
assert((await jobsFor((await repo.findEnrollment(learner.id, draft.id))!.id, 'M1')).every(j => j.videoId.startsWith('activity:') || j.videoId.startsWith('concept:')), 'Original recordings are retained; reviewed transcripts may prepare separate personalized concepts.');
await assert.rejects(queueSlide(learner, draft.id, 'M1', lesson!.videos![0].id, 0, 'initial'), { code: 'fixed_video' });
const hookJob = (await claimJob())!;
const personalized = structuredClone(hookJob.input.authored) as { problemHook: typeof generated.content.problemHook };
personalized.problemHook.title = 'Review a healthcare draft';
await assert.rejects(finishJob(hookJob.id, hookJob.lease!, personalized, 'test', {}, null), { code: 'voice_unavailable' });
await finishJob(hookJob.id, hookJob.lease!, personalized, 'test', {}, async (_dir, clips) => new Set(clips.map(c => c.key)));
const view = await adaptedModule(learner, draft.id, 'M1', () => {});
assert.equal(view.activities?.problemHook?.title, personalized.problemHook.title);
assert.match(view.activityAudio!.hook, /\/clips\/[a-f0-9]{64}\.wav$/);
assert.equal(view.activitySceneAudio!.hook.length, hookScenes(personalized.problemHook).length);
await database.insert(users).values({ id: 'video-learner-two', name: 'Second learner', email: 'video-two@example.test' });
await repo.saveProfile('video-learner-two', { domain: 'student', studyFieldOther: 'mechanical engineering' }, []);
await repo.upsertEnrollment('video-learner-two', draft.id, { answers: {}, supportOverride: 'auto', pace: null, precheck: null });
const second = await queueModule({ ...owner, id: 'video-learner-two' }, draft.id, 'M1');
assert.notEqual(second.activities[0].enrollmentId, queued.activities[0].enrollmentId);
assert.notDeepEqual(second.activities[0].input.context, queued.activities[0].input.context);
assert.equal((await adaptedModule({ ...owner, id: 'video-learner-two' }, draft.id, 'M1', () => {})).activities?.problemHook, undefined, 'A second learner never receives the first learner\'s adapted activity.');
const pending = (await claimJob())!;
await repo.saveProfile('video-learner-two', { domain: 'education', role: 'teacher' }, []);
await assert.rejects(finishJob(pending.id, pending.lease!, pending.input.authored, 'test', {}, null), { code: 'profile_changed' });
assert.deepEqual(await database.select().from(stepProgress), untouched.progress, 'Adaptation never grants progress.');
const conceptVideo = lesson!.videos![0];
assert(conceptVideo.personalizationSource);
const template = conceptTemplate(conceptVideo);
assert.equal(template.scenes[0].phase, 'before');
assert.equal(template.scenes.at(-1)!.phase, 'after');
assert.equal(template.scenes.map(s => s.narration).join(' '), conceptVideo.personalizationSource.parts.map(p => p.narration).join(' ').replace(/\s+/g, ' '));
assert.equal(conceptCanSeek(template.scenes, template.scenes.length - 1, false), false);
assert.equal(conceptCanSeek(template.scenes, template.scenes.length - 1, true), true);
const moved = structuredClone(template); moved.scenes[0].phase = 'after';
assert.throws(() => validatePersonalizedConcept(template, moved));
const lost = structuredClone(template); lost.scenes[0].narration = 'AI.';
assert.throws(() => validatePersonalizedConcept(template, lost));
const changedNumbers = structuredClone(template); changedNumbers.scenes[0].narration += ' Assume 12345.';
assert.throws(() => validatePersonalizedConcept(template, changedNumbers));
const originalRecording = structuredClone(conceptVideo.uploadedVideo);
const originalQuiz = structuredClone(conceptVideo.midQuiz);
await queueModule(learner, draft.id, 'M1');
const prefetchedConcept = (await jobsFor((await repo.findEnrollment(learner.id, draft.id))!.id, 'M1')).find(j => j.videoId === `concept:${conceptVideo.id}`)!;
assert(prefetchedConcept, 'Module preparation includes personalized concepts and their narration.');
assert(prefetchedConcept.priority < 10, 'Prefetch does not consume the interactive lane.');
const conceptA = await queueConcept(learner, draft.id, 'M1', conceptVideo.id);
assert.equal(conceptA.id, prefetchedConcept.id);
assert.equal(conceptA.priority, 10, 'Opening the concept promotes its existing preparation.');
assert.equal((await queueConcept(learner, draft.id, 'M1', conceptVideo.id)).id, conceptA.id);
const conceptB = await queueConcept({ ...owner, id: 'video-learner-two' }, draft.id, 'M1', conceptVideo.id);
assert.notEqual(conceptA.fingerprint, conceptB.fingerprint);
assert(!JSON.stringify(conceptA.input).includes('FinalQ1'), 'Assessment questions and keys never enter concept generation.');
await assert.rejects(queueConcept({ ...owner, id: 'outsider' }, draft.id, 'M1', conceptVideo.id), { code: 'not_enrolled' });
const claimedConcept = (await claimJob('interactive'))!;
assert.equal(claimedConcept.id, conceptA.id);
const tailored = structuredClone(template);
tailored.scenes[0].title = 'Review a healthcare draft';
tailored.scenes[0].points[0] = 'Check the healthcare draft against supplied notes.';
tailored.scenes.forEach(s => { s.bridge = 'For a fictional healthcare report, compare the draft with supplied clinical notes.'; });
validatePersonalizedConcept(template, tailored);
await finishJob(conceptA.id, claimedConcept.lease!, tailored, 'test', {}, async (dir, clips) => { await fs.mkdir(dir, { recursive: true }); for (const c of clips) await fs.copyFile(hookWav, path.join(dir, `${c.key}.wav`)); return new Set(clips.map(c => c.key)); });
const conceptReady = (await jobsFor(conceptA.enrollmentId, 'M1')).find(j => j.id === conceptA.id)!;
assert.equal(conceptReady.status, 'ready');
assert.equal(Object.keys(conceptReady.content!.audio as Record<string, string>).length, template.scenes.length);
assert.deepEqual(conceptVideo.uploadedVideo, originalRecording);
assert.deepEqual(conceptVideo.midQuiz, originalQuiz);
assert.equal((await jobsFor(conceptB.enrollmentId, 'M1')).find(j => j.id === conceptB.id)!.content, null, 'A second profile cannot receive the first profile\'s lesson.');
const secondClaim = (await claimJob('interactive'))!;
assert.equal(secondClaim.id, conceptB.id);
const longVoice = async (dir: string, clips: { key: string }[]) => {
  const dataBytes = 43000; const wav = Buffer.alloc(44 + dataBytes); wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataBytes, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(50, 24); wav.writeUInt32LE(100, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataBytes, 40);
  await fs.mkdir(dir, { recursive: true }); for (const c of clips) await fs.writeFile(path.join(dir, `${c.key}.wav`), wav); return new Set(clips.map(c => c.key));
};
const secondText = structuredClone(tailored);
await assert.rejects(finishJob(conceptB.id, secondClaim.lease!, secondText, 'test', {}, longVoice), { code: 'duration_exceeded' });
await repo.saveProfile('video-learner-two', { domain: 'student', studyFieldOther: 'mechanical engineering' }, []);
await assert.rejects(finishJob(conceptB.id, secondClaim.lease!, secondText, 'test', {}, null), { code: 'profile_changed' });
// Connected recordings need the same hook speech path as uploaded recordings.
const connectedDraft = await createCreatorDraft(owner.id, { brief: { ...draft.brief, sourceLibrary: undefined, sourceText: 'Use AI to draft from supplied notes. Review the draft against the notes before sharing it.' } });
const connectedPackage = JSON.parse(JSON.stringify(pkg).replaceAll('Svideo', 'S1')) as AuthoredCoursePackageData;
connectedPackage.briefRevision = connectedDraft.revision;
delete connectedPackage.blueprintRunId;
connectedPackage.sources = [{ id: 'S1', kind: 'sme', title: 'Connected source fixture', reference: 'Synthetic source evidence.' }];
for (const video of connectedPackage.modules[0].conceptExplainer.videos) {
  delete video.uploadedVideo;
  video.sourceMedia = { audio: '/source-fixture.wav', transcript: video.slides.map(s => s.narration).join(' ') };
}
const connectedHead = await saveAuthoredCourse(owner.id, connectedDraft.id, { expectedBriefRevision: connectedDraft.revision, expectedVersion: 0, content: connectedPackage });
const connectedReview = await reviewAuthoredCourse(owner.id, owner, connectedDraft.id, { revisionId: connectedHead.id, expectedReviewVersion: 0, verdict: 'approved', checklist: Object.fromEntries(COURSE_REVIEW_CHECKS.map(k => [k, true])) as Parameters<typeof reviewAuthoredCourse>[3]['checklist'], feedback: 'Synthetic connected-media regression fixture.' });
await publishAuthoredCourse(owner.id, connectedDraft.id, { revisionId: connectedHead.id, reviewId: connectedReview.id });
await prepareVideoHookAudio(owner.id, connectedDraft.id, 'M1', hookVoice);
await repo.upsertEnrollment('video-learner', connectedDraft.id, { answers: {}, supportOverride: 'auto', pace: null, precheck: null });
assert((await videoHookAudio('video-learner', connectedDraft.id, 'M1')).length > 0, 'Connected source media supports enrolled-learner hook narration.');
await assert.rejects(videoHookAudio('stranger', connectedDraft.id, 'M1'), { status: 404 });
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
// A prepared module must not wait for videos, transcripts or SME input for later modules.
let partial = await createCreatorDraft(owner.id, { brief: { ...brief, sourceLibrary: undefined } });
const partialAsset = await uploadConceptVideo(owner.id, partial.id, new File([await fs.readFile(clip)], 'module-one.mp4', { type: 'video/mp4' }));
const partialTranscript = await reviewVideoTranscript(owner.id, partial.id, partialAsset.id, vtt);
const partialBrief: CourseBriefData = { ...brief, objectives: [...brief.objectives, { text: 'Evaluate a later topic.', bloom: 'Evaluate' }], sourceLibrary: {
  version: 1, modules: [
    { ...brief.sourceLibrary!.modules[0], instructions: { version: 1, objectiveIds: ['O1'], scope: 'Review drafts only', exclusions: 'Later topic', prerequisites: 'None', dependsOn: [], teachingNotes: 'Use short examples.' } },
    { id: 'M2', title: 'Later topic', topics: [{ id: 'T2', title: 'Later concept' }] },
  ], sources: [
    { ...brief.sourceLibrary!.sources[0], text: partialTranscript.text, video: { assetId: partialAsset.id, durationSeconds: 6, transcriptId: partialTranscript.id, checkpointSeconds: 3 } },
    { id: 'Slater', revision: 1, title: 'Later module evidence', scope: 'topic', moduleId: 'M2', topicId: 'T2', objectiveIds: ['O2'], text: 'PRIVATE_LATER_MODULE_EVIDENCE', reference: '', video: { assetId: crypto.randomUUID(), durationSeconds: 6 } },
  ],
} };
partial = await updateCreatorDraft(owner.id, partial.id, { brief: partialBrief, revision: partial.revision });
assert(sourceCoverage(partial.brief).length > 0);
assert.deepEqual(moduleReadiness(partial.brief, 'M1'), []);
assert(moduleReadiness(partial.brief, 'M2').length > 0);
const partialContext = await getCodexCourseContext(owner.id, partial.id);
assert.equal(partialContext.moduleAuthoring!.corePromptVersion, MODULE_CORE_VERSION);
assert.deepEqual(partialContext.moduleAuthoring!.modules[0].gaps, []);
assert(partialContext.moduleAuthoring!.modules[1].gaps.length > 0);
await assert.rejects(generateVideoModule('video-learner', partial.id, 'M1', partial.revision), { status: 404 });
const moduleTransport: Parameters<typeof generateVideoModule>[4] = async request => {
  assert.equal(request.messages[0].content, MODULE_CORE_PROMPT);
  assert(!request.messages[1].content.includes('PRIVATE_LATER_MODULE_EVIDENCE'));
  const input = JSON.parse(request.messages[1].content);
  assert.equal(input.courseContext.outline.length, 2);
  assert.equal(input.moduleInstructions.scope, 'Review drafts only');
  assert.deepEqual(input.objectives.map((o: { id: string }) => o.id), ['O1']);
  assert.deepEqual(input.sources.map((s: { id: string }) => s.id), ['Svideo']);
  return { choices: [{ message: { content: JSON.stringify({ ...generated.content, conceptExplainer: { videos: input.fixedVideos.map((video: Record<string, unknown>) => ({ ...video, midpointQuiz: { ...(video.midpointQuiz as object), questions: [question('M1Q1'), question('M1Q2')] } })) } }) } }] };
};
const partialModule = await generateVideoModule(owner.id, partial.id, 'M1', partial.revision, moduleTransport);
assert.equal(partialModule.status, 'needs_review');
assert.equal(partialModule.provenance!.corePromptVersion, MODULE_CORE_VERSION);
assert.equal(partialModule.provenance!.sourceRevisions[0].transcriptId, partialTranscript.id);
assert.equal((await videoModuleDrafts(owner.id, partial.id))[0].outdated, false);
const nextModuleBrief = structuredClone(partial.brief);
nextModuleBrief.sourceLibrary!.sources[1].text += ' Updated later evidence.';
nextModuleBrief.sourceLibrary!.modules[1].instructions = { version: 1, objectiveIds: ['O2'], scope: 'Only later topic', exclusions: '', prerequisites: '', dependsOn: [], teachingNotes: 'Use an analogy in Module 2.' };
partial = await updateCreatorDraft(owner.id, partial.id, { brief: nextModuleBrief, revision: partial.revision });
assert.equal((await videoModuleDrafts(owner.id, partial.id))[0].outdated, false, 'Unrelated module evidence does not invalidate the ready fragment.');
const ownModuleBrief = structuredClone(partial.brief);
ownModuleBrief.sourceLibrary!.modules[0].instructions!.scope = 'Changed scope';
partial = await updateCreatorDraft(owner.id, partial.id, { brief: ownModuleBrief, revision: partial.revision });
assert.equal((await videoModuleDrafts(owner.id, partial.id))[0].outdated, true, 'Changed module instructions require regeneration.');
assert.equal((await videoModuleDrafts(owner.id, partial.id)).length, 1, 'Edits retain immutable generation history.');
await assert.rejects(generateVideoModule(owner.id, partial.id, 'M1', partial.revision - 1, moduleTransport), { code: 'brief_changed' });
const invalidDependency = structuredClone(partial.brief);
invalidDependency.sourceLibrary!.modules[0].instructions!.dependsOn = ['M2'];
assert(moduleReadiness(invalidDependency, 'M1').some(issue => issue.includes('earlier module')));
const remappedBrief = structuredClone(partial.brief);
remappedBrief.sourceLibrary!.modules[0].instructions!.scope = 'Review drafts only';
partial = await updateCreatorDraft(owner.id, partial.id, { brief: remappedBrief, revision: partial.revision });
let rejectedAttempts = 0;
await assert.rejects(generateVideoModule(owner.id, partial.id, 'M1', partial.revision, async request => {
  rejectedAttempts++;
  const reply = await moduleTransport(request);
  const value = JSON.parse(reply.choices![0].message!.content!);
  value.workedExamples[0].sourceIds = ['Slater'];
  return { choices: [{ message: { content: JSON.stringify(value) } }] };
}), { code: 'generation_validation' });
assert.equal(rejectedAttempts, 2, 'Invalid cross-module evidence gets one bounded repair, never a saved draft.');
assert.equal((await videoModuleDrafts(owner.id, partial.id)).length, 1);
const promptBrief = { ...partial.brief, systemPrompt: 'Use short sentences and practical production examples.' };
assert.notEqual(moduleInputHash(promptBrief, 'M1'), moduleInputHash(partial.brief, 'M1'), 'Changed course instructions invalidate generated module input.');
assert.equal(moduleInputHash({ ...partial.brief, systemPrompt: '' }, 'M1'), moduleInputHash(partial.brief, 'M1'), 'Blank optional guidance preserves legacy module hashes.');
assert(courseAuthoringSystem(MODULE_CORE_PROMPT, promptBrief).includes(promptBrief.systemPrompt));
assert.equal(courseAuthoringSystem(MODULE_CORE_PROMPT, partial.brief), MODULE_CORE_PROMPT);
partial = await updateCreatorDraft(owner.id, partial.id, { brief: promptBrief, revision: partial.revision });
assert.equal((await getCodexCourseContext(owner.id, partial.id)).brief.systemPrompt, promptBrief.systemPrompt);
assert.equal((await videoModuleDrafts(owner.id, partial.id))[0].outdated, true);
const withPrompt = await generateVideoModule(owner.id, partial.id, 'M1', partial.revision, async request => {
  assert(request.messages[0].content.includes(promptBrief.systemPrompt));
  assert(request.messages[0].content.includes('CREATOR COURSE SYSTEM PROMPT'));
  assert.equal(JSON.parse(request.messages[1].content).courseContext.systemPrompt, promptBrief.systemPrompt);
  return moduleTransport({ ...request, messages: [{ ...request.messages[0], content: MODULE_CORE_PROMPT }, ...request.messages.slice(1)] });
});
assert.equal((await videoModuleDrafts(owner.id, partial.id)).find(m => m.id === withPrompt.id)!.outdated, false);
await closeDb();
console.log('PASS video-first: upload/transcripts, module-scoped generation, separate instructions/evidence, prompt provenance, unrelated-edit preservation, stale/concurrent writes, cross-module rejection, bounded repair, learner streaming and review/publication');
