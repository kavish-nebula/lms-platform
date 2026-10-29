import assert from 'node:assert/strict';
import { AuthoredCoursePackage, validateAuthoredCourse } from '@/lib/authored-course';
import { EMPTY_BRIEF } from '@/lib/content-creator';
import { createCreatorDraft, updateCreatorDraft } from '@/server/content-creator';
import { authoredCourseState, getCodexCourseContext, saveAuthoredCourse } from '@/server/authored-course';
import { getSessionUser } from '@/server/auth';

// Exercise the documented fragment composition against the real package/save contract.
// This is an isolated synthetic course, not a model-quality or skill-routing evaluation.
const user = await getSessionUser();
const brief = {
  ...EMPTY_BRIEF, title: 'Synthetic handoff authoring', subject: 'Fictional handoff conventions', audience: 'Beginner coordinators',
  sourceText: 'Fictional Cedar convention: identify a named owner rather than guessing who will act.\n\nFictional Cedar convention: specify a concrete deliverable and an observable acceptance check.',
  objectives: [{ text: 'Identify a named owner in a supplied handoff.', bloom: 'Remember' as const }, { text: 'Write a deliverable with an observable acceptance check.', bloom: 'Apply' as const }],
};
const draft = await createCreatorDraft(user.id, { brief });
const context = await getCodexCourseContext(user.id, draft.id);
const evidence = context.objectives.map((o, i) => ({ objectiveId: o.id, objective: o.text, sourceIds: [`S${i + 1}`] }));
const link = (i: number) => ({ objectiveIds: [`O${i}`], sourceIds: [`S${i}`] });
const question = (id: string, i: number) => ({ id, prompt: i === 1 ? 'Which owner is explicit?' : 'Which deliverable has an observable check?', choices: i === 1 ? ['Maya owns the agenda.', 'Someone should do it.'] : ['Produce exactly three agenda bullets.', 'Prepare something good.'], correct: 0, hint: i === 1 ? 'Look for a named person.' : 'Look for a checkable output.', explanation: i === 1 ? 'Maya is a named owner; someone is unspecified.' : 'The number of agenda bullets can be checked.', ...link(i) });
const lessons = [1, 2].map(i => ({
  id: `M${i}`, title: `Handoff skill ${i}`, durationMinutes: 8, ...link(i),
  problemHook: { title: 'A vague request', situation: 'A fictional team receives a vague agenda request.', question: 'What information is needed?', ...link(i) },
  conceptExplainer: { videos: [{
    id: `M${i}V1`, title: 'Make the requirement explicit', plannedMinutes: 2,
    slides: [{ id: `M${i}SL1`, title: 'Read the supplied convention', body: [context.sources[i - 1]!.text], narration: context.sources[i - 1]!.text, plannedNarrationSeconds: 20, ...link(i) }, { id: `M${i}SL2`, title: 'Apply the convention', body: ['Preserve supplied facts.'], narration: 'Use the supplied convention and ask for missing information rather than inventing it.', plannedNarrationSeconds: 20, ...link(i) }],
  }] },
  workedExamples: [{ id: `M${i}EX1`, title: 'Agenda example', problem: 'Make the request explicit.', reasoning: ['Read the supplied fact.', 'Preserve the requirement.'], result: i === 1 ? 'Maya owns the agenda.' : 'Produce exactly three agenda bullets.', ...link(i) }],
  guidedPractice: { title: 'Practise the requirement', instructions: 'Use the supplied fictional facts.', steps: [{ id: `M${i}GP1`, instruction: 'Write the explicit requirement.', hint: 'Look back at the source.', evidence: i === 1 ? 'A named owner.' : 'A checkable deliverable.', ...link(i) }] },
  scenarioLab: { title: 'Clarify a request', scenarios: [{ id: `M${i}SC1`, title: 'A new agenda request', situation: 'A fictional request is missing a required detail.', challenge: 'Ask for the detail without guessing.', expectedEvidence: 'An explicit clarification question.', ...link(i) }] },
}));
const quizFragment = {
  midpointQuizzes: lessons.map((m, index) => ({ videoId: m.conceptExplainer.videos[0]!.id, afterSlideId: m.conceptExplainer.videos[0]!.slides[0]!.id, questions: [question(`M${index + 1}Q1`, index + 1), question(`M${index + 1}Q2`, index + 1)] })),
  masteryGate: { title: 'Handoff mastery', instructions: 'Choose the source-supported answer.', passPercent: 80, questions: [question('MG1', 1), question('MG2', 2)] },
};
const projectFragment = { title: 'One complete handoff', brief: 'Combine the two fictional conventions in one agenda handoff.', deliverable: 'A named owner and a checkable agenda deliverable.', rubric: ['Identifies a named owner.', 'Specifies an observable acceptance check.'], objectiveIds: ['O1', 'O2'], sourceIds: ['S1', 'S2'] };
const assembled = {
  schemaVersion: 1, title: brief.title, subject: brief.subject, durationMinutes: 20, briefRevision: context.briefRevision,
  sources: context.sources.map(s => ({ id: s.id, kind: 'sme', title: `Fictional source ${s.id}`, reference: s.text })),
  objectiveEvidence: evidence,
  modules: lessons.map(m => ({ ...m, conceptExplainer: { videos: m.conceptExplainer.videos.map(v => {
    const { videoId: _, ...checkpoint } = quizFragment.midpointQuizzes.find(q => q.videoId === v.id)!;
    return { ...v, midpointQuiz: checkpoint };
  }) } })),
  courseEnd: { miniProject: projectFragment, masteryGate: quizFragment.masteryGate, reflection: { prompts: ['Which missing detail will you check before acting?'] } },
};
const validationContext = { objectives: context.objectives.map(o => o.id), smeSourceIds: context.sources.map(s => s.id), briefRevision: context.briefRevision };
assert.equal(AuthoredCoursePackage.safeParse(lessons[0]).success, false, 'An intermediate teaching fragment cannot masquerade as a complete package.');
const pkg = validateAuthoredCourse(assembled, validationContext);
const checkExactObjectives = (candidate: typeof pkg) => {
  for (const o of context.objectives) assert.equal(candidate.objectiveEvidence.find(e => e.objectiveId === o.id)?.objective, o.text);
};
checkExactObjectives(pkg);
const reworded = structuredClone(pkg); reworded.objectiveEvidence[0]!.objective = 'An incorrectly reworded objective.';
validateAuthoredCourse(reworded, validationContext); // Structural validation alone does not compare objective wording.
assert.throws(() => checkExactObjectives(reworded), assert.AssertionError);
const taughtObjectives = new Set(pkg.modules.flatMap(m => m.conceptExplainer.videos.flatMap(v => v.slides.flatMap(s => s.objectiveIds))));
assert(pkg.courseEnd.miniProject.objectiveIds.every(o => taughtObjectives.has(o)), 'The project requires only taught objectives.');
assert.deepEqual(pkg.courseEnd.miniProject.objectiveIds, context.objectives.map(o => o.id), 'This combined project covers both fixture skills.');
assert.equal(pkg.courseEnd.miniProject.rubric.length, 2, 'Both fixture skills have observable acceptance criteria.');
for (const m of pkg.modules) for (const v of m.conceptExplainer.videos) {
  const index = Math.ceil(v.slides.length / 2) - 1;
  assert.equal(v.midpointQuiz.afterSlideId, v.slides[index]!.id);
  assert.equal(v.midpointQuiz.questions.length, 2);
  const taught = new Set(v.slides.slice(0, index + 1).flatMap(s => s.objectiveIds));
  assert(v.midpointQuiz.questions.every(q => q.objectiveIds.every(o => taught.has(o))), 'Midpoint questions depend only on first-half teaching.');
}
const missingSource = structuredClone(pkg); missingSource.modules[0]!.conceptExplainer.videos[0]!.slides[0]!.sourceIds = ['UNKNOWN'];
assert.throws(() => validateAuthoredCourse(missingSource, validationContext), /Unknown source/);
const duplicateId = structuredClone(pkg); duplicateId.modules[1]!.id = duplicateId.modules[0]!.id;
assert.throws(() => validateAuthoredCourse(duplicateId, validationContext), /unique/);
const misplaced = structuredClone(pkg); misplaced.modules[0]!.conceptExplainer.videos[0]!.midpointQuiz.afterSlideId = 'M1SL2';
assert.throws(() => validateAuthoredCourse(misplaced, validationContext), /midpoint/);
const uncovered = structuredClone(pkg); uncovered.courseEnd.masteryGate.questions = [uncovered.courseEnd.masteryGate.questions[0]!];
assert.throws(() => validateAuthoredCourse(uncovered, validationContext), /must assess O2/);
const wrongBrief = structuredClone(pkg); wrongBrief.briefRevision++;
assert.throws(() => validateAuthoredCourse(wrongBrief, validationContext), /different saved SME/);

