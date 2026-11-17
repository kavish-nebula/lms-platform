import 'server-only';
import type { Course, ModuleContent } from '@/data/types';
import { PERSONAL_LEARNING_COURSE, PERSONAL_LEARNING_REVISION } from '@/lib/personal-learning';

export const PILOT_COURSE = PERSONAL_LEARNING_COURSE;
export const PILOT_REVISION = PERSONAL_LEARNING_REVISION;
export type KnowledgeQuestion = { id: string; prompt: string; options: string[]; correct: number[] };
export type LearningTopic = { id: string; title: string; objectiveId: string; sourceIds: string[]; href: string; explanation: string; example: string; diagnostic: KnowledgeQuestion[]; review: KnowledgeQuestion[] };
const q = (id: string, prompt: string, options: string[], correct: number[]): KnowledgeQuestion => ({ id, prompt, options, correct });

/** Optional pilot enrichment bound to this approved source revision. It never
 * mutates the edition or its assessments. Learners opt in by taking a diagnostic. */
export function pilotTopics(course: Course, module: ModuleContent): LearningTopic[] {
  if (course.course_id !== PILOT_COURSE || course.authoredRevisionId !== PILOT_REVISION || module.module_id !== 'M1') return [];
  const videos = module.blocks.find(b => b.stage === 'explainer')?.videos ?? [];
  if (videos.length !== 2 || !videos.some(v => v.title === 'Automation vs AI') || !videos.some(v => v.title === 'What are Large Language Models')) return [];
  return videos.map(video => {
    const automation = video.title === 'Automation vs AI';
    const prefix = automation ? 'rules' : 'language';
    return { id: video.id, title: video.title, objectiveId: automation ? 'O1' : 'O2', sourceIds: [automation ? 'M1S1' : 'M1S2'],
      href: `/learn/courses/${course.course_id}/M1/explainer?v=${video.id}`,
      explanation: automation ? 'Fixed automation executes a predefined condition and action. AI assistance can use learned patterns to produce estimates. A changing situation does not, by itself, mean a fixed rule has learned. People define goals and review uncertain results.' : 'A language model generates text by predicting tokens from patterns learned during training and the supplied context. A fluent answer is not proof of truth. Check important claims against relevant evidence; when evidence is missing, acknowledge the gap.',
      example: automation ? 'In a fictional request queue, a programmed rule routes complete forms. A separate model estimates workload from historical queue patterns. Routing and estimation have different roles.' : 'A fictional assistant writes a polished explanation for a queue delay. The supplied report does not contain its claimed cause. Ask for supporting evidence before accepting the explanation.',
      diagnostic: automation ? [
        q(`${prefix}-d1`, 'A request system always applies a programmed field check. What evidence would show a different, learned behavior?', ['It repeats the same routing steps.', 'It uses learned patterns to estimate demand.', 'It displays a more colorful interface.', 'It receives a larger batch of forms.'], [1]),
        q(`${prefix}-d2`, 'Select all correct answers: A pattern-based assistant proposes a workflow change. Which responsibilities remain with people?', ['Define the intended workflow goal.', 'Assume every estimate is guaranteed.', 'Check evidence and review exceptions.', 'Treat changed inputs as proof of learning.'], [0, 2]),
      ] : [
        q(`${prefix}-d1`, 'Which description best explains how a language model produces its next piece of text?', ['It retrieves a guaranteed factual answer.', 'It predicts a token using learned patterns and context.', 'It verifies every claim against a current manual.', 'It understands every sentence as a person does.'], [1]),
        q(`${prefix}-d2`, 'Select all correct answers: An assistant adds a confident cause that is absent from the supplied report. What is appropriate?', ['Accept it because the wording is polished.', 'Check whether relevant evidence supports the cause.', 'Acknowledge that the report does not establish it.', 'Assume the model accessed an unseen approved record.'], [1, 2]),
      ],
      review: automation ? [
        q(`${prefix}-r1`, 'A queue grows, but its program still applies the same cutoff. What has changed?', ['The situation, with no evidence the rule learned.', 'The program has automatically learned a new goal.', 'The cutoff now guarantees a model prediction.', 'The queue has replaced the need for human review.'], [0]),
        q(`${prefix}-r2`, 'Select all correct answers: Which descriptions distinguish execution from prediction?', ['A fixed rule follows a defined condition.', 'A learned estimate can still need checking.', 'A changing workload always retrains the rule.', 'An estimate guarantees the desired outcome.'], [0, 1]),
      ] : [
        q(`${prefix}-r1`, 'Why can an articulate model response still need verification?', ['Generating likely text does not establish its truth.', 'All model responses are exact copies of a manual.', 'Every fluent response includes verified evidence.', 'Training guarantees all future claims are current.'], [0]),
        q(`${prefix}-r2`, 'Select all correct answers: A report omits the reason for a delay. How should you handle a generated explanation?', ['Locate relevant evidence before accepting its cause.', 'Separate a proposed explanation from a confirmed fact.', 'Treat fluent wording as sufficient confirmation.', 'Assume omitted facts were verified elsewhere.'], [0, 1]),
      ],
    };
  });
}

export const publicQuestion = ({ correct: _correct, ...question }: KnowledgeQuestion) => ({ ...question, multiple: _correct.length > 1 });
