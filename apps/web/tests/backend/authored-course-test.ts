import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateAuthoredCourse, COURSE_REVIEW_CHECKS, type AuthoredCoursePackageData } from '@/lib/authored-course';
import { buildCoursePptx } from '@/lib/pptx-export';
import { EMPTY_BRIEF } from '@/lib/content-creator';
import { createCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { authoredCourseState, createCodexGrant, getCodexCourseContext, resolveCodexGrant, revokeCodexGrant, reviewAuthoredCourse, saveAuthoredCourse } from '@/server/authored-course';
import { authoredCourseAudioClip, authoredCourseAudioState, processAuthoredCourseAudio, startAuthoredCourseAudio } from '@/server/authored-course-audio';
import { getSessionUser } from '@/server/auth';
import { db } from '@/server/db/client';
import { creatorAuthoredCourseRevisions, creatorAuthoredCourseReviews } from '@/server/db/schema';
import { POST as MCP_POST } from '@/app/api/mcp/ild-course-creator/route';

const owner = await getSessionUser();
const brief = {
  ...EMPTY_BRIEF,
  title: 'AI Foundations for Working Professionals',
  subject: 'Use AI responsibly at work',
  audience: 'Working professionals',
  sourceText: 'SME source: Approved learning objectives and internal AI use principles.',
  references: 'https://example.org/research/ai-literacy',
  objectives: [{ text: 'Identify an appropriate workplace use for generative AI.', bloom: 'Understand' as const }],
};
const draft = await createCreatorDraft(owner.id, { brief });
assert.equal(draft.deliveryStructure, 'codex-ild-v2');
const context = await getCodexCourseContext(owner.id, draft.id);
assert.deepEqual(context.references, [{ id: 'R1', reference: brief.references }]);
assert.deepEqual(context.moduleSequence, ['hook', 'concept', 'worked_example', 'guided_practice', 'scenario', 'quiz']);

const linked = { objectiveIds: ['O1'], sourceIds: ['S1'] };
const question = (id: string) => ({ id, prompt: `Question ${id}?`, choices: ['A', 'B'], correct: 0, hint: 'Check the source.', explanation: 'The source supports this answer.', ...linked });
const pkg: AuthoredCoursePackageData = {
  schemaVersion: 1, title: brief.title, subject: brief.subject, durationMinutes: 30, briefRevision: draft.revision,
  objectiveEvidence: [{ objectiveId: 'O1', objective: brief.objectives[0].text, sourceIds: ['S1', 'R1'] }],
  sources: [{ id: 'S1', kind: 'sme', title: 'SME material', reference: 'Internal course brief' }, { id: 'R1', kind: 'research', title: 'AI literacy research', reference: brief.references, publisher: 'Example Institute', url: brief.references }],
  modules: [{
    id: 'M1', title: 'AI at work', durationMinutes: 30, objectiveIds: ['O1'], sourceIds: ['S1', 'R1'],
    problemHook: { title: 'A work decision', situation: 'A team must decide how to handle a repetitive task.', question: 'Where could AI help?', ...linked },
    conceptExplainer: { videos: [{ id: 'V1', title: 'Choosing an AI task', plannedMinutes: 6, slides: [{ id: 'SL1', title: 'Start with the task', body: ['Describe the work.'], narration: 'Begin by describing the work and the outcome.', plannedNarrationSeconds: 60, ...linked }, { id: 'SL2', title: 'Set a boundary', body: ['Choose a safe review step.'], narration: 'Begin by describing the work and the outcome.', plannedNarrationSeconds: 60, ...linked }], midpointQuiz: { afterSlideId: 'SL1', questions: [question('Q1'), question('Q2')] } }] },
    workedExamples: [{ id: 'EX1', title: 'Drafting a summary', problem: 'A team reviews many reports.', reasoning: ['Identify the repetitive part.', 'Check sensitive data.'], result: 'Use a bounded draft-and-review workflow.', ...linked }],
    guidedPractice: { title: 'Choose a task', instructions: 'Use the supplied workplace brief.', steps: [{ id: 'GP1', instruction: 'Name the task.', hint: 'Focus on one step.', evidence: 'A bounded task statement.', ...linked }] },
    scenarioLab: { title: 'Review a proposal', scenarios: [{ id: 'SC1', title: 'A weekly summary', situation: 'A fictional team wants to summarise updates.', challenge: 'Set a safe boundary.', expectedEvidence: 'A review step and clear input limits.', ...linked }] },
  }],
  courseEnd: {
    miniProject: { title: 'AI use proposal', brief: 'Design one responsible workplace use.', deliverable: 'A one-page decision record.', rubric: ['Clear task', 'Appropriate review'], ...linked },
    masteryGate: { title: 'Course mastery', instructions: 'Answer each objective-aligned item.', passPercent: 80, questions: [question('MG1')] },
    reflection: { prompts: ['What will you try next?'] },
  },
};

assert.equal(validateAuthoredCourse(pkg, { objectives: ['O1'], smeSourceIds: ['S1'], briefRevision: draft.revision }).modules.length, 1);
assert.throws(() => validateAuthoredCourse({ ...pkg, modules: [{ ...pkg.modules[0], conceptExplainer: { videos: [{ ...pkg.modules[0].conceptExplainer.videos[0], midpointQuiz: { ...pkg.modules[0].conceptExplainer.videos[0].midpointQuiz, afterSlideId: 'elsewhere' } }] } }] }, { objectives: ['O1'], smeSourceIds: ['S1'], briefRevision: draft.revision }), /midpoint slide/);
assert.throws(() => validateAuthoredCourse({ ...pkg, modules: [{ ...pkg.modules[0], id: 'V1' }] }, { objectives: ['O1'], smeSourceIds: ['S1'], briefRevision: draft.revision }), /IDs must be unique/);
assert.throws(() => validateAuthoredCourse({ ...pkg, modules: [{ ...pkg.modules[0], conceptExplainer: { videos: [{ ...pkg.modules[0].conceptExplainer.videos[0], slides: [{ ...pkg.modules[0].conceptExplainer.videos[0].slides[0], sourceIds: ['UNKNOWN'] }] }] } }] }, { objectives: ['O1'], smeSourceIds: ['S1'], briefRevision: draft.revision }), /Unknown source/);

const saved = await saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: draft.revision, expectedVersion: 0, content: pkg });
assert.equal(saved.version, 1);
await assert.rejects(saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: draft.revision, expectedVersion: 0, content: pkg }), { status: 409 });
await assert.rejects(authoredCourseState('different-owner', draft.id), { status: 404 });
const approved = await reviewAuthoredCourse(owner.id, { id: owner.id, name: 'Demo reviewer' }, draft.id, {
  revisionId: saved.id, expectedReviewVersion: 0, verdict: 'approved', checklist: Object.fromEntries(COURSE_REVIEW_CHECKS.map(key => [key, true])) as Record<typeof COURSE_REVIEW_CHECKS[number], boolean>, feedback: '',
});
assert.equal(approved.verdict, 'approved');
await assert.rejects(reviewAuthoredCourse(owner.id, { id: owner.id, name: 'Demo reviewer' }, draft.id, {
  revisionId: saved.id, expectedReviewVersion: 1, verdict: 'approved', checklist: { ...Object.fromEntries(COURSE_REVIEW_CHECKS.map(key => [key, true])), factualAccuracy: false } as Record<typeof COURSE_REVIEW_CHECKS[number], boolean>, feedback: '',
}), { status: 422 });

