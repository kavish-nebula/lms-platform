import assert from 'node:assert/strict';
import { AuthoredCoursePackage, COURSE_REVIEW_CHECKS, validateAuthoredCourse, type AuthoredCoursePackageData, type CourseReviewChecklist } from '@/lib/authored-course';
import { authoredDelivery } from '@/lib/authored-delivery';
import { correctChoiceIndices, exactChoices } from '@/lib/assessment-answers';
import { EMPTY_BRIEF } from '@/lib/content-creator';
import { courseDeckSlides } from '@/lib/pptx-export';
import { getSessionUser } from '@/server/auth';
import { createCreatorDraft } from '@/server/content-creator';
import { getCodexCourseContext, saveAuthoredCourse, reviewAuthoredCourse } from '@/server/authored-course';
import { publishAuthoredCourse } from '@/server/authored-publication';
import { POST as assess } from '@/app/api/v1/courses/[courseId]/assessment/route';
import { verifiedSignals } from '@/server/adapt/live';
import { saveSetup, recordProgress } from '@/server/planner/service';
import * as repo from '@/server/repo';

// Contract fixture, isolated in-memory by run.mjs; no live course or learner edits.
const user = await getSessionUser();
const draft = await createCreatorDraft(user.id, { brief: { ...EMPTY_BRIEF, title: 'Assessment contracts', sourceText: 'Fictional labels A and B are accepted; C and D are rejected.', objectives: [{ text: 'Identify accepted labels.', bloom: 'Remember' }, { text: 'Reject unsupported labels.', bloom: 'Apply' }] } });
const link = (i: number) => ({ objectiveIds: [`O${i}`], sourceIds: ['S1'] });
const single = (id: string, i: number) => ({ id, prompt: 'Which label is accepted?', choices: ['Label A', 'Label C'], correct: 0, hint: 'Use the fictional source.', explanation: 'A is accepted; C is rejected.', ...link(i) });
const multi = (id: string, i: number) => ({ id, prompt: 'Which labels are accepted?', choices: ['Label A', 'Label B', 'Label C', 'Label D'], selectionType: 'multiple' as const, correctIndices: [0, 1], hint: 'Two labels are accepted.', explanation: 'A and B are accepted; C and D are rejected.', ...link(i) });
const pkg: AuthoredCoursePackageData = {
  schemaVersion: 1, title: 'Assessment contracts', subject: 'Fictional label selection', briefRevision: draft.revision, durationMinutes: 15,
  sources: [{ id: 'S1', kind: 'sme', title: 'Fictional rules', reference: 'A and B are accepted; C and D are rejected.' }],
  objectiveEvidence: [{ objectiveId: 'O1', objective: 'Identify accepted labels.', sourceIds: ['S1'] }, { objectiveId: 'O2', objective: 'Reject unsupported labels.', sourceIds: ['S1'] }],
  modules: [1, 2].map(i => ({
    id: `M${i}`, title: `Labels ${i}`, durationMinutes: 5, ...link(i),
    problemHook: { title: 'Read the labels', situation: 'A fictional label needs review.', question: 'Which labels can be accepted?', ...link(i) },
    conceptExplainer: { videos: [{ id: `V${i}`, title: 'Supplied labels', plannedMinutes: 1,
      slides: [{ id: `SL${i}`, title: 'Labels', body: ['A and B are accepted.', 'C and D are rejected.'], narration: 'A and B are accepted; C and D are rejected.', ...link(i) }],
      midpointQuiz: { afterSlideId: `SL${i}`, questions: [single(`MID${i}A`, i), multi(`MID${i}B`, i)] },
    }] },
    workedExamples: [{ id: `EX${i}`, title: 'Read A', problem: 'Review A.', reasoning: ['Consult the source.'], result: 'Accept A.', ...link(i) }],
    guidedPractice: { title: 'Read B', instructions: 'Review B.', steps: [{ id: `GP${i}`, instruction: 'Consult the source.', hint: 'Read accepted labels.', evidence: 'Accept B.', ...link(i) }] },
    scenarioLab: { title: 'Review C', scenarios: [{ id: `SC${i}`, title: 'Unsupported label', situation: 'C is supplied.', challenge: 'Review it.', expectedEvidence: 'Reject C.', ...link(i) }] },
    moduleQuiz: { title: `Module ${i} quiz`, instructions: 'Check the labels.', ...(i === 2 ? { passPercent: 50 } : {}), questions: [single(`MQ${i}A`, i), multi(`MQ${i}B`, i)] },
  })),
  courseEnd: { miniProject: { title: 'Review labels', brief: 'Review all labels.', deliverable: 'Accepted and rejected labels.', rubric: ['Accepts A and B.', 'Rejects C and D.'], objectiveIds: ['O1', 'O2'], sourceIds: ['S1'] },
    masteryGate: { title: 'Final labels', instructions: 'Complete both questions.', passPercent: 75, questions: [single('FINAL1', 1), { ...multi('FINAL2', 2), objectiveIds: ['O1', 'O2'] }] }, reflection: { prompts: ['Which source supported your decision?'] } },
};
const ctx = { objectives: ['O1', 'O2'], smeSourceIds: ['S1'], briefRevision: draft.revision };
validateAuthoredCourse(pkg, ctx);
const context = await getCodexCourseContext(user.id, draft.id);
assert(context.moduleSequence.includes('quiz'));
for (const mutate of [
  (q: Record<string, unknown>) => { q.correctIndices = [0, 0]; },
  (q: Record<string, unknown>) => { q.correctIndices = [0, 8]; },
  (q: Record<string, unknown>) => { q.correctIndices = [0, 1, 2, 3]; },
  (q: Record<string, unknown>) => { q.correctIndices = [0]; },
  (q: Record<string, unknown>) => { q.correct = 0; },
]) {
  const invalid = structuredClone(pkg); mutate(invalid.courseEnd.masteryGate.questions[1] as unknown as Record<string, unknown>);
  assert.equal(AuthoredCoursePackage.safeParse(invalid).success, false);
}
const badLink = structuredClone(pkg); badLink.modules[0]!.moduleQuiz!.questions[0]!.objectiveIds = ['O2'];
assert.throws(() => validateAuthoredCourse(badLink, ctx), /not assigned/);
const uncovered = structuredClone(pkg); uncovered.modules[0]!.objectiveIds = ['O1', 'O2'];
assert.throws(() => validateAuthoredCourse(uncovered, ctx), /module quiz must assess O2/);
const duplicate = structuredClone(pkg); duplicate.courseEnd.masteryGate.questions[0]!.id = 'MQ1A';
assert.throws(() => validateAuthoredCourse(duplicate, ctx), /unique/);
const legacy = structuredClone(pkg); legacy.modules.forEach(m => { delete m.moduleQuiz; });
assert(!authoredDelivery({ courseId: draft.id, revisionId: draft.id, content: validateAuthoredCourse(legacy, ctx) }).modules[0]!.stages_included.includes('gate'));
assert(exactChoices([1, 0], [0, 1])); assert(!exactChoices([0], [0, 1])); assert(!exactChoices([0, 1, 2], [0, 1])); assert(!exactChoices([0, 0], [0, 1]));

