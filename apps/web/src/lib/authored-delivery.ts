import type { AuthoredCoursePackageData } from './authored-course';
import type { Course, ModuleContent, FinaleContent, GateBlock, Pipeline, Topic, VideoSlide } from '@/data/types';
import { correctChoiceIndices } from './assessment-answers';
import { publicSandbox } from './project-sandbox';

type Release = { courseId: string; revisionId: string; content: AuthoredCoursePackageData };
const stages = ['hook', 'explainer', 'worked', 'guided', 'lab'] as const;

function playerSlide(s: AuthoredCoursePackageData['modules'][number]['conceptExplainer']['videos'][number]['slides'][number], index: number): VideoSlide {
  const base = { title: s.title, narration: s.narration, sentences: s.narration.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map(t => t.trim()).filter(Boolean) ?? [s.narration] };
  if (index % 4 === 0) return { ...base, kind: 'define', term: s.title, definition: s.body[0] ?? '', parts: s.body.slice(1).map(text => ({ cue: 0, text })), analogy: { label: 'Sources', text: s.sourceIds.join(', ') } };
  if (index % 4 === 1) return { ...base, kind: 'table', columns: ['Field', 'What to check'], rows: s.body.map((text, i) => { const colon = text.indexOf(':'); return { cue: 0, cells: colon < 0 ? [String(i + 1), text] : [text.slice(0, colon), text.slice(colon + 1).trim()] }; }), note: { cue: 0, text: `Sources: ${s.sourceIds.join(', ')}` } };
  if (index % 4 === 2) return { ...base, kind: 'example', scenario: s.title, steps: s.body.map((text, i) => ({ cue: 0, time: String(i + 1), icon: 'check', text })), result: { cue: 0, text: `Sources: ${s.sourceIds.join(', ')}` } };
  return { ...base, kind: 'recap', points: s.body.map(text => ({ cue: 0, text })) };
}