process.env.AUDIO = 'on'; process.env.KOKORO = 'on';
const wav = Buffer.alloc(48); wav.write('RIFF', 0); wav.writeUInt32LE(40, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4, 40);
const speaker = async (dir: string, clips: { key: string }[], _voice: unknown, completed: (key: string) => Promise<void>) => { for (const clip of clips) { await writeFile(path.join(dir, `${clip.key}.wav`), wav); await completed(clip.key); } };
const audio1 = await startAuthoredCourseAudio(owner.id, draft.id, saved.id);
await processAuthoredCourseAudio(audio1.id, audio1.token!, owner.id, draft.id, speaker);
let audioState = await authoredCourseAudioState(owner.id, draft.id, saved.id);
assert.equal(audioState.jobs[0].status, 'ready'); assert.equal(audioState.jobs[0].clips.length, 2);
assert.equal((await authoredCourseAudioClip(owner.id, draft.id, saved.id, 'SL1')).clip.slideId, 'SL1');
await assert.rejects(authoredCourseAudioClip('different-owner', draft.id, saved.id, 'SL1'), { status: 404 });
const changedPackage = structuredClone(pkg); changedPackage.modules[0].conceptExplainer.videos[0].slides[1].narration = 'Set an explicit review boundary for the AI task.';
const saved2 = await saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: draft.revision, expectedVersion: 1, content: changedPackage });
const audio2 = await startAuthoredCourseAudio(owner.id, draft.id, saved2.id);
await processAuthoredCourseAudio(audio2.id, audio2.token!, owner.id, draft.id, speaker);
audioState = await authoredCourseAudioState(owner.id, draft.id, saved2.id);
assert.equal(audioState.jobs[0].status, 'ready'); assert.equal(audioState.jobs[0].clips.length, 2);
assert.equal(audioState.jobs[0].clips.filter(clip => clip.reused).length, 1, 'Unchanged narration reuses its saved WAV clip.');

