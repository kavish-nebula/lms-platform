import assert from 'node:assert/strict';
import { EMPTY_BRIEF, briefReadiness, CourseBrief, type CourseBriefData } from '@/lib/content-creator';
import { SourceLibrary, courseSources, migrateSourceLibrary, sourceCoverage, moduleSourceIssues, reviseSourceLibrary } from '@/lib/source-library';
import { blueprintInput, validateBlueprint } from '@/lib/instructional-blueprint';
import { blueprintShape } from '@/server/blueprint-ai';
import { createCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { startBlueprint, processBlueprint } from '@/server/creator-blueprints';
import { getCodexCourseContext, saveAuthoredCourse } from '@/server/authored-course';
import { saveSmeReview } from '@/server/creator-sme-review';
import { EMPTY_SME_CHECKLIST } from '@/lib/sme-review';
import { getSessionUser } from '@/server/auth';
import { db } from '@/server/db/client';
import { profiles, stepProgress } from '@/server/db/schema';
import type { AuthoredCoursePackageData } from '@/lib/authored-course';

const brief: CourseBriefData = { ...EMPTY_BRIEF, title: 'AI tasks', subject: 'AI', audience: 'Employees', outcomes: 'Choose a task', dependencies: 'Tasks before prompts', objectives: [{ text: 'Identify a useful AI task.', bloom: 'Understand' }], sourceLibrary: { version: 1, modules: [{ id: 'M1', title: 'AI at work', topics: [{ id: 'T1', title: 'Choose tasks' }] }], sources: [{ id: 'Sfixed', revision: 1, title: 'Approved task guidance', scope: 'topic', moduleId: 'M1', topicId: 'T1', objectiveIds: ['O1'], text: 'Use AI for drafts from supplied talking points. Review every output.', reference: 'Approved notes v1' }] } };
assert.deepEqual(sourceCoverage(brief), []);
assert(briefReadiness(brief).every(c => c.ready), 'One Bloom level is sufficient when appropriate.');
assert.deepEqual(courseSources({ ...EMPTY_BRIEF, sourceText: 'First\n\nSecond' }).map(s => s.id), ['S1', 'S2']);
assert.equal(migrateSourceLibrary({ ...EMPTY_BRIEF, sourceText: 'First\n\nSecond' }).sources[1].text, 'Second');
assert(CourseBrief.safeParse(EMPTY_BRIEF).success, 'Legacy records stay valid.');
const broken = structuredClone(brief); broken.sourceLibrary!.sources[0].text = '';
assert(sourceCoverage(broken).some(g => g.includes('references alone')));
broken.sourceLibrary!.sources[0].text = 'https://example.test/notes';
assert(sourceCoverage(broken).some(g => g.includes('references alone')), 'A URL in the evidence box is still not source text.');
broken.sourceLibrary!.sources[0].text = 'Evidence'; broken.sourceLibrary!.sources[0].objectiveIds = ['O2'];
assert(sourceCoverage(broken).some(g => g.includes('unknown objective O2')));
assert(sourceCoverage(broken).some(g => g.includes('O1: no source')));
broken.sourceLibrary!.sources[0].topicId = 'absent';
assert(sourceCoverage(broken).some(g => g.includes('select a topic')));
const duplicate = structuredClone(brief.sourceLibrary!); duplicate.sources.push(duplicate.sources[0]);
assert(!SourceLibrary.safeParse(duplicate).success);
const pair = structuredClone(brief.sourceLibrary!);
pair.sources.push({ ...pair.sources[0], id: 'Sshared', scope: 'course', moduleId: '', topicId: '' });
const reordered = structuredClone(pair); reordered.sources.reverse();
assert.deepEqual(reviseSourceLibrary(reordered, pair).sources.map(s => [s.id, s.revision]), [['Sshared', 1], ['Sfixed', 1]]);
assert(moduleSourceIssues({ nested: [{ sourceIds: ['Sfixed'] }] }, 'M2', courseSources(brief)).length);

const input = blueprintInput(brief, 'codex-ild-v2'); const blueprint = blueprintShape(input);
validateBlueprint(blueprint, input);
const wrong = structuredClone(blueprint); wrong.modules[0].sourceIds = [];
assert.throws(() => validateBlueprint(wrong, input));
const owner = await getSessionUser(); const database = await db();
const untouched = { profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) };
const draft = await createCreatorDraft(owner.id, { brief });
const incomplete = await createCreatorDraft(owner.id, { brief: broken });
await assert.rejects(startBlueprint(owner.id, incomplete.id, 1), { status: 422 });
const run = await startBlueprint(owner.id, draft.id, 1);
await processBlueprint(run.run.id, run.token!, async () => ({ choices: [{ message: { content: JSON.stringify(blueprint) } }] }));
const context = await getCodexCourseContext(owner.id, draft.id);
assert.equal(context.sources[0].id, 'Sfixed'); assert.equal(context.sources[0].revision, 1);
assert.equal(context.blueprintRunId, run.run.id);

