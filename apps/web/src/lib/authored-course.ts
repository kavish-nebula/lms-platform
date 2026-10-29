import { z } from 'zod/v4';
import { ProjectSandbox } from './project-sandbox';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const text = z.string().trim().min(1).max(12000);
const ids = z.array(id).min(1).max(60);
const linked = { objectiveIds: ids, sourceIds: ids };
const questionFields = {
  id, prompt: text, choices: z.array(text).min(2).max(5),
  hint: text, explanation: text, ...linked,
};
const Question = z.union([
  z.object({ ...questionFields, selectionType: z.literal('single').optional(), correct: z.number().int().nonnegative() }).strict()
    .superRefine((q, ctx) => { if (q.correct >= q.choices.length) ctx.addIssue({ code: 'custom', message: 'Question answer index must match a choice.' }); }),
  z.object({ ...questionFields, selectionType: z.literal('multiple'), correctIndices: z.array(z.number().int().nonnegative()).min(2).max(4) }).strict()
    .superRefine((q, ctx) => {
      if (new Set(q.correctIndices).size !== q.correctIndices.length || q.correctIndices.some(i => i >= q.choices.length)) ctx.addIssue({ code: 'custom', message: 'Multiple-answer indices must be unique and match existing choices.' });
      if (q.correctIndices.length >= q.choices.length) ctx.addIssue({ code: 'custom', message: 'Multiple-answer questions need at least one incorrect choice.' });
    }),
]);
const ModuleQuiz = z.object({
  title: text.max(300), instructions: text,
  // Omitted thresholds inherit the course's creator-configured pass rule.
  passPercent: z.number().int().min(1).max(100).optional(), questions: z.array(Question).min(1).max(100),
}).strict();
const Slide = z.object({
  id, title: z.string().trim().min(1).max(200), body: z.array(z.string().trim().min(1).max(1000)).max(8),
  narration: text.max(24000), plannedNarrationSeconds: z.number().int().positive().max(7200).optional(), ...linked,
}).strict();

export const AuthoredCoursePackage = z.object({
  schemaVersion: z.literal(1), title: z.string().trim().min(1).max(200), subject: text.max(300),
  durationMinutes: z.number().positive().max(10000), briefRevision: z.number().int().positive(),
  blueprintRunId: z.string().uuid().optional(),
  objectiveEvidence: z.array(z.object({ objectiveId: id, objective: text, sourceIds: ids }).strict()).min(1).max(60),
  sources: z.array(z.object({
    id, kind: z.enum(['sme', 'research']), title: text.max(500), reference: text.max(4000),
    url: z.string().url().max(2000).optional(), publisher: z.string().max(500).optional(),
  }).strict()).min(1).max(160),
  modules: z.array(z.object({
    id, title: text.max(300), durationMinutes: z.number().positive().max(2000), objectiveIds: ids, sourceIds: ids,
    problemHook: z.object({ title: text.max(300), situation: text, question: text, ...linked }).strict(),
    conceptExplainer: z.object({ videos: z.array(z.object({
      id, title: text.max(300), plannedMinutes: z.number().positive().max(300), slides: z.array(Slide).min(1).max(40),
      midpointQuiz: z.object({ afterSlideId: id, questions: z.array(Question).length(2) }).strict(),
    }).strict()).min(1).max(20) }).strict(),
    workedExamples: z.array(z.object({ id, title: text.max(300), problem: text, reasoning: z.array(text).min(1).max(20), result: text, ...linked }).strict()).min(1).max(20),
    guidedPractice: z.object({ title: text.max(300), instructions: text, steps: z.array(z.object({ id, instruction: text, hint: text, evidence: text, ...linked }).strict()).min(1).max(30) }).strict(),
    scenarioLab: z.object({ title: text.max(300), scenarios: z.array(z.object({ id, title: text.max(300), situation: text, challenge: text, expectedEvidence: text, ...linked }).strict()).min(1).max(20) }).strict(),
    moduleQuiz: ModuleQuiz.optional(),
  }).strict()).min(1).max(20),
  courseEnd: z.object({
    miniProject: z.object({ title: text.max(300), brief: text, deliverable: text, rubric: z.array(text).min(1).max(30), sandbox: ProjectSandbox.optional(), ...linked }).strict(),
    masteryGate: z.object({ title: text.max(300), instructions: text, passPercent: z.number().int().min(1).max(100), questions: z.array(Question).min(1).max(100) }).strict(),
    reflection: z.object({ prompts: z.array(text).min(1).max(20) }).strict(),
  }).strict(),
}).strict();