const edited = { ...brief, title: `${brief.title} revised` };
const changedDraft = await updateCreatorDraft(owner.id, draft.id, { brief: edited, revision: draft.revision });
assert.equal(changedDraft.revision, draft.revision + 1);
assert.equal((await authoredCourseState(owner.id, draft.id)).revisions[0].outdated, true);
assert.equal((await (await db()).select().from(creatorAuthoredCourseRevisions).where(eq(creatorAuthoredCourseRevisions.id, saved.id))).length, 1);
assert.equal((await (await db()).select().from(creatorAuthoredCourseReviews).where(eq(creatorAuthoredCourseReviews.revisionId, saved.id))).length, 1);

const firstGrant = await createCodexGrant(owner.id, draft.id);
assert.deepEqual(await resolveCodexGrant(firstGrant.token), { ownerId: owner.id, courseId: draft.id });
const mcpRequest = (token: string, body: unknown) => new Request('http://localhost/api/mcp/ild-course-creator', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });
const initialized = await MCP_POST(mcpRequest(firstGrant.token, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'authoring-test', version: '1.0.0' } } }));
assert.equal(initialized.status, 200);
const discovered = await MCP_POST(mcpRequest(firstGrant.token, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));
assert.deepEqual((await discovered.json()).result.tools.map((tool: { name: string }) => tool.name).sort(), ['get_course_context', 'get_course_draft', 'save_course_draft']);
const toolContext = await MCP_POST(mcpRequest(firstGrant.token, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_course_context', arguments: {} } }));
assert((await toolContext.json()).result.content[0].text.includes('AI Foundations for Working Professionals'));
const nextGrant = await createCodexGrant(owner.id, draft.id);
await assert.rejects(resolveCodexGrant(firstGrant.token), { status: 401 });
assert.deepEqual(await resolveCodexGrant(nextGrant.token), { ownerId: owner.id, courseId: draft.id });
await revokeCodexGrant(owner.id, draft.id, nextGrant.id);
await assert.rejects(resolveCodexGrant(nextGrant.token), { status: 401 });

const bytes = buildCoursePptx(pkg); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const files: string[] = [];
assert.equal(view.getUint32(0, true), 0x04034b50, 'PowerPoint package begins with a ZIP local-file header.');
let offset = 0;
while (view.getUint32(offset, true) === 0x04034b50) {
  const nameLength = view.getUint16(offset + 26, true); const extraLength = view.getUint16(offset + 28, true); const size = view.getUint32(offset + 18, true);
  files.push(new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength)));
  offset += 30 + nameLength + extraLength + size;
}
assert(files.includes('[Content_Types].xml'));
assert(files.includes('ppt/slides/slide1.xml'));
assert(files.some(file => file === 'ppt/slides/slide6.xml'));
await writeFile(path.join(process.cwd(), '.data', 'tests', 'authored-course.pptx'), bytes);
console.log('PASS Codex ILD course authoring: required structure, source/objective links, midpoint validation, optimistic revisions, exact human approval, owner-scoped grants, outdated history retention, editable PPTX export');
