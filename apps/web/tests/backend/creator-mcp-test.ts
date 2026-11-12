import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { getSessionUser } from '@/server/auth';
import { db } from '@/server/db/client';
import { creatorMcpGrants, creatorCodexGrants } from '@/server/db/schema';
import { createCreatorMcpGrant, resolveCreatorMcpGrant, revokeCreatorMcpGrant, listCreatorMcpGrants, saveCreatorFragment, publishCreatorMcpCourse } from '@/server/creator-mcp';
import { authoredCourseState, createCodexGrant, resolveCodexGrant, reviewAuthoredCourse } from '@/server/authored-course';
import { createCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { EMPTY_BRIEF } from '@/lib/content-creator';
import { COURSE_REVIEW_CHECKS, type AuthoredCoursePackageData } from '@/lib/authored-course';
import { POST } from '@/app/api/mcp/course-authoring/route';

const owner = await getSessionUser();
const brief = { ...EMPTY_BRIEF, title: 'Prompt-created course', subject: 'AI basics', audience: 'Office staff', sourceText: 'AI drafts need human review.', objectives: [{ text: 'Identify an AI review step.', bloom: 'Understand' as const }] };
const draft = await createCreatorDraft(owner.id, { brief });
const linked = { objectiveIds: ['O1'], sourceIds: ['S1'] };
const q = (id: string) => ({ id, prompt: 'Which step reviews the output?', choices: ['Human review', 'Skip review'], correct: 0, hint: 'Use the notes.', explanation: 'A human checks the draft.', ...linked });
const pkg: AuthoredCoursePackageData = {
  schemaVersion: 1, title: brief.title, subject: brief.subject, durationMinutes: 20, briefRevision: 1,
  objectiveEvidence: [{ objectiveId: 'O1', objective: brief.objectives[0].text, sourceIds: ['S1'] }],
  sources: [{ id: 'S1', kind: 'sme', title: 'Source notes', reference: 'Saved SME notes' }],
  modules: [{ id: 'M1', title: 'Review AI drafts', durationMinutes: 20, ...linked,
    problemHook: { title: 'A draft arrives', situation: 'A fictional team receives an AI draft.', question: 'What should happen next?', ...linked },
    conceptExplainer: { videos: [{ id: 'V1', title: 'Review the draft', plannedMinutes: 3,
      slides: [{ id: 'SL1', title: 'Inspect the draft', body: ['Read it first.'], narration: 'A human checks the AI draft.', ...linked }, { id: 'SL2', title: 'Check the facts', body: ['Compare against the source.'], narration: 'Compare the draft against the supplied source.', ...linked }],
      midpointQuiz: { afterSlideId: 'SL1', questions: [q('MID1'), q('MID2')] } }] },
    workedExamples: [{ id: 'EX1', title: 'Review a summary', problem: 'A summary needs checking.', reasoning: ['Read the notes.', 'Compare the summary.'], result: 'Correct the unsupported claim.', ...linked }],
    guidedPractice: { title: 'Find the review step', instructions: 'Inspect the supplied example.', steps: [{ id: 'GP1', instruction: 'Name the review step.', hint: 'Who checks?', evidence: 'Human review.', ...linked }] },
    scenarioLab: { title: 'A new draft', scenarios: [{ id: 'SC1', title: 'Check before sharing', situation: 'A draft includes a claim.', challenge: 'Decide what to check.', expectedEvidence: 'Compare the claim with the notes.', ...linked }] },
    moduleQuiz: { title: 'Module check', instructions: 'Select one answer.', questions: [q('MQ1')] },
  }],
  courseEnd: { miniProject: { title: 'Review a supplied draft', brief: 'Explain a review decision.', deliverable: 'A short explanation.', rubric: ['Source-supported decision'], ...linked }, masteryGate: { title: 'Final assessment', instructions: 'Select one answer.', passPercent: 80, questions: [q('FINAL1')] }, reflection: { prompts: ['What will you check?'] } },
};
const connection = await createCreatorMcpGrant(owner.id);
const grant = await resolveCreatorMcpGrant(connection.token);
assert.equal(grant.allowPublication, false);
const [stored] = await (await db()).select().from(creatorMcpGrants).where(eq(creatorMcpGrants.id, grant.id));
assert.notEqual(stored.tokenHash, connection.token);
assert(!JSON.stringify(await listCreatorMcpGrants(owner.id)).includes(connection.token));
const legacy = await createCodexGrant(owner.id, draft.id);
await assert.rejects(resolveCreatorMcpGrant(legacy.token), { status: 401 });
await assert.rejects(resolveCodexGrant(connection.token), { status: 401 });
assert.equal((await (await db()).select().from(creatorCodexGrants).where(eq(creatorCodexGrants.courseId, draft.id))).length, 1);

async function rpc(method: string, params: Record<string, unknown>, token = connection.token) {
  const response = await POST(new Request('http://localhost/api/mcp/course-authoring', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }));
  assert.equal(response.status, 200); return response.json();
}
const tool = (name: string, args: Record<string, unknown>, token?: string) => rpc('tools/call', { name, arguments: args }, token);
assert.equal((await POST(new Request('http://localhost/api/mcp/course-authoring', { method: 'POST' }))).status, 401);
const initialized = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'creator-test', version: '1' } });
assert.equal(initialized.result.serverInfo.name, 'nebula-course-authoring');
const tools = (await rpc('tools/list', {})).result.tools.map((t: { name: string }) => t.name);
assert(tools.includes('create_course') && tools.includes('save_lesson') && tools.includes('save_module_quiz'));
assert(!tools.includes('publish_course') && !tools.includes('approve_course'));
assert.equal((await rpc('prompts/list', {})).result.prompts.length, 5);
assert.equal((await rpc('resources/list', {})).result.resources.length, 3);
const briefSchema = await rpc('resources/read', { uri: 'lms://schemas/course-brief' });
assert(JSON.parse(briefSchema.result.contents[0].text).properties.title);
const packageSchema = await rpc('resources/read', { uri: 'lms://schemas/course-package' });
assert(JSON.parse(packageSchema.result.contents[0].text).properties.modules);
const created = await tool('create_course', { briefJson: JSON.stringify(brief) });
assert(JSON.parse(created.result.content[0].text).id);
assert((await tool('create_course', { briefJson: '{bad' })).result.isError);
assert((await tool('get_course_context', { courseId: '00000000-0000-4000-8000-000000000001' })).result.isError);
await assert.rejects(saveCreatorFragment(owner.id, { courseId: draft.id, moduleId: 'M1', expectedBriefRevision: 1, expectedVersion: 0 }, pkg.modules[0].moduleQuiz), { code: 'package_required' });
const savedRpc = await tool('save_course_draft', { courseId: draft.id, expectedBriefRevision: 1, expectedVersion: 0, packageJson: JSON.stringify(pkg) });
assert(!savedRpc.result.isError, JSON.stringify(savedRpc));
const first = JSON.parse(savedRpc.result.content[0].text);
const lesson = structuredClone(pkg.modules[0].conceptExplainer.videos[0]); lesson.title = 'A revised source-supported lesson';
const focused = await saveCreatorFragment(owner.id, { courseId: draft.id, moduleId: 'M1', expectedBriefRevision: 1, expectedVersion: 1 }, lesson, 'V1');
assert.deepEqual(focused.content.courseEnd, pkg.courseEnd);
assert.deepEqual(focused.content.modules[0].moduleQuiz, pkg.modules[0].moduleQuiz);
await assert.rejects(saveCreatorFragment('another-owner', { courseId: draft.id, moduleId: 'M1', expectedBriefRevision: 1, expectedVersion: 2 }, lesson, 'V1'), { status: 404 });
await assert.rejects(saveCreatorFragment(owner.id, { courseId: draft.id, moduleId: 'M1', expectedBriefRevision: 1, expectedVersion: 1 }, lesson, 'V1'), { code: 'revision_conflict' });
const updated = await tool('save_module_quiz', { courseId: draft.id, moduleId: 'M1', expectedBriefRevision: 1, expectedVersion: 2, quizJson: JSON.stringify({ ...pkg.modules[0].moduleQuiz, title: 'Revised module quiz' }) });
assert(!updated.result.isError);
const head = (await authoredCourseState(owner.id, draft.id)).revisions[0];
assert.equal(head.content.modules[0].conceptExplainer.videos[0].title, lesson.title);
assert.deepEqual(head.content.courseEnd, pkg.courseEnd);
const review = await tool('review_course', { courseId: draft.id });
assert.equal(JSON.parse(review.result.content[0].text).humanApproval, 'pending');
const publishing = await createCreatorMcpGrant(owner.id, true);
const publishingGrant = await resolveCreatorMcpGrant(publishing.token);
assert((await rpc('tools/list', {}, publishing.token)).result.tools.some((t: { name: string }) => t.name === 'publish_course'));
await assert.rejects(publishCreatorMcpCourse(grant, draft.id, head.id, head.id), { status: 403 });
await assert.rejects(publishCreatorMcpCourse(publishingGrant, draft.id, head.id, head.id), { code: 'approval_required' });
// Human decision is simulated through the existing review service, never MCP.
const approved = await reviewAuthoredCourse(owner.id, owner, draft.id, { revisionId: head.id, expectedReviewVersion: 0, verdict: 'approved', checklist: Object.fromEntries(COURSE_REVIEW_CHECKS.map(k => [k, true])) as Record<typeof COURSE_REVIEW_CHECKS[number], boolean>, feedback: 'Synthetic test review.' });
await assert.rejects(publishCreatorMcpCourse(publishingGrant, draft.id, first.id, approved.id), { code: 'revision_outdated' });
const published = await tool('publish_course', { courseId: draft.id, revisionId: head.id, reviewId: approved.id }, publishing.token);
assert(!published.result.isError);
assert.equal(JSON.parse(published.result.content[0].text).revisionId, head.id);
await updateCreatorDraft(owner.id, draft.id, { revision: 1, brief: { ...brief, audience: 'Updated audience' } });
await assert.rejects(publishCreatorMcpCourse(publishingGrant, draft.id, head.id, approved.id), { code: 'revision_outdated' });
await revokeCreatorMcpGrant(owner.id, connection.id);
await assert.rejects(resolveCreatorMcpGrant(connection.token), { status: 401 });
await (await db()).update(creatorMcpGrants).set({ expiresAt: new Date(0) }).where(eq(creatorMcpGrants.id, publishing.id));
await assert.rejects(resolveCreatorMcpGrant(publishing.token), { status: 401 });
console.log('PASS creator MCP: authenticated discovery, schemas/prompts, course creation, full and focused saves, ownership, stale versions, explicit publication scope, human approval gates, token hashing/expiry/revocation and unchanged legacy scopes.');
