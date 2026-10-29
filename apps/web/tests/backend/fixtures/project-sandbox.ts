import type { AuthoredCoursePackageData } from '@/lib/authored-course';
import type { SandboxArtifactData } from '@/lib/project-sandbox';

export const projectBrief = { title: 'Practical handoffs', sourceText: 'Fictional case: Maya owns the task. A handoff states its requested task and an observable acceptance check.', objectives: [{ text: 'Name the supplied owner.', bloom: 'Apply' as const }, { text: 'Produce a checkable task handoff.', bloom: 'Apply' as const }] };
const links = (i: number) => ({ objectiveIds: [`O${i}`], sourceIds: ['S1'] });
const question = (id: string, i: number) => ({ id, prompt: 'Which action preserves the supplied facts?', choices: ['Use the supplied task.', 'Invent another task.'], correct: 0, hint: 'Read the supplied facts.', explanation: 'Preserve what the source states.', ...links(i) });
export function sandboxPackage(briefRevision = 1): AuthoredCoursePackageData {
  return {
    schemaVersion: 1, title: 'Practical handoffs', subject: 'Fictional workplace practice', durationMinutes: 20, briefRevision,
    sources: [{ id: 'S1', kind: 'sme', title: 'Fictional case', reference: projectBrief.sourceText }],
    objectiveEvidence: projectBrief.objectives.map((o, i) => ({ objectiveId: `O${i + 1}`, objective: o.text, sourceIds: ['S1'] })),
    modules: [1, 2].map(i => ({ id: `M${i}`, title: `Handoff topic ${i}`, durationMinutes: 5, ...links(i),
      problemHook: { title: 'A vague task', situation: 'The request leaves details unclear.', question: 'What evidence is needed?', ...links(i) },
      conceptExplainer: { videos: [{ id: `V${i}`, title: i === 1 ? 'Name the owner' : 'Specify the deliverable', plannedMinutes: 1,
        slides: [{ id: `SL${i}`, title: 'Use supplied facts', body: [projectBrief.sourceText], narration: projectBrief.sourceText, ...links(i) }], midpointQuiz: { afterSlideId: `SL${i}`, questions: [question(`MQ${i}A`, i), question(`MQ${i}B`, i)] } }] },
      workedExamples: [{ id: `EX${i}`, title: 'An explicit handoff', problem: 'Clarify the request.', reasoning: ['Read the source.'], result: 'Maya prepares the requested task with a check.', ...links(i) }],
      guidedPractice: { title: 'Write a handoff', instructions: 'Use the source.', steps: [{ id: `GP${i}`, instruction: 'Preserve the facts.', hint: 'Read again.', evidence: 'An explicit owner and task.', ...links(i) }] },
      scenarioLab: { title: 'Clarify a new task', scenarios: [{ id: `SC${i}`, title: 'Another task', situation: 'A new task is supplied.', challenge: 'Preserve the facts.', expectedEvidence: 'A source-grounded handoff.', ...links(i) }] },
    })),
    courseEnd: {
      miniProject: { title: 'Build a handoff generator', brief: 'Build one handoff workflow that uses the supplied owner, task and acceptance check. Run and test it inside this course.', deliverable: 'A saved artifact and a running handoff workflow for both supplied task cases.', rubric: ['Uses Maya as the supplied owner in both cases.', 'Preserves each requested task and includes an acceptance check.'], objectiveIds: ['O1', 'O2'], sourceIds: ['S1'],
        sandbox: { version: 1, runtime: 'data-workflow', instructions: ['Enter the supplied owner and a concrete acceptance check.', 'Add a template step with output name handoff. Use values.owner, input.task and values.acceptance in double braces.', 'Run the sample, test both cases, then submit your artifact.'],
          fields: [{ id: 'owner', label: 'Task owner', help: 'Use the owner in the source.', starter: '' }, { id: 'acceptance', label: 'Acceptance check', help: 'State observable evidence of completion.', starter: '' }],
          inputs: [{ id: 'task', label: 'Requested task', sample: 'Prepare agenda' }], starterSteps: [],
          tests: [{ id: 'agenda', label: 'Agenda request', inputs: { task: 'Prepare agenda' } }, { id: 'review', label: 'Review request', inputs: { task: 'Review draft' } }],
          criteria: [
            { id: 'OWNER', rubricIndex: 0, weight: 50, ...links(1), videoIds: ['V1'], checks: [{ testId: 'agenda', path: 'values.owner', operator: 'equals', expected: 'Maya' }, { testId: 'review', path: 'output.handoff', operator: 'contains', expected: 'Maya' }] },
            { id: 'TASK', rubricIndex: 1, weight: 50, ...links(2), videoIds: ['V2'], checks: [{ testId: 'agenda', path: 'output.handoff', operator: 'contains', expected: 'Prepare agenda' }, { testId: 'review', path: 'output.handoff', operator: 'contains', expected: 'Review draft' }, { testId: 'agenda', path: 'values.acceptance', operator: 'notEmpty' }] },
          ],
        },
      },
      masteryGate: { title: 'Final handoff check', instructions: 'Use the supplied source.', passPercent: 80, questions: [question('FINAL1', 1), question('FINAL2', 2)] }, reflection: { prompts: ['What makes a handoff checkable?'] },
    },
  };
}
export const sandboxSolution: SandboxArtifactData = { version: 1, values: { owner: 'Maya', acceptance: 'Three agenda items.' }, steps: [{ id: 'compose', operation: 'template', output: 'handoff', expression: '{{values.owner}}: {{input.task}}. {{values.acceptance}}' }] };