export type AuthoredCoursePackageData = z.infer<typeof AuthoredCoursePackage>;
export type AuthoredQuestionData = z.infer<typeof Question>;
export type CourseReviewChecklist = { factualAccuracy: boolean; objectiveCoverage: boolean; citationsChecked: boolean; teachingSequence: boolean; narrationAndSlides: boolean; assessmentsAndPassRule: boolean; accessibilityAndPacing: boolean };
export const COURSE_REVIEW_CHECKS = ['factualAccuracy', 'objectiveCoverage', 'citationsChecked', 'teachingSequence', 'narrationAndSlides', 'assessmentsAndPassRule', 'accessibilityAndPacing'] as const;

export function validateAuthoredCourse(raw: unknown, context: { objectives: string[]; smeSourceIds: string[]; briefRevision: number }) {
  const course = AuthoredCoursePackage.parse(raw); const errors: string[] = [];
  if (course.briefRevision !== context.briefRevision) errors.push('Package was generated from a different saved SME input revision.');
  const objectiveSet = new Set(context.objectives); const sourceById = new Map(course.sources.map(s => [s.id, s]));
  const evidenceByObjective = new Map(course.objectiveEvidence.map(item => [item.objectiveId, item]));
  if (evidenceByObjective.size !== course.objectiveEvidence.length) errors.push('Objective evidence IDs must be unique.');
  for (const objective of context.objectives) if (!evidenceByObjective.has(objective)) errors.push(`Add source evidence for course objective ${objective}.`);
  for (const item of course.objectiveEvidence) {
    if (!objectiveSet.has(item.objectiveId)) errors.push(`Unknown course objective ${item.objectiveId}.`);
    for (const source of item.sourceIds) if (!sourceById.has(source)) errors.push(`Unknown source ${source} for objective ${item.objectiveId}.`);
  }
  if (sourceById.size !== course.sources.length) errors.push('Source IDs must be unique.');
  for (const id of context.smeSourceIds) { if (sourceById.get(id)?.kind !== 'sme') errors.push(`Keep SME source ${id} in the package.`); }
  for (const source of course.sources) {
    if (source.kind === 'sme' && !context.smeSourceIds.includes(source.id)) errors.push(`Unknown SME source ${source.id}.`);
    if (source.kind === 'research' && !source.url) errors.push(`Research source ${source.id} needs a source URL.`);
  }
  const moduleIds = new Set(course.modules.map(m => m.id));
  if (moduleIds.size !== course.modules.length) errors.push('Module IDs must be unique.');
  const contentIds: string[] = [];
  const checkLinks = (item: { objectiveIds: string[]; sourceIds: string[] }, moduleObjectives?: string[]) => {
    for (const objective of item.objectiveIds) {
      if (!objectiveSet.has(objective)) errors.push(`Unknown objective ${objective}.`);
      if (moduleObjectives && !moduleObjectives.includes(objective)) errors.push(`Objective ${objective} is not assigned to this module.`);
    }
    for (const source of item.sourceIds) if (!sourceById.has(source)) errors.push(`Unknown source ${source}.`);
    if (!item.sourceIds.length) errors.push('Every learning item needs at least one source citation.');
  };
  for (const courseModule of course.modules) {
    contentIds.push(courseModule.id);
    for (const objective of courseModule.objectiveIds) if (!objectiveSet.has(objective)) errors.push(`Unknown module objective ${objective}.`);
    checkLinks(courseModule);
    checkLinks(courseModule.problemHook, courseModule.objectiveIds);
    for (const video of courseModule.conceptExplainer.videos) {
      contentIds.push(video.id);
      if (new Set(video.slides.map(s => s.id)).size !== video.slides.length) errors.push(`${video.id}: slide IDs must be unique.`);
      for (const slide of video.slides) { contentIds.push(slide.id); checkLinks(slide, courseModule.objectiveIds); }
      const midpointIndex = Math.ceil(video.slides.length / 2) - 1;
      if (video.midpointQuiz.afterSlideId !== video.slides[midpointIndex]?.id) errors.push(`${video.id}: place its two-question knowledge check after the midpoint slide.`);
      for (const question of video.midpointQuiz.questions) { contentIds.push(question.id); checkLinks(question, courseModule.objectiveIds); }
    }
    for (const example of courseModule.workedExamples) { contentIds.push(example.id); checkLinks(example, courseModule.objectiveIds); }
    for (const step of courseModule.guidedPractice.steps) { contentIds.push(step.id); checkLinks(step, courseModule.objectiveIds); }
    for (const scenario of courseModule.scenarioLab.scenarios) { contentIds.push(scenario.id); checkLinks(scenario, courseModule.objectiveIds); }
    if (courseModule.moduleQuiz) {
      for (const question of courseModule.moduleQuiz.questions) { contentIds.push(question.id); checkLinks(question, courseModule.objectiveIds); }
      for (const objective of courseModule.objectiveIds) if (!courseModule.moduleQuiz.questions.some(q => q.objectiveIds.includes(objective))) errors.push(`${courseModule.id}: module quiz must assess ${objective}.`);
    }
  }
  const taught = new Set(course.modules.flatMap(m => m.conceptExplainer.videos.flatMap(v => v.slides.flatMap(s => s.objectiveIds))));
  const assigned = new Set(course.modules.flatMap(m => m.objectiveIds));
  for (const objective of context.objectives) {
    if (!assigned.has(objective)) errors.push(`Assign course objective ${objective} to a module.`);
    if (!taught.has(objective)) errors.push(`Teach course objective ${objective} in a narrated slide.`);
  }
  checkLinks(course.courseEnd.miniProject);
  const project = course.courseEnd.miniProject;
  if (project.sandbox) {
    const criteria = project.sandbox.criteria;
    const videos = course.modules.flatMap(m => m.conceptExplainer.videos);
    const rubricIndices = new Set(criteria.map(c => c.rubricIndex));
    if (rubricIndices.size !== criteria.length || project.rubric.some((_, i) => !rubricIndices.has(i)) || criteria.some(c => c.rubricIndex >= project.rubric.length)) errors.push('Sandbox criteria must map one-to-one to every project rubric item.');
    for (const criterion of criteria) {
      contentIds.push(criterion.id); checkLinks(criterion);
      for (const videoId of criterion.videoIds) if (!videos.some(v => v.id === videoId)) errors.push(`Unknown sandbox concept video ${videoId}.`);
    }
    for (const objective of context.objectives) if (!project.objectiveIds.includes(objective) || !criteria.some(c => c.objectiveIds.includes(objective))) errors.push(`The sandbox project must cover ${objective}.`);
    for (const video of videos) if (!criteria.some(c => c.videoIds.includes(video.id))) errors.push(`The sandbox project must apply concept video ${video.id}.`);
  }
  contentIds.push('course-end-mini-project');
  for (const question of course.courseEnd.masteryGate.questions) { contentIds.push(question.id); checkLinks(question); }
  if (new Set(contentIds).size !== contentIds.length) errors.push('Module, video, slide, question and activity IDs must be unique across the course.');
  for (const objective of context.objectives) if (!course.courseEnd.masteryGate.questions.some(q => q.objectiveIds.includes(objective))) errors.push(`The course-end Mastery Gate must assess ${objective}.`);
  if (errors.length) throw new Error([...new Set(errors)].slice(0, 40).join(' '));
  return course;
}

