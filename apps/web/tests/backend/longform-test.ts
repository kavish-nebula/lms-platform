import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { EMPTY_BRIEF, type CourseBriefData } from '@/lib/content-creator';
import { blueprintInput } from '@/lib/instructional-blueprint';
import { validateProduction, type ProductionInput } from '@/lib/module-production';
import { SME_CHECKS, type ReviewChecklist } from '@/lib/sme-review';
import { getSessionUser } from '@/server/auth';
import { createCreatorDraft, getCreatorDraft, updateCreatorDraft, setProductionFormat, setDeliveryStructure } from '@/server/content-creator';
import { blueprintShape } from '@/server/blueprint-ai';
import { startBlueprint, processBlueprint, listBlueprints } from '@/server/creator-blueprints';
import { saveSmeReview } from '@/server/creator-sme-review';
import { startProduction, processProduction, productionState, saveProduction, reviewScripts } from '@/server/module-production';
import { longformExample, generateLongform, LONGFORM_SYSTEM } from '@/server/longform-ai';
import { productionAudioState, startProductionAudio, processProductionAudio } from '@/server/production-audio';
import { longformReadiness } from '@/server/longform-readiness';
import { narrationDurationValid } from '@/lib/longform-production';
import type { ProductionSpeaker } from '@/server/production-speech';
import { db } from '@/server/db/client';
import { creatorCourses, creatorProductionAudio, profiles, stepProgress, users } from '@/server/db/schema';