const head = await saveAuthoredCourse(user.id, draft.id, { expectedBriefRevision: draft.revision, expectedVersion: 0, content: pkg });
const checklist = Object.fromEntries(COURSE_REVIEW_CHECKS.map(k => [k, true])) as CourseReviewChecklist;
const review = await reviewAuthoredCourse(user.id, user, draft.id, { revisionId: head.id, expectedReviewVersion: 0, verdict: 'approved', checklist, feedback: '' });
await publishAuthoredCourse(user.id, draft.id, { revisionId: head.id, reviewId: review.id });
const delivery = authoredDelivery({ courseId: draft.id, revisionId: head.id, content: pkg });
assert.deepEqual(delivery.modules[0]!.stages_included, ['hook', 'explainer', 'worked', 'guided', 'lab', 'gate']);
assert.equal(delivery.course.modules[0]!.topics.at(-1)!.stage, 'gate');
const gate = delivery.modules[0]!.blocks.find(b => b.stage === 'gate')!;
assert.equal(gate.stage, 'gate'); if (gate.stage !== 'gate') throw new Error('Missing quiz');
assert.equal(gate.pass_threshold, .75, 'Omitted module pass rules inherit the course threshold.');
const gate2 = delivery.modules[1]!.blocks.find(b => b.stage === 'gate')!;
assert(gate2.stage === 'gate' && gate2.pass_threshold === .5, 'Explicit module thresholds are retained.');
assert.equal(gate.items[1]!.kind, 'multi');
for (const payload of [gate.items, delivery.finale.final.items]) assert(!JSON.stringify(payload).includes('correct'), 'Module/final keys must stay off learner payloads.');
const deck = courseDeckSlides(pkg);
assert(deck.some(s => s.title.startsWith('Module quiz · Module 1 quiz') && s.points.includes('Select all correct answers')));
assert(deck.findIndex(s => s.title.startsWith('Knowledge check')) < deck.findIndex(s => s.title.startsWith('Worked Example')), 'Midpoint checks stay inside concept teaching in exports.');
const request = (responses: Record<string, unknown>, moduleId?: string, revisionId = head.id) => assess(new Request('http://localhost/assessment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId, moduleId, responses }) }), { params: Promise.resolve({ courseId: draft.id }) });
const result = async (responses: Record<string, unknown>, moduleId?: string) => { const r = await request(responses, moduleId); assert.equal(r.status, 200); return (await r.json()).result; };
assert.equal((await result({ FINAL1: '0', FINAL2: ['1', '0'] })).passed, true);
for (const selections of [[], ['0'], ['0', '1', '2'], ['2', '3']]) {
  const r = await result({ FINAL1: '0', FINAL2: selections }); assert.equal(r.score, 1); assert.equal(r.passed, false); assert(r.review.every((q: { explain?: string }) => !q.explain));
}
for (const responses of [{ FINAL2: ['0', '0'] }, { FINAL2: ['99'] }, { FINAL2: '0' }, { FINAL1: ['0'] }, { UNKNOWN: '0' }, { MQ1A: '0' }]) assert.equal((await request(responses)).status, 400);
assert.equal((await request({ FINAL1: '0' }, 'M1')).status, 400, 'Final question IDs cannot be used in a module quiz.');
assert.equal((await request({ MQ2A: '0' }, 'M1')).status, 400, 'Questions cannot cross module scope.');
assert.equal((await request({}, 'UNKNOWN')).status, 404);
assert.equal((await request({}, undefined, draft.id)).status, 409);
assert.equal((await result({ MQ1A: '0', MQ1B: ['0', '1'] }, 'M1')).passed, true);
assert.equal((await result({ MQ1A: '0', MQ1B: ['0'] }, 'M1')).passed, false);
assert.equal((await result({ MQ2A: '0', MQ2B: ['0'] }, 'M2')).passed, true);
const full = await result({ FINAL1: '0', FINAL2: ['0', '1'] });
assert.deepEqual(full.perObjective.map((o: { total: number }) => o.total), [2, 1], 'Multi-objective items count toward all their objectives.');
const checked = await verifiedSignals(draft.id, [{ key: 'module-check', kind: 'module_check', moduleId: 'M1', lesson: null, payload: { responses: { MQ1A: '0', MQ1B: ['1', '0'] }, passed: false } }]);
assert.equal(checked[0]!.payload.passed, true, 'Server signal verification uses released authored keys directly.');
const video = delivery.modules[0]!.blocks.find(b => b.stage === 'explainer'); assert(video?.stage === 'explainer');
assert.deepEqual(correctChoiceIndices(video.videos![0]!.midQuiz[1]!), [0, 1]);
const videoChecked = await verifiedSignals(draft.id, [{ key: 'video-check', kind: 'video_check', moduleId: 'M1', lesson: null, payload: { videoId: video.videos![0]!.id, section: 'mid', question: 1, response: [1, 0], correct: false } }]);
assert.equal(videoChecked[0]!.payload.correct, true);
await saveSetup(user, draft.id, { answers: {}, supportOverride: 'auto', pace: null }, () => {});
await recordProgress(user, draft.id, 'M1', 'lab', () => {});
await recordProgress(user, draft.id, 'M1', 'gate', () => {});
const enrollment = await repo.findEnrollment(user.id, draft.id); assert(enrollment);
assert.deepEqual((await repo.progressFor(enrollment.id)).map(r => r.stage).sort(), ['gate', 'lab'], 'Existing stage progress survives module quiz completion.');
console.log('PASS authored assessments: legacy compatibility, scoped module quizzes, single/multiple answers, exact-set server grading, key privacy, validation, exports, verified signals and saved progress.');
