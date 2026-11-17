import type { Course } from '@/data/types';
import type { SetupAnswers } from './setup';

export type PrerequisiteTopic = 'llm' | 'chatbot';
export type Familiarity = 'familiar' | 'new' | 'unsure';
export type PrerequisiteSelections = Partial<Record<PrerequisiteTopic, { familiarity?: Familiarity; response?: string }>>;
export const PREREQUISITE_TOPICS = {
  llm: {
    title: 'Large language models (LLMs)',
    why: 'Agents use a language model to interpret requests and produce responses.',
    introduction: 'A large language model generates text using patterns learned during training and the context supplied to it. Its answers can be wrong, so important claims need verification.',
    question: 'What does a large language model do?',
    choices: [
      { id: 'database', text: 'Retrieves only verified facts from a database.' },
      { id: 'generate', text: 'Generates text from learned patterns and supplied context.' },
      { id: 'control', text: 'Independently operates every connected application.' },
      { id: 'unsure', text: 'I’m not sure yet.' },
    ],
    correct: 'generate',
    explanation: 'An LLM generates text; it does not inherently guarantee factual accuracy or access to tools.',
  },
  chatbot: {
    title: 'Chatbots',
    why: 'Understanding a conversation interface helps explain how an agent differs from a chatbot.',
    introduction: 'A chatbot is an interface for exchanging messages with a system. Some use fixed rules and others use language models. A chat response alone does not show that the system can use tools or complete an external action.',
    question: 'A chatbot says “I booked the appointment,” but has no booking-tool access. What does that tell you?',
    choices: [
      { id: 'completed', text: 'The message proves the appointment was booked.' },
      { id: 'automatic', text: 'A conversation automatically grants booking access.' },
      { id: 'unverified', text: 'The message does not establish that a booking happened.' },
      { id: 'unsure', text: 'I’m not sure yet.' },
    ],
    correct: 'unverified',
    explanation: 'A message is not evidence of an external action. The system needs appropriate tools, access and confirmation.',
  },
} as const;

/** Explicit prerequisite metadata, with the requested AI Agent starting point.
 * Never guess prerequisites from a learner's profession, coding answer or score. */
export function prerequisitesFor(course: Pick<Course, 'course_id' | 'prerequisiteTopics'>): PrerequisiteTopic[] {
  const topics: PrerequisiteTopic[] = course.prerequisiteTopics ?? (course.course_id === 'ai-agent' ? ['llm', 'chatbot'] : []);
  return [...new Set(topics)];
}

export function prerequisiteSelectionComplete(topics: PrerequisiteTopic[], selections: PrerequisiteSelections) {
  return topics.every(topic => {
    const choice = selections[topic];
    return choice?.familiarity === 'new' || choice?.familiarity === 'unsure' || choice?.familiarity === 'familiar' && PREREQUISITE_TOPICS[topic].choices.some(o => o.id === choice.response);
  });
}

export function reviewPrerequisites(topics: PrerequisiteTopic[], selections: PrerequisiteSelections) {
  return topics.map(topic => {
    const choice = selections[topic];
    const observed = choice?.familiarity === 'familiar' && choice.response
      ? choice.response === PREREQUISITE_TOPICS[topic].correct ? 'supported' as const : 'review' as const
      : 'not-taken' as const;
    return { topic, familiarity: choice?.familiarity ?? null, observed, needsIntroduction: choice?.familiarity !== 'familiar' || observed !== 'supported' };
  });
}

/** Course-local context only. No profile writes, mastery score or completion award. */
export function prerequisiteEnrollmentAnswers(existing: SetupAnswers, topics: PrerequisiteTopic[], selections: PrerequisiteSelections): SetupAnswers {
  const turns = reviewPrerequisites(topics, selections).map(result => ({
    slot: `prereq_${result.topic}`,
    q: `Starting point: ${PREREQUISITE_TOPICS[result.topic].title}`,
    a: `Self-report: ${result.familiarity === 'familiar' ? 'familiar' : result.familiarity === 'new' ? 'new to this' : 'not sure'}. Quick concept check: ${result.observed === 'supported' ? 'selected the supported explanation' : result.observed === 'review' ? 'needs review' : 'not taken'}. Advisory only; learner chose to continue.`,
  }));
  return { ...existing, courseInterview: [...(existing.courseInterview ?? []).filter(t => !t.slot.startsWith('prereq_')).slice(0, 16 - turns.length), ...turns] };
}

export type PrerequisiteSuggestion = { courseId: string; title: string; href: string; topics: PrerequisiteTopic[]; moduleTitle?: string };
const mentions = (topic: PrerequisiteTopic, text: string) => topic === 'llm' ? /\bLLMs?\b|large language models?/i.test(text) : /\bchatbots?\b|conversational AI/i.test(text);

/** Caller supplies only the published learner catalog. Never invent a foundation
 * course, recommend this course to itself, or infer unrelated topic coverage. */
export function prerequisiteSuggestions(catalog: Course[], targetId: string, topics: PrerequisiteTopic[]): PrerequisiteSuggestion[] {
  const candidates = catalog.filter(c => c.course_id !== targetId).flatMap<PrerequisiteSuggestion>(course => {
    const whole = topics.filter(t => mentions(t, [course.title, ...course.learn, ...course.skills, ...course.modules.map(m=>m.title)].join(' ')));
    if (!whole.length) return [];
    const specific = course.modules.filter(m => topics.some(t => mentions(t, m.title)));
    const foundational = /introduction|essentials|fundamentals|foundations|beginner/i.test(course.title);
    if (!foundational) return specific.map(module=>({courseId:course.course_id,title:course.title,topics:topics.filter(t=>mentions(t,module.title)),href:`/learn/courses/${course.course_id}/${module.module_id}/reader`,moduleTitle:module.title}));
    return [{courseId:course.course_id,title:course.title,topics:whole,href:`/learn/courses/${course.course_id}`}];
  });
  const unique = new Map<string, PrerequisiteSuggestion>();
  for (const item of candidates) {const key=[item.title,item.moduleTitle??''].join(':').toLowerCase();if(!unique.has(key))unique.set(key,item);}
  const ranked=[...unique.values()].sort((a,b) => Number(!!a.moduleTitle) - Number(!!b.moduleTitle) || b.topics.length - a.topics.length || a.title.localeCompare(b.title));
  const selected: PrerequisiteSuggestion[]=[];
  // Do not fill all cards with LLM introductions while omitting an available chatbot course.
  for(const topic of topics){if(selected.some(s=>s.topics.includes(topic)))continue;const next=ranked.find(s=>s.topics.includes(topic));if(next)selected.push(next);}
  for(const item of ranked){if(selected.length>=3)break;if(!selected.includes(item))selected.push(item);}
  return selected;
}