process.env.AUDIO = 'on'; process.env.KOKORO = 'on'; process.env.GLM_FALLBACK_MODEL = 'none';
const user = await getSessionUser(); const database = await db();
const learner = { profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) };
await database.insert(users).values({ id: 'longform-other', name: 'Other', email: 'other@example.test' });
const brief: CourseBriefData = { ...EMPTY_BRIEF, title: 'General AI long-form fixture', subject: 'AI', audience: 'Working professionals', outcomes: 'Build an evaluation brief', sourceText: 'Synthetic project notes. Outputs need source checking and human review.', dependencies: 'AI concepts before application', contexts: 'Fictional project', difficulties: 'Unsupported claims', duration: '5 hours', objectives: [{ text: 'Explain AI', bloom: 'Understand' }, { text: 'Analyze output', bloom: 'Analyze' }, { text: 'Create a brief', bloom: 'Create' }] };
const course = await createCreatorDraft(user.id, { brief });
await setDeliveryStructure(user.id, course.id, { structure: 'legacy', expectedStructure: 'codex-ild-v2' });
const started = await startBlueprint(user.id, course.id, 1); const blueprint = blueprintShape(blueprintInput(brief));
blueprint.modules[0].minutes = 300; blueprint.modules[0].steps.forEach((step, i) => { step.minutes = i === 8 ? 36 : 33; });
await processBlueprint(started.run.id, started.token!, async () => ({ choices: [{ message: { content: JSON.stringify(blueprint) } }] }));
const runId = started.run.id; const scope = [course.id, runId, 'M1'] as const;
await assert.rejects(setProductionFormat('longform-other', course.id, { format: 'longform-v1', expectedFormat: 'pilot' }), { status: 404 });
await setProductionFormat(user.id, course.id, { format: 'longform-v1', expectedFormat: 'pilot' });
assert.equal((await getCreatorDraft(user.id, course.id)).revision, 1, 'Format metadata does not rewrite SME revision');
await assert.rejects(startProduction(user, ...scope, crypto.randomUUID(), 'plan'), { status: 409 });
await saveSmeReview(user, course.id, runId, { moduleId: 'M1', expectedVersion: 0, verdict: 'approved', checklist: Object.fromEntries(SME_CHECKS.map(([key]) => [key, true])) as ReviewChecklist, feedback: 'Synthetic software fixture only', priority: 'Recommended' });
// Simulate a legacy no-op save: content is byte-for-byte equivalent but its
// counter advanced. Frozen snapshots and approval IDs must remain untouched.
await database.update(creatorCourses).set({ revision: 2 }).where(eq(creatorCourses.id, course.id));
assert(!(await listBlueprints(user.id, course.id))[0].outdated);
const reusedBlueprint = await startBlueprint(user.id, course.id, 2);
assert.equal(reusedBlueprint.run.id, runId); assert.equal(reusedBlueprint.token, null);
let state = await productionState(user.id, ...scope); const approval = state.approval!;
assert(state.eligible); assert.equal((await listBlueprints(user.id, course.id))[0].inputRevision, 1);
await assert.rejects(startProduction(user, ...scope, approval.id), { status: 400 });
await assert.rejects(startProduction(user, ...scope, approval.id, 'v1'), { status: 409 });
const input: ProductionInput = { run: (await listBlueprints(user.id, course.id))[0], moduleId: 'M1', approval, unit: { kind: 'plan', key: 'plan', checkpointPolicy: 'two-question-midpoint-v1' } };
const planContent = longformExample(input); planContent.plan!.videos.forEach((v, i) => { v.title = `Distinct AI topic ${i + 1}`; });
validateProduction(planContent, input, true);
assert(planContent.plan!.videos.every(v => v.checkpoint?.questions.length === 2 && v.checkpoint.afterSlideId === v.slides[3].id));
const missingCheckpoint = structuredClone(planContent); delete missingCheckpoint.plan!.videos[0].checkpoint;
assert.throws(() => validateProduction(missingCheckpoint, input, true), /two midpoint/);
const wrongCheckpoint = structuredClone(planContent); wrongCheckpoint.plan!.videos[0].checkpoint!.afterSlideId = 'v1-s2';
assert.throws(() => validateProduction(wrongCheckpoint, input, true), /midpoint slide/);
for (const invalid of [(() => { const c = structuredClone(planContent); c.plan!.videos.pop(); return c; })(), (() => { const c = structuredClone(planContent); c.plan!.videos[0].slides.splice(0, 2); return c; })(), (() => { const c = structuredClone(planContent); c.plan!.activities.quiz.questions[0].correct = 99; return c; })(), (() => { const c = structuredClone(planContent); c.plan!.activities.guided.steps[0].sourceIds = ['unknown']; return c; })()]) assert.throws(() => validateProduction(invalid, input));
const tooSmallBudget = structuredClone(input); tooSmallBudget.run.output!.modules[0].minutes = 25;
assert.throws(() => validateProduction(planContent, tooSmallBudget), /budget/);
let calls = 0;
await generateLongform(input, async request => { calls++; assert.equal(request.messages[0].content, LONGFORM_SYSTEM); return { choices: [{ message: { content: JSON.stringify(calls === 1 ? { ...planContent, slides: [{}] } : planContent) } }] }; });
assert.equal(calls, 2);
calls = 0; await assert.rejects(generateLongform(input, async () => { calls++; return { choices: [{ message: { content: '{}' } }] }; })); assert.equal(calls, 2);
const starts = await Promise.all([startProduction(user, ...scope, approval.id, 'plan'), startProduction(user, ...scope, approval.id, 'plan')]); assert.equal(starts.filter(s => s.token).length, 1);
const work = starts.find(s => s.token)!;
await processProduction(work.id, work.token!, user.id, async () => ({ choices: [{ message: { content: JSON.stringify(planContent) } }] }));
state = await productionState(user.id, ...scope); const planJob = state.jobs[0];
await assert.rejects(startProduction(user, ...scope, approval.id, 'v1'), { status: 409 });
const checks = { sourceAccuracy: true, alignment: true, pronunciation: true, pacing: true };
await reviewScripts(user, ...scope, { jobId: planJob.id, expectedRevision: 1, expectedReviewVersion: 0, verdict: 'approved', checklist: checks, feedback: 'Synthetic reviewed outline and activities.' });
assert((await longformReadiness(user.id, ...scope)).activitiesReady);

