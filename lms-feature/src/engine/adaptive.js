import { DOMAINS, WORLD, ROLES, ROLE_HOOK, ROLE_BRIEF, customDomain, customRole } from '../content/world.js'

/*
  Adaptivity rules — pure functions, no React, no stores.

  Three layers decide how a lesson is delivered, strongest last:
    1. what the learner said   (profile questionnaire)
    2. what the learner showed (the pre-assessment before the course → support per lesson)
    3. what the learner does   (two failed checks or replays offer the analogy to anyone)
  Never framed as levels or scores to the learner; every adaptation is shown and explained.
  Quiz questions and pass marks never adapt.
*/
const ORDER = {
  example: ['worked', 'explain', 'scenarios'],
  idea: ['explain', 'worked', 'scenarios'],
  try: ['scenarios', 'explain', 'worked'],
}
const STATED_SUPPORT = { never: 'extra', regularly: 'light' } // anything else → standard
const MEASURED_SUPPORT = ['extra', 'standard', 'light'] // by pre-check items right for that lesson: 0, 1, 2

export const SUPPORT_LABEL = { extra: 'Extra support', standard: 'Standard', light: 'Light touch' }

/*
  Profile (+ pre-check results) → course-wide settings.
  A skipped answer (null) leaves that setting at the course default.
*/
export function adaptation(profile, precheck = {}) {
  const p = profile || {}
  const stated = STATED_SUPPORT[p.experience] || 'standard'

  // a lesson's support level, and where that came from
  const measured = (moduleN, subId) => {
    const rec = precheck
    if (!rec || rec.skipped) return null
    if (rec.isNew) return 'extra'
    const right = rec.lessons?.[subId]
    return typeof right === 'number' ? MEASURED_SUPPORT[Math.min(2, right)] : null
  }
  const support = (moduleN, subId) => measured(moduleN, subId) || stated
  const source = (moduleN, subId) => (measured(moduleN, subId) ? 'pre-assessment' : p.experience ? 'profile' : 'default')
  // the module-wide steps (guided practice) and the course capstone follow the lesson that needs the most help
  const moduleSupport = (moduleN, subIds) => {
    const levels = subIds.map((s) => support(moduleN, s))
    return levels.includes('extra') ? 'extra' : levels.every((l) => l === 'light') ? 'light' : 'standard'
  }

  // "Something else" counts once the learner has typed what it is
  const typed = (key) => (p[key] === 'other' ? p[`${key}Other`]?.trim() || null : null)
  const role = ROLES[p.role] ? p.role : typed('role') ? 'other' : null

  return {
    role,
    roleLabel: role === 'other' ? customRole(typed('role')) : role ? ROLES[role] : null,
    domain: DOMAINS[p.domain] || (typed('domain') ? customDomain(typed('domain')) : null),
    goal: p.goal || null,
    style: p.style || null,
    order: ORDER[p.firstStep] || ORDER.idea,
    firstStep: p.firstStep || null,
    narration: { rate: 1, muted: false }, // every lesson is narrated; the learner can still mute a clip on its player bar
    paceFactor: 1, // lesson length is the same for everyone; adaptation changes the delivery, not the duration
    textScale: p.needs?.includes('largeText') ? 1.12 : 1,
    reduceMotion: !!p.needs?.includes('lessMotion'),
    support, source, moduleSupport,
  }
}

/*
  Everything one stage needs, for one learner: the course-wide settings plus what
  this lesson's support level turns on or off, and the reasons to show for each.
*/
export function stageSettings(adapt, { module: m, subId = null, kind, demoMode = false }) {
  const subIds = m.submodules.map((s) => s.id)
  const level = subId ? adapt.support(m.n, subId) : adapt.moduleSupport(m.n, subIds)
  const from = subId ? adapt.source(m.n, subId) : subIds.some((s) => adapt.source(m.n, s) === 'pre-assessment') ? 'pre-assessment' : 'profile'
  const domain = adapt.domain

  const s = {
    ...adapt,
    level,
    analogyUpFront: level === 'extra' || (adapt.style === 'steps' && level !== 'light'),
    whyOpen: level === 'extra',
    guidedScaffold: level === 'light' || (adapt.style === 'short' && level !== 'extra') ? 'collapsed' : 'full',
    showDecoys: level !== 'extra',
    narration: { ...adapt.narration, canSkip: demoMode || level === 'light' },
    world: domain && subId && WORLD[subId] ? { label: domain.label, text: WORLD[subId](domain) } : null,
    roleLine: adapt.role ? ROLE_HOOK[m.n]?.[adapt.role] || null : null,
    roleBrief: adapt.role ? ROLE_BRIEF[adapt.role] || null : null,
  }

  // what to tell the learner was adapted on this stage, and why
  const chips = []
  const lesson = ['explain', 'worked', 'scenarios'].includes(kind)
  if (lesson && adapt.firstStep && adapt.firstStep !== 'idea') {
    chips.push({ text: adapt.firstStep === 'example' ? 'Example first' : 'Try it first', why: 'You said this helps you first — it sets the order of each lesson.', from: 'profile' })
  }
  if (level !== 'standard' && (lesson || kind === 'guided')) {
    chips.push({
      text: SUPPORT_LABEL[level],
      why: level === 'extra'
        ? 'Analogy and “why” notes are open, and practice has no decoy nodes.'
        : 'Analogy is tucked away, narration can be skipped, and build explanations are folded.',
      from,
    })
  }
  if (kind === 'explain' && s.analogyUpFront && level !== 'extra') chips.push({ text: 'Analogy open', why: 'You asked for step-by-step explanations with analogies.', from: 'profile' })
  if (s.world && (kind === 'explain' || kind === 'scenarios')) chips.push({ text: `In your world: ${s.world.label}`, why: 'The idea is restated in your own field.', from: 'profile' })
  if ((kind === 'hook' && s.roleLine) || (kind === 'project' && s.roleBrief)) chips.push({ text: `Framed for ${s.roleLabel}`, why: 'The opening and the capstone brief speak to your role.', from: 'profile' })
  s.chips = kind === 'quiz' ? [] : chips
  return s
}