const first = await saveAuthoredCourse(user.id, draft.id, { expectedBriefRevision: context.briefRevision, expectedVersion: 0, content: pkg });
const edited = structuredClone(first.content);
edited.modules[0]!.conceptExplainer.videos[0]!.slides[1]!.narration = 'In this fictional exercise, retain the supplied named owner and ask for clarification when the owner is absent.';
const second = await saveAuthoredCourse(user.id, draft.id, { expectedBriefRevision: context.briefRevision, expectedVersion: first.version, content: edited });
assert.deepEqual(second.content.modules[1], first.content.modules[1], 'A focused teaching revision preserves the other module.');
assert.deepEqual(second.content.courseEnd, first.content.courseEnd, 'Project, final gate and reflection survive a focused revision.');
assert.deepEqual(second.content.modules[0]!.conceptExplainer.videos[0]!.midpointQuiz, first.content.modules[0]!.conceptExplainer.videos[0]!.midpointQuiz);
assert.deepEqual(second.content.sources, first.content.sources);
await assert.rejects(saveAuthoredCourse(user.id, draft.id, { expectedBriefRevision: context.briefRevision, expectedVersion: first.version, content: edited }), { status: 409 });
await updateCreatorDraft(user.id, draft.id, { revision: draft.revision, brief: { ...brief, audience: 'Revised audience' } });
await assert.rejects(saveAuthoredCourse(user.id, draft.id, { expectedBriefRevision: context.briefRevision, expectedVersion: second.version, content: edited }), { status: 409 });
const finalState = await authoredCourseState(user.id, draft.id);
assert.equal(finalState.revisions.length, 2, 'Rejected saves append no revision.');
assert(finalState.revisions.every(r => r.reviews.length === 0), 'Assembling and saving drafts records no human approval.');
console.log('PASS course skill fragments: complete-package composition, exact objective evidence, source links, midpoint scope, unique IDs, final coverage, focused-edit preservation, stale brief/version rejection, draft-only saves.');
