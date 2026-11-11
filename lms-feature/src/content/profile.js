/*
  The learner profile questionnaire — it never asks who the learner is (the login already
  knows that): it asks where they come from and why they are here. Generic on purpose: nothing here names a
  course or a tool, so the same questions work for any course on the platform.
  Every question is skippable, and every answer drives something the learner can
  see (see adaptation() in engine/adaptive.js). No question sorts the learner
  into a "style" — answers set defaults the learner can change at any time, and
  what they show in the pre-check and the lessons outranks what they said here.
  Stored as values (`v`), never as display text.
*/
export const PROFILE_VERSION = 3

export const QUESTIONS = [
  {
    id: 'domain', type: 'single', label: 'Field',
    q: 'Which field do you work in?',
    options: [
      { v: 'manufacturing', label: 'Manufacturing' },
      { v: 'it', label: 'IT services' },
      { v: 'retail', label: 'Retail / e-commerce' },
      { v: 'finance', label: 'Finance' },
      { v: 'other', label: 'Something else', free: 'Type your field — e.g. Healthcare' },
    ],
    ifSkipped: 'the course’s own examples only',
  },
  {
    id: 'role', type: 'single', label: 'Role',
    q: 'What best describes your role?',
    options: [
      { v: 'engineer', label: 'Engineer / developer' },
      { v: 'lead', label: 'Team lead' },
      { v: 'manager', label: 'Manager' },
      { v: 'student', label: 'Student' },
      { v: 'other', label: 'Something else', free: 'Type your role — e.g. Data analyst' },
    ],
    ifSkipped: 'the course’s general framing',
  },
  {
    id: 'goal', type: 'single', label: 'Goal',
    q: 'What do you want from this course?',
    options: [
      { v: 'work', label: 'Use it at work now' },
      { v: 'ideas', label: 'Understand the ideas' },
      { v: 'portfolio', label: 'Build a portfolio' },
      { v: 'curious', label: 'Just curious' },
    ],
    ifSkipped: 'the standard dashboard',
  },
  {
    id: 'experience', type: 'single', label: 'Experience with this topic',
    q: 'How much have you worked with this topic?',
    options: [
      { v: 'never', label: 'Never' },
      { v: 'little', label: 'Tried a little' },
      { v: 'sometimes', label: 'I use it sometimes' },
      { v: 'regularly', label: 'I use it regularly' },
    ],
    ifSkipped: 'standard support until the pre-assessment measures it',
  },
  {
    id: 'firstStep', type: 'single', label: 'What helps first',
    q: 'When something is new, what helps you first?',
    options: [
      { v: 'example', label: 'See a full example' },
      { v: 'idea', label: 'Understand the idea' },
      { v: 'try', label: 'Try it myself first' },
    ],
    ifSkipped: 'idea first, then the example',
  },
  {
    id: 'style', type: 'single', label: 'Explanations',
    q: 'How do you like explanations?',
    options: [
      { v: 'short', label: 'Short and direct' },
      { v: 'steps', label: 'Step by step, with analogies' },
    ],
    ifSkipped: 'analogies offered only when a step trips you up',
  },
  {
    id: 'needs', type: 'multi', label: 'Comfort',
    q: 'Anything that would make this easier to use?',
    options: [
      { v: 'largeText', label: 'Larger text' },
      { v: 'lessMotion', label: 'Less motion' },
    ],
    noneLabel: 'No, it’s fine as it is',
    ifSkipped: 'standard text size and motion',
  },
]

export const blankProfile = () => ({
  version: PROFILE_VERSION,
  role: null, roleOther: '', domain: null, domainOther: '', goal: null, experience: null, firstStep: null, style: null, needs: [],
  at: null,
})

/* The label a learner picked, for showing an answer back to them. */
export function answerLabel(question, value, profile) {
  if (question.type === 'text') return value?.trim() || null
  // "Something else" shows what the learner typed
  if (value === 'other' && profile?.[`${question.id}Other`]?.trim()) return profile[`${question.id}Other`].trim()
  if (question.type === 'multi') {
    const picked = question.options.filter((o) => value?.includes(o.v)).map((o) => o.label)
    return picked.length ? picked.join(', ') : null
  }
  return question.options.find((o) => o.v === value)?.label || null
}