const linked = { objectiveIds: ['O1'], sourceIds: ['Sfixed'] };
const question = (id: string) => ({ id, prompt: 'Select one answer: what is useful?', choices: ['Draft from supplied notes', 'Invent facts'], correct: 0, hint: 'Use evidence.', explanation: 'Draft from supplied material and review.', ...linked });
const pkg: AuthoredCoursePackageData = { schemaVersion: 1, title: brief.title, subject: brief.subject, durationMinutes: 20, briefRevision: 1,
  objectiveEvidence: [{ objectiveId: 'O1', objective: brief.objectives[0].text, sourceIds: ['Sfixed'] }],
  sources: [{ id: 'Sfixed', kind: 'sme', title: 'Task guidance', reference: 'Source library Sfixed revision 1' }],
  modules: [{ id: 'M1', title: 'AI at work', durationMinutes: 20, ...linked,
    problemHook: { title: 'Drafting', situation: 'A team needs a summary.', question: 'What can AI assist with?', ...linked },
    conceptExplainer: { videos: [{ id: 'V1', title: 'Tasks', plannedMinutes: 2, slides: ['SL1', 'SL2'].map(id => ({ id, title: 'Use supplied notes', body: ['Review the result'], narration: 'Use supplied notes and review the draft.', ...linked })), midpointQuiz: { afterSlideId: 'SL1', questions: [question('Q1'), question('Q2')] } }] },
    workedExamples: [{ id: 'E1', title: 'A summary', problem: 'Meeting notes', reasoning: ['Supply notes', 'Check the draft'], result: 'Reviewed summary', ...linked }],
    guidedPractice: { title: 'Choose a task', instructions: 'Inspect the request.', steps: [{ id: 'P1', instruction: 'Choose inputs.', hint: 'Use supplied notes.', evidence: 'Bounded inputs.', ...linked }] },
    scenarioLab: { title: 'Check a draft', scenarios: [{ id: 'C1', title: 'New request', situation: 'Notes omit a date.', challenge: 'Identify the omission.', expectedEvidence: 'Flag the missing date.', ...linked }] },
    moduleQuiz: { title: 'Module check', instructions: 'Select one answer.', questions: [question('MQ1')] },
  }], courseEnd: { miniProject: { title: 'Review a draft', brief: 'Inspect an example.', deliverable: 'Explanation', rubric: ['Supported by notes'], ...linked }, masteryGate: { title: 'Mastery', instructions: 'Select one answer.', passPercent: 80, questions: [question('F1')] }, reflection: { prompts: ['How will you check a draft?'] } } };
await assert.rejects(saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: 1, expectedVersion: 0, content: pkg }), { code: 'blueprint_required' });
pkg.blueprintRunId = run.run.id;
await assert.rejects(saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: 1, expectedVersion: 0, content: pkg }), { code: 'module_review_required' });
await saveSmeReview(owner, draft.id, run.run.id, { moduleId: 'M1', expectedVersion: 0, verdict: 'approved', checklist: Object.fromEntries(Object.keys(EMPTY_SME_CHECKLIST).map(k => [k, true])) as typeof EMPTY_SME_CHECKLIST, feedback: '', priority: 'Optional' });
const saved = await saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: 1, expectedVersion: 0, content: pkg });
assert.equal(saved.version, 1);
await assert.rejects(saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: 1, expectedVersion: 0, content: pkg }), { status: 409 });
const edited = structuredClone(draft.brief); edited.sourceLibrary!.sources[0].text += ' Human review is required.';
edited.sourceLibrary!.sources[0].revision = 900; // Client cannot choose persisted revision.
const updated = await updateCreatorDraft(owner.id, draft.id, { brief: edited, revision: 1 });
assert.equal(updated.brief.sourceLibrary!.sources[0].revision, 2);
assert.equal((await updateCreatorDraft(owner.id, draft.id, { brief: updated.brief, revision: 2 })).revision, 2);
assert.equal(run.run.input.sources[0].text, brief.sourceLibrary!.sources[0].text, 'Frozen snapshots remain unchanged.');
await assert.rejects(saveAuthoredCourse(owner.id, draft.id, { expectedBriefRevision: 1, expectedVersion: 1, content: pkg }), { status: 409 });
await assert.rejects(updateCreatorDraft(owner.id, draft.id, { brief: edited, revision: 1 }), { status: 409 });
await assert.rejects(updateCreatorDraft('other', draft.id, { brief: edited, revision: 2 }), { status: 404 });
assert.deepEqual({ profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) }, untouched);
console.log('PASS source library: scopes, coverage gates, stable IDs, server revisions, blueprint/review/package workflow, stale writes, legacy compatibility and learner isolation');
