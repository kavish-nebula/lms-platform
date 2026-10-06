import { MODULES, STAGE_MINUTES } from '../content/course.js'

/*
  One place for stage order, module progress and unlocking — shared by Dashboard,
  Course, the Learning Plan and the course store. Order and labels mirror
  buildStages in player/Player.jsx.
*/
export const DEFAULT_ORDER = ['explain', 'worked', 'scenarios']

/*
  `order` is the learner's sequence inside each sub-module (see adaptation()).
  Reordering never changes a stage's key, so saved progress survives a change of order.
*/
export function stageList(m, order = DEFAULT_ORDER) {
  const stage = (key, kind, label, subId) => ({ key, kind, label, subId, minutes: STAGE_MINUTES[kind] })
  // a video module: one concept video per lesson, then the module quiz
  if (m.lite) return [...m.submodules.map((sm) => stage(`${sm.id}-explain`, 'explain', `${sm.id} · ${sm.title}`, sm.id)), stage('quiz', 'quiz', 'Module quiz')]
  const subLabel = { explain: (sm) => sm.title, worked: () => 'See it built', scenarios: () => 'Scenarios' }
  return [
    stage('hook', 'hook', m.hook?.kicker || m.hookTitle || 'The wake-up call'),
    ...m.submodules.flatMap((sm) => order.map((kind) => stage(`${sm.id}-${kind}`, kind, `${sm.id} · ${subLabel[kind](sm)}`, sm.id))),
    stage('guided', 'guided', 'Guided practice'),
    stage('quiz', 'quiz', 'Module quiz'),
  ]
}

/*
  Lesson-sized units for the Learning Plan: the hook, each sub-module (idea +
  example + scenarios), the guided practice, the quiz. Every stage
  belongs to exactly one unit.
*/
export function unitList(m, paceFactor = 1) {
  const stages = stageList(m)
  const unit = (id, kind, label, stageKeys) => ({
    unit: id, kind, label, stageKeys,
    minutes: Math.max(1, Math.round(stages.filter((s) => stageKeys.includes(s.key)).reduce((n, s) => n + s.minutes, 0) * paceFactor)),
  })
  if (m.lite) return [...m.submodules.map((sm) => unit(sm.id, 'lesson', sm.title, [`${sm.id}-explain`])), unit('quiz', 'quiz', 'Module quiz', ['quiz'])]
  return [
    unit('hook', 'hook', stages[0].label, ['hook']),
    ...m.submodules.map((sm) => unit(sm.id, 'lesson', sm.title, DEFAULT_ORDER.map((kind) => `${sm.id}-${kind}`))),
    unit('guided', 'guided', 'Guided practice', ['guided']),
    unit('quiz', 'quiz', 'Module quiz', ['quiz']),
  ]
}

export const unitDone = (prog, u) => u.stageKeys.every((k) => prog?.stages?.[k])

export function moduleMinutes(m, paceFactor = 1) {
  return Math.round(stageList(m).reduce((sum, s) => sum + s.minutes, 0) * paceFactor)
}

export function moduleProgress(prog, m) {
  const stages = stageList(m)
  const done = stages.filter((s) => prog?.stages?.[s.key]).length
  return { done, total: stages.length, value: done / stages.length }
}

/* Progress across the modules that exist today. */
export function courseProgress(progress) {
  const built = MODULES.filter((m) => m.built)
  const parts = built.map((m) => moduleProgress(progress[m.n], m))
  const done = parts.reduce((n, p) => n + p.done, 0)
  const total = parts.reduce((n, p) => n + p.total, 0)
  return { done, total, value: total ? done / total : 0 }
}

export function highestCompleted(progress) {
  return MODULES.reduce((acc, m) => (progress[m.n]?.completed ? m.n : acc), 0)
}

/* Calibration can point past what is built — fall back to the first module then. */
export function startModule(calibrate) {
  const start = calibrate?.startModule || 1
  return MODULES.some((m) => m.built && m.n >= start) ? start : 1
}

export function isUnlocked(m, progress, { demoMode, calibrate } = {}) {
  if (!m?.built) return false // dummy modules stay locked
  if (demoMode) return true
  return m.n <= Math.max(startModule(calibrate), highestCompleted(progress) + 1)
}

/* The module to continue — null once everything built is shipped. */
export function currentModule(progress, calibrate) {
  const open = MODULES.filter((m) => m.built && !progress[m.n]?.completed)
  return open.find((m) => m.n >= startModule(calibrate)) || open[0] || null
}

/*
  Where to resume: the step the learner last had open, in the module they were in.
  If that step is finished by now, the next unfinished step of the same module;
  if that module has nothing left (or nothing was opened yet), the first unfinished
  step of the module to continue. null once every available module is done.
  → { module, stage, index, total, started, at }
*/
export function resumePoint(progress, calibrate, last, order = DEFAULT_ORDER) {
  const open = (m) => (m?.built ? stageList(m, order).filter((s) => !progress[m.n]?.stages?.[s.key]) : [])
  const lastMod = MODULES.find((m) => m.n === last?.moduleN)
  const module = open(lastMod).length ? lastMod : currentModule(progress, calibrate)
  if (!module) return null
  const stages = stageList(module, order)
  const left = open(module)
  if (!left.length) return null
  const stage = (module === lastMod && left.find((s) => s.key === last.key)) || left[0]
  return {
    module, stage, index: stages.findIndex((s) => s.key === stage.key), total: stages.length,
    started: Object.keys(progress[module.n]?.stages || {}).length > 0 || module === lastMod,
    at: module === lastMod ? last.at : null,
  }
}

/*
  The course ends with two stops after the last module: the capstone project,
  then the final assessment. → 'module' | 'capstone' | 'final' | 'done'
*/
export function courseStep(progress, calibrate, capstone, final) {
  if (currentModule(progress, calibrate)) return 'module'
  if (!capstone) return 'capstone'
  return final?.passed ? 'done' : 'final'
}

/* A course is the learner's once its pre-assessment is on record (taken, skipped or "I'm new") or any step is done. */
export function isEnrolled(precheck, progress) {
  return !!precheck || Object.values(progress || {}).some((m) => Object.keys(m.stages || {}).length > 0 || m.completed)
}

/*
  What "continue" means for the course right now: the step the learner left, then
  the capstone, then the final assessment, then the completion page.
  → { line, to, state?, cta, at }
*/
export function courseNext({ progress, calibrate, last, capstone, final, order }) {
  const r = resumePoint(progress, calibrate, last, order)
  if (r) return { line: `Module ${r.module.n} · ${r.stage.label}`, to: `/player/${r.module.n}`, state: { step: r.stage.key }, cta: r.started ? 'Resume' : 'Start', at: r.at }
  const step = courseStep(progress, calibrate, capstone, final)
  if (step === 'capstone') return { line: 'The capstone project', to: '/capstone', cta: 'Continue', at: null }
  if (step === 'final') return { line: 'The final assessment', to: '/final', cta: 'Continue', at: null }
  return { line: 'Course complete — see what you built', to: '/complete', cta: 'Open', at: null }
}

export function fmtMinutes(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