/** Adapt released authoring data to the existing player; never edit the approved snapshot. */
export function authoredDelivery({ courseId, revisionId, content: pkg }: Release) {
  const version = revisionId;
  const objective = (id: string) => pkg.objectiveEvidence.find(o => o.objectiveId === id)?.objective ?? id;
  const moduleStages = (m: AuthoredCoursePackageData['modules'][number]) => [...stages, ...(m.moduleQuiz ? ['gate' as const] : [])];
  const gateFor = (quiz: NonNullable<AuthoredCoursePackageData['modules'][number]['moduleQuiz']>, module?: AuthoredCoursePackageData['modules'][number]): GateBlock => {
    const objectives = module?.objectiveIds ?? pkg.objectiveEvidence.map(o => o.objectiveId);
    return {
      step_id: module ? `${courseId}.${module.id}.gate` : `${courseId}.finale.final`, stage: 'gate', duration_min: Math.max(2, quiz.questions.length), bloom: 'evaluate', load: 'medium',
      title: quiz.title, instructions: quiz.instructions,
      objective_ids: objectives, objectives_tested: objectives,
      pass_threshold: (quiz.passPercent ?? pkg.courseEnd.masteryGate.passPercent) / 100, min_correct_per_objective: 0,
      retry_policy: { wait_hours: 0, new_variants: false }, item_count: quiz.questions.length,
      items: quiz.questions.map(q => ({ id: q.id, objective_id: q.objectiveIds[0]!, objective_ids: q.objectiveIds, kind: q.selectionType === 'multiple' ? 'multi' : 'mc', stem: q.prompt, options: q.choices.map((text, i) => ({ id: String(i), text })) })),
      remediation: Object.fromEntries(objectives.map(id => [id, { label: objective(id), step_id: `${module?.id ?? pkg.modules.find(m => m.objectiveIds.includes(id))?.id}.explain` }])),
      authoredAssessment: { courseId, revisionId, ...(module ? { moduleId: module.id } : {}) },
    };
  };
  const lessonFor = (id: string) => String(Math.max(0, pkg.modules.findIndex(m => m.objectiveIds.includes(id))) + 1);
  const topicsFor = (m: AuthoredCoursePackageData['modules'][number]): Topic[] => [
    { stage: 'hook', title: m.problemHook.title, summary: m.problemHook.question },
    { stage: 'explainer', title: 'Learn the handoff routine', summary: m.conceptExplainer.videos.map(v => v.title).join('; ') },
    { stage: 'worked', title: 'Watch complete examples', summary: m.workedExamples.map(e => e.title).join('; ') },
    { stage: 'guided', title: m.guidedPractice.title, summary: m.guidedPractice.instructions },
    { stage: 'lab', title: m.scenarioLab.title, summary: 'Apply the routine to new situations.' },
    ...(m.moduleQuiz ? [{ stage: 'gate' as const, title: m.moduleQuiz.title, summary: m.moduleQuiz.instructions }] : []),
  ];
  const modules: ModuleContent[] = pkg.modules.map((m, index) => {
    const lesson = String(index + 1);
    const scope = `${courseId}.${m.id}`;
    const base = { duration_min: 2, bloom: 'understand' as const, load: 'low' as const, objective_ids: m.objectiveIds };
    const example = m.workedExamples[0]!;
    const pipeline: Pipeline = {
      nodes: example.reasoning.map((label, i) => ({ id: `n${i}`, kind: i === 0 ? 'trigger' : 'action', label, sub: '', x: i * 220, y: 0, state: 'idle' })),
      edges: example.reasoning.slice(1).map((_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, state: 'idle' })),
    };
    return {
      course_id: courseId, course_title: pkg.title, module_id: m.id, version, locale: 'en', title: m.title,
      summary: m.problemHook.situation, estimated_minutes: m.durationMinutes, stages_included: moduleStages(m),
      metadata: { objectives: m.objectiveIds.map(id => ({ id, text: objective(id), lesson })) },
      blocks: [
        { ...base, step_id: `${scope}.hook`, stage: 'hook', kicker: 'A fictional workplace case', title: m.problemHook.title,
          brand: { name: 'Cedar', short: 'Cedar' }, roleNotes: {},
          narration: m.problemHook.situation, why: m.problemHook.question, stat: 'Make the next action clear',
          messages: [{ who: 'Teammate', av: 'T', at: 'Draft request', text: m.problemHook.situation }],
          film: { shots: [
            { type: 'phone', label: 'The request', say: m.problemHook.situation, time: '09:00', notes: [{ who: 'Teammate', av: 'T', at: 'Draft request', text: m.problemHook.question }] },
            { type: 'doc-vs-reply', label: 'Inspect the evidence', say: example.problem,
              doc: { title: 'Supplied case', heading: example.title, text: example.result, highlight: example.result.split(/\s+/)[0]! },
              reply: { title: 'The vague request', text: m.problemHook.situation, highlight: m.problemHook.situation.match(/Someone[^.]+/)?.[0] ?? m.problemHook.situation },
              then: 'Compare the request with the supplied facts before choosing the next action.', stamp: 'Clarify before acting' },
          ] },
          prompt: m.problemHook.question,
          hunches: [{ id: 'clarify', label: 'Identify the required details and clarify what is missing.' }, { id: 'guess', label: 'Guess the missing details and treat the task as complete.' }],
          correct: 'clarify', pipeline,
          reveal: { narration: example.result, frames: example.reasoning.map((caption, i) => ({ ...pipeline, caption, nodes: pipeline.nodes.map((n, j) => ({ ...n, state: j <= i ? 'ok' : 'idle' })) })), timeline: [...example.reasoning, example.result].map((caption, i) => ({ ...pipeline, caption, t: i * 6, nodes: pipeline.nodes.map((n, j) => ({ ...n, state: j <= i ? 'ok' : 'idle' })) })) },
          wrap_correct: 'You checked what the request actually says before acting.', wrap_wrong: 'Guessing hides uncertainty. Use the supplied facts and ask about gaps.', wrap_point: example.result, audio: {},
        },
        { ...base, step_id: `${scope}.explain`, stage: 'explainer', duration_min: Math.max(1, Math.ceil(m.conceptExplainer.videos.reduce((n, v) => n + v.plannedMinutes, 0))), concepts: m.objectiveIds.map(objective), segments: [],
          videos: m.conceptExplainer.videos.map(v => ({
            id: `${courseId}-${m.id}-${v.id}`, module: m.id, lesson, title: v.title, notes: v.slides.flatMap(s => s.body),
            quizAfter: v.slides.findIndex(s => s.id === v.midpointQuiz.afterSlideId),
            midQuiz: v.midpointQuiz.questions.map(q => ({ q: q.prompt, options: q.choices, ...(q.selectionType === 'multiple' ? { selectionType: 'multiple' as const, correctIndices: correctChoiceIndices(q) } : { correct: q.correct }), explain: q.explanation, hint: q.hint })), endQuiz: [],
            audio: v.slides.map(s => `/api/v1/courses/${courseId}/released-audio/${revisionId}/${s.id}`),
            slides: v.slides.map(playerSlide),
          })),
        },
        { ...base, step_id: `${scope}.worked`, stage: 'worked', bloom: 'apply', examples: m.workedExamples.map(e => ({
          step_id: `${scope}.${e.id}`, lesson, title: e.title, intro: e.problem, narration: e.result, predict: null,
          frames: [...e.reasoning, e.result].map((caption, i) => ({ caption,
            nodes: [{ id: 'reasoning', kind: 'logic', label: i < e.reasoning.length ? `Step ${i + 1}` : 'Complete handoff', sub: caption, x: 0, y: 0, state: 'ok' }], edges: [],
          })),
        })) },
        { ...base, step_id: `${scope}.guided`, stage: 'guided', bloom: 'apply', title: m.guidedPractice.title, situation: m.problemHook.situation, intro: m.guidedPractice.instructions,
          presentation: { statusLabel: 'Handoff progress', statusTitle: 'Make each detail reviewable', statusBody: 'Build a clear handoff from the supplied facts, one checkpoint at a time.', briefTag: 'Fictional Cedar case', startLabel: 'Begin the practice',
            phases: [
              { label: 'Understand', title: 'Read the request', body: 'Identify the problem and the evidence supplied.', outcome: 'Case understood' },
              { label: 'Identify', title: 'Name the owner and output', body: 'Use the source to identify who owns the next action and what they must produce.', outcome: 'Owner and output' },
              { label: 'Specify', title: 'Make timing explicit', body: 'Preserve the supplied date, time and timezone.', outcome: 'Due time recorded' },
              { label: 'Check', title: 'Define acceptance', body: 'State how a reviewer can check the deliverable.', outcome: 'Acceptance clear' },
              { label: 'Clarify', title: 'Resolve missing details', body: 'Ask for information instead of inventing it.', outcome: 'Gaps identified' },
              { label: 'Review', title: 'Review the complete handoff', body: 'Compare each field against the supplied case before sharing a draft.', outcome: 'Draft ready' },
            ],
          },
          before: { items: ['Use the supplied fictional case facts.', 'Keep a draft and mark missing information.'], downloads: [] },
          mission: { codename: m.guidedPractice.title, badge: 'Clear handoff', mentor: { who: 'Practice coach', av: 'C' }, brief: [{ who: 'Practice coach', av: 'C', at: '', text: m.guidedPractice.instructions }], goal: 'Produce a complete, source-grounded handoff.', debrief: [] },
          steps: m.guidedPractice.steps.map(s => ({ id: s.id, title: s.instruction, body: s.instruction, actions: [s.instruction], check: s.evidence, tip: s.hint })),
          finish: { title: 'Handoff ready for review', body: 'Compare your draft with the supplied case.', checklist: m.guidedPractice.steps.map(s => s.evidence) },
        },
        { ...base, step_id: `${scope}.lab`, stage: 'lab', bloom: 'analyze', title: m.scenarioLab.title, intro: 'Read each fictional situation and choose the next action.', scenarios: m.scenarioLab.scenarios.map(s => ({
          id: `${scope}.${s.id}`, lesson, title: s.title, situation: s.situation,
          question: { step_id: `${scope}.${s.id}.decision`, kind: 'mc', stem: s.challenge,
            options: [{ id: 'evidence', text: s.expectedEvidence, correct: true, rationale: s.expectedEvidence }, { id: 'guess', text: 'Guess a resolution without checking the supplied facts.', correct: false, rationale: 'The course convention requires clarification rather than guessing.' }, { id: 'claim', text: 'Claim that the work has already been completed.', correct: false, rationale: 'A draft does not establish completion or an action result.' }], hints: ['Use the supplied facts. Preserve uncertainty and request clarification.'] },
          debrief: s.expectedEvidence,
        })) },
        ...(m.moduleQuiz ? [gateFor(m.moduleQuiz, m)] : []),
      ],
    };
  });
  const end = pkg.courseEnd;
  const final = gateFor(end.masteryGate);
  const finale: FinaleContent = {
    course_id: courseId, version, objectives: pkg.objectiveEvidence.map(o => ({ id: o.objectiveId, text: o.objective, lesson: lessonFor(o.objectiveId) })), final,
    capstone: { step_id: `${courseId}.finale.capstone`, duration_min: 4, kicker: 'Mini project', title: end.miniProject.title, project_name: end.miniProject.deliverable, scene: end.miniProject.brief,
      requirements: end.miniProject.rubric.map((text, i) => ({ id: `r${i}`, text })), edge_cases: [], closing: end.miniProject.deliverable, reactions: [],
      ...(end.miniProject.sandbox ? { sandbox: { courseId, revisionId, title: end.miniProject.title, brief: end.miniProject.brief, deliverable: end.miniProject.deliverable, rubric: end.miniProject.rubric, sandbox: publicSandbox(end.miniProject.sandbox) } } : { writing: { storageKey: `authored:${revisionId}:project`, label: end.miniProject.deliverable } }),
    },
    wrap_up: { step_id: `${courseId}.finale.wrap-up`, duration_min: 1, min_sentences: 1, prompts: end.reflection.prompts.map((text, i) => ({ id: `${courseId}-reflection-${i}`, kind: i === 0 ? 'worked' : i === 1 ? 'failed' : 'transfers', text })) },
  };
  const course: Course = {
    course_id: courseId, slug: courseId, title: pkg.title, tagline: pkg.subject, goal: end.miniProject.deliverable, domain: 'Workplace collaboration', provider: 'Nebula KnowLab', level: 'Beginner',
    estimated_hours: Number((pkg.durationMinutes / 60).toFixed(2)), locales: ['en'], languages: [{ code: 'en', name: 'English', native: 'English' }], version, subjectLabel: 'clear task handoffs',
    skills: ['Task handoffs', 'Source checking', 'Clarification'], learn: pkg.objectiveEvidence.map(o => o.objective), tools: ['A browser', 'The supplied fictional case pack'], authoredRevisionId: revisionId,
    modules: pkg.modules.map((m, i) => ({ module_id: m.id, title: m.title, minutes: m.durationMinutes, stages: moduleStages(m), authored: moduleStages(m), state: i === 0 ? 'available' : 'locked', lite: false, pain: m.problemHook.situation, lead_in: null,
      lessons: m.conceptExplainer.videos.map(v => ({ id: String(i + 1), title: v.title, notes: v.slides.flatMap(s => s.body) })), topics: topicsFor(m), outcomes: m.objectiveIds.map(objective), skills: ['Clear handoffs', 'Source-grounded decisions'],
    })),
    finale: { title: 'Put your handoff into practice', summary: end.miniProject.brief, steps: [
      { id: 'capstone', stage: 'project', kicker: 'Mini project', title: end.miniProject.title, summary: end.miniProject.deliverable, minutes: 4, outcomes: end.miniProject.rubric },
      { id: 'final-check', stage: 'gate', kicker: 'Final check', title: end.masteryGate.title, summary: end.masteryGate.instructions, minutes: 2, outcomes: pkg.objectiveEvidence.map(o => o.objective) },
      { id: 'wrap-up', stage: 'reflection', kicker: 'Reflection', title: 'Your handoff routine', summary: 'Reflect on the course and finish your learning journey.', minutes: 1, outcomes: end.reflection.prompts },
    ] },
  };
  return { course, modules, finale };
}