function pcm(seconds: number) { const rate = 100; const bytes = Buffer.alloc(44 + Math.round(seconds * rate * 2), 1); bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40); return bytes; }
let speechCalls = 0;
assert(narrationDurationValid(300)); assert(narrationDurationValid(420));
for (const value of [299.99, 420.01, NaN, Infinity]) assert(!narrationDurationValid(value));
const speaker = (outside: number | false): ProductionSpeaker => async (dir, clips, _voice, done) => { await mkdir(dir, { recursive: true }); for (const [i, c] of clips.entries()) { speechCalls++; await writeFile(path.join(dir, `${c.key}.wav`), pcm(outside !== false && i === 0 ? outside : 420)); await done(c.key); } };
let firstVideoId = ''; let firstVideoContent: ReturnType<typeof longformExample> | null = null;
for (const key of ['v1', 'v2', 'v3', 'v4', 'v5']) {
  const start = await startProduction(user, ...scope, approval.id, key);
  state = await productionState(user.id, ...scope); const videoJob = state.jobs.find(j => j.id === start.id)!;
  assert.equal(videoJob.input.unit?.kind === 'video' && videoJob.input.unit.maxSeconds, 420);
  assert.equal(videoJob.input.unit?.kind === 'video' && videoJob.input.unit.narrationPolicyVersion, 2);
  const video = longformExample(videoJob.input); video.slides.forEach(s => { s.narration = Array.from({ length: 860 }, (_, i) => `word${i}`).join(' '); });
  const shortScript = structuredClone(video); shortScript.slides[0].narration = 'Too short.';
  assert.throws(() => validateProduction(shortScript, videoJob.input, true), /600/);
  const wrongOrder = structuredClone(video); wrongOrder.slides.reverse(); assert.throws(() => validateProduction(wrongOrder, videoJob.input), /IDs and order/);
  const changedQuiz = structuredClone(video); changedQuiz.checkpoint!.questions[0].correct = 1;
  assert.throws(() => validateProduction(changedQuiz, videoJob.input), /reviewed midpoint quiz/);
  if (key === 'v1') {
    let extensionCalls = 0;
    const extended = await generateLongform(videoJob.input, async request => {
      extensionCalls++;
      const data = JSON.parse(request.messages[1].content!);
      if (request.messages[0].content.includes('ONE useful source-supported paragraph')) return { choices: [{ message: { content: JSON.stringify({ additionalNarration: Array.from({ length: 120 }, (_, i) => `detail${i}`).join(' ') }) } }] };
      const slide = structuredClone(video.slides.find(s => s.id === data.selectedSlide.id)!); slide.narration = Array.from({ length: 590 }, (_, i) => `word${i}`).join(' ');
      return { choices: [{ message: { content: JSON.stringify(slide) } }] };
    });
    assert.equal(extensionCalls, 16, 'One bounded extension per short slide; no extra repair loop');
    assert(extended.content.slides.every(s => s.narration.split(/\s+/).length === 710));
    let callsBeforeFailure = 0;
    await processProduction(start.id, start.token!, user.id, async request => {
      if (++callsBeforeFailure > 2) throw new Error('Synthetic interruption');
      const selected = JSON.parse(request.messages[1].content!).selectedSlide;
      return { choices: [{ message: { content: JSON.stringify(video.slides.find(s => s.id === selected.id)) } }] };
    });
    const interrupted = (await productionState(user.id, ...scope)).jobs.find(j => j.id === start.id)!;
    assert.equal(interrupted.status, 'failed'); assert.equal(interrupted.generatedSlides, 2);
    const retry = await startProduction(user, ...scope, approval.id, key);
    let resumedCalls = 0;
    await processProduction(retry.id, retry.token!, user.id, async request => {
      resumedCalls++; const selected = JSON.parse(request.messages[1].content!).selectedSlide;
      return { choices: [{ message: { content: JSON.stringify(video.slides.find(s => s.id === selected.id)) } }] };
    });
    assert.equal(resumedCalls, 6, 'Resume reuses the two validated checkpoints.');
  } else {
  await processProduction(start.id, start.token!, user.id, async request => { const selected = JSON.parse(request.messages[1].content!).selectedSlide; return { choices: [{ message: { content: JSON.stringify(video.slides.find(s => s.id === selected.id)) } }] }; });
  }
  state = await productionState(user.id, ...scope); let head = state.jobs.find(j => j.id === start.id)!;
  if (key === 'v1') { firstVideoId = head.id; firstVideoContent = video; }
  await reviewScripts(user, ...scope, { jobId: head.id, expectedRevision: 1, expectedReviewVersion: 0, verdict: 'approved', checklist: checks, feedback: 'Synthetic scripts, not actual teaching content.' });
  const audioInput = { jobId: head.id, revisionId: head.revisions[0].id, reviewId: (await productionState(user.id, ...scope)).jobs.find(j => j.id === head.id)!.reviews[0].id };
  const audio = await startProductionAudio(user.id, ...scope, audioInput);
  await processProductionAudio(audio.id, audio.token!, user.id, ...scope, speaker(key === 'v1' ? 299.9 : key === 'v2' ? 420.1 : false));
  if (key === 'v2') await database.update(creatorProductionAudio).set({ status: 'ready', error: null }).where(eq(creatorProductionAudio.id, audio.id)); // Older ready media must also obey the new upper bound.
  if (key === 'v1' || key === 'v2') {
    let a = await productionAudioState(user.id, ...scope, head.id); assert.equal(a.jobs[0].status, 'failed'); assert.equal(key === 'v1' ? a.jobs[0].shortSlides!.length : a.jobs[0].longSlides!.length, 1); assert.equal(a.minimumSeconds, 300); assert.equal(a.maximumSeconds, 420);
    await assert.rejects(startProductionAudio(user.id, ...scope, audioInput), { status: 409 });
    const edited = structuredClone(video); edited.slides[0].narration += ' Additional explanation.';
    await saveProduction(user, ...scope, { jobId: head.id, expectedRevision: 1, content: edited });
    head = (await productionState(user.id, ...scope)).jobs.find(j => j.id === head.id)!;
    assert(!(await productionAudioState(user.id, ...scope, head.id)).eligible);
    await reviewScripts(user, ...scope, { jobId: head.id, expectedRevision: 2, expectedReviewVersion: 1, verdict: 'approved', checklist: checks, feedback: 'Revised synthetic script.' });
    const reviewed = (await productionState(user.id, ...scope)).jobs.find(j => j.id === head.id)!;
    const retry = await startProductionAudio(user.id, ...scope, { jobId: head.id, revisionId: reviewed.revisions[0].id, reviewId: reviewed.reviews[0].id });
    speechCalls = 0; await processProductionAudio(retry.id, retry.token!, user.id, ...scope, speaker(false)); assert.equal(speechCalls, 1, 'Only changed narration is resynthesized');
    a = await productionAudioState(user.id, ...scope, head.id); assert.equal(a.jobs[0].status, 'ready'); assert.equal(a.jobs[0].clips.filter(c => c.reused).length, 7);
  }
}
assert((await longformReadiness(user.id, ...scope)).ready, 'All five compliant videos plus reviewed activities are required');
await assert.rejects(setDeliveryStructure('longform-other', course.id, { structure: 'six-stage-v1', expectedStructure: 'legacy' }), { status: 404 });
const delivery = await setDeliveryStructure(user.id, course.id, { structure: 'six-stage-v1', expectedStructure: 'legacy' });
assert.equal(delivery.revision, 2, 'Delivery metadata must not rewrite SME input');
await assert.rejects(setDeliveryStructure(user.id, course.id, { structure: 'legacy', expectedStructure: 'legacy' }), { status: 409 });
assert((await longformReadiness(user.id, ...scope)).ready, 'Reviewed media stays current after a delivery-layout change');
const newFlowRun = await startBlueprint(user.id, course.id, 2);
assert.equal(newFlowRun.run.promptVersion, 3); assert.equal(newFlowRun.run.input.deliveryStructure, 'six-stage-v1');
assert.equal((await productionState(user.id, ...scope)).approval!.id, approval.id);
await assert.rejects(productionState('longform-other', ...scope), { status: 404 });
const shortEdit = structuredClone(firstVideoContent!); shortEdit.slides[0].narration = 'Short manual draft.';
await saveProduction(user, ...scope, { jobId: firstVideoId, expectedRevision: 2, content: shortEdit });
await assert.rejects(reviewScripts(user, ...scope, { jobId: firstVideoId, expectedRevision: 3, expectedReviewVersion: 2, verdict: 'approved', checklist: checks, feedback: '' }), { status: 409 });
assert(!(await longformReadiness(user.id, ...scope)).ready);
const changedPlan = structuredClone(planContent); changedPlan.plan!.videos[0].slides[0].brief += ' Edited outline.';
await saveProduction(user, ...scope, { jobId: planJob.id, expectedRevision: 1, content: changedPlan });
state = await productionState(user.id, ...scope); assert(state.jobs.filter(j => j.input.unit?.kind === 'video').every(j => j.outdated));
await assert.rejects(saveProduction(user, ...scope, { jobId: firstVideoId, expectedRevision: 3, content: firstVideoContent! }), { status: 409 });
await assert.rejects(startProduction(user, ...scope, approval.id, 'v1'), { status: 409 });
await reviewScripts(user, ...scope, { jobId: planJob.id, expectedRevision: 2, expectedReviewVersion: 1, verdict: 'approved', checklist: checks, feedback: 'New synthetic plan approval.' });
const fresh = await startProduction(user, ...scope, approval.id, 'v1'); assert.notEqual(fresh.id, firstVideoId);
await updateCreatorDraft(user.id, course.id, { brief: { ...brief, sourceText: brief.sourceText + ' Material source change.' }, revision: 2 });
assert((await listBlueprints(user.id, course.id))[0].outdated);
assert(!(await productionState(user.id, ...scope)).eligible);
assert(!(await productionAudioState(user.id, ...scope, firstVideoId)).eligible);
await assert.rejects(startProduction(user, ...scope, approval.id, 'v2'), { status: 409 });
await setProductionFormat(user.id, course.id, { format: 'pilot', expectedFormat: 'longform-v1' });
assert((await productionState(user.id, ...scope)).jobs.every(j => j.outdated));
assert.deepEqual({ profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) }, learner);
console.log('PASS long-form: five videos, 7–9 slides, activity coverage, source/plan approvals, bounded repair, ownership, duplicate prevention, 300-second boundary, short-audio blocking, changed-clip reuse, readiness, stale plans and legacy isolation');
