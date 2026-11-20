import type { AuthoredCoursePackageData } from './authored-course';
import { courseSources, isConceptTeachingSource, isActiveSource, moduleHasScenarioLab } from './source-library';
import type { CourseBriefData } from './content-creator';

type Unit = AuthoredCoursePackageData['modules'][number];
/** Creator-authored fragments replace only their assigned module sections. */
export function smeModuleActivities(brief: CourseBriefData, moduleId: string): Partial<Pick<Unit, 'workedExamples' | 'guidedPractice' | 'scenarioLab' | 'moduleQuiz'>> {
  const sources = courseSources(brief).filter(s => s.moduleId === moduleId && isActiveSource(brief, s));
  const citations = (source: typeof sources[number], objectives = source.objectiveIds) => ({ objectiveIds: objectives, sourceIds: [source.id, ...sources.filter(s => isConceptTeachingSource(s) && s.objectiveIds.some(id => objectives.includes(id))).map(s => s.id)].slice(0, 60) });
  const examples = sources.filter(s => s.purpose === 'worked-example');
  const practice = sources.find(s => s.purpose === 'guided-practice');
  const lab = sources.find(s => s.purpose === 'scenario-lab');
  const quiz = sources.find(s => s.purpose === 'module-quiz');
  return {
    ...(examples.length ? { workedExamples: examples.map(s => ({ id: `EX_${s.id}`, title: s.title.trim(), problem: s.text.trim(), reasoning: (s.workedExample?.reasoning ?? []).map(r => r.trim()), result: s.workedExample?.result.trim() ?? '', ...citations(s) })) } : {}),
    ...(practice ? { guidedPractice: { title: practice.title.trim(), instructions: practice.text.trim(), steps: (practice.practiceSteps ?? []).map(s => ({ id: s.id, instruction: s.instruction.trim(), hint: s.hint.trim(), evidence: s.evidence.trim(), ...citations(practice) })) } } : {}),
    ...(lab ? { scenarioLab: { title: lab.title.trim(), instructions: lab.text.trim(), scenarios: (lab.scenarios ?? []).map(s => ({ id: s.id, title: s.title.trim(), situation: s.situation.trim(), challenge: s.challenge.trim(), expectedEvidence: s.expectedEvidence.trim(), ...citations(lab) })) } } : {}),
    ...(quiz ? { moduleQuiz: { title: quiz.title.trim(), instructions: quiz.text.trim(), questions: (quiz.quizQuestions ?? []).map(q => ({ id: q.id, prompt: q.prompt.trim(), choices: q.choices.map(c => c.trim()), hint: q.hint.trim(), explanation: q.explanation.trim(), ...citations(quiz, q.objectiveIds), ...(q.selectionType === 'multiple' ? { selectionType: 'multiple' as const, correctIndices: q.correctIndices } : { selectionType: 'single' as const, correct: q.correctIndices[0] }) })) } } : {}),
  };
}

/** MCP/full-package assembly must preserve supplied material as well as the built-in generator. */
export function smeActivityIssues(content: Unit, brief: CourseBriefData) {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  const expected = smeModuleActivities(brief, content.id);
  const policyIssues = brief.sourceLibrary?.modules.some(m => m.id === content.id) && (!!content.scenarioLab !== moduleHasScenarioLab(brief, content.id)) ? [`${content.id}: ${moduleHasScenarioLab(brief, content.id) ? 'include' : 'omit'} the scenario lab according to the saved module setting.`] : [];
  return [...policyIssues, ...(Object.keys(expected) as (keyof typeof expected)[]).flatMap(key => {
    const actual = key === 'moduleQuiz' && content.moduleQuiz ? { title: content.moduleQuiz.title, instructions: content.moduleQuiz.instructions, questions: content.moduleQuiz.questions.map(q => ({ ...q, selectionType: q.selectionType ?? 'single' })) } : content[key];
    return JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected[key])) ? [] : [`${content.id}: preserve the saved SME ${key} content, stable IDs, objective mappings and answer keys.`];
  })];
}