const CHANGE = {
  role: (v, a) => (a.roleLabel ? `The opening of each module and the course capstone brief are framed for ${a.roleLabel}.` : null),
  domain: (v, a) => (a.domain ? `Every lesson gets an “In your world” card that restates the idea in ${a.domain.label} terms.` : null),
  goal: {
    work: 'Your dashboard leads with the modules you have completed — each one is a skill you can use at work.',
    ideas: 'Your dashboard leads with the modules you have completed.',
    portfolio: 'Your dashboard leads with the artifacts in your portfolio.',
    curious: 'Your dashboard keeps its usual order — nothing is pushed to the front.',
  },
  experience: {
    never: 'Every lesson starts with extra support: the analogy and “why” notes are open, and practice has no decoy nodes. The pre-assessment can change this lesson by lesson.',
    little: 'Lessons start on standard support. The pre-assessment adjusts it lesson by lesson.',
    sometimes: 'Lessons start on standard support. The pre-assessment can lighten the lessons you already know.',
    regularly: 'Every lesson starts on a light touch: analogy tucked away, narration skippable, build explanations folded — until the pre-assessment says otherwise.',
  },
  firstStep: {
    example: 'Each lesson opens with the worked example, then the idea, then scenarios.',
    idea: 'Each lesson opens with the idea, then the worked example, then scenarios.',
    try: 'Each lesson opens with scenarios to try, then the idea, then the worked example.',
  },
  style: {
    short: 'Analogies stay closed and build explanations are folded — except in lessons on extra support.',
    steps: 'The analogy is open on every beat and each build step is explained first — except in lessons on a light touch.',
  },
  needs: (v) => {
    const parts = [v?.includes('largeText') && 'text is shown larger', v?.includes('lessMotion') && 'animations are kept to a minimum'].filter(Boolean)
    return parts.length ? `${parts.join(' and ')}.`.replace(/^./, (c) => c.toUpperCase()) : null
  },
}

/* The same decisions as adaptation(), as rows a learner can read: answer → what changes. */
export function explainAdaptations(profile, questions) {
  const p = profile || {}
  const a = adaptation(p)
  return questions.filter((q) => q.type !== 'text').map((q) => {
    const v = p[q.id]
    const rule = CHANGE[q.id]
    const change = (typeof rule === 'function' ? rule(v, a) : rule?.[v]) || null
    return { id: q.id, label: q.label, value: v, answered: change !== null, change: change || `Not set — ${q.ifSkipped}.` }
  })
}

/*
  What the dashboard leads with, by the learner's goal:
  `line` sits under the module to continue, `lead` names the stat shown first.
*/
export function framing(goal, m) {
  if (goal === 'work') return { lead: 'hours', line: `Shipping this takes about ${m.hrsSaved} hours a week of manual work off someone’s plate.` }
  if (goal === 'ideas') return { lead: 'modules', line: `The ideas inside: ${m.submodules.map((s) => s.title.toLowerCase()).join(', ')}.` }
  if (goal === 'portfolio') return { lead: 'artifacts', line: 'Finishing it adds a working, checked workflow to your portfolio.' }
  return { lead: null, line: m.pain }
}

// Confusion detector: quiet alternate explanation after repeated replays or failed checks.
export function shouldOfferAltTake(sig = {}) {
  return (sig.replays || 0) >= 2 || (sig.checkFails || 0) >= 2
}
