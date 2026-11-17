import { MODULES, STAGE_MINUTES } from '../content/course.js'
import { startModule, unitList, unitDone } from './progress.js'

/*
  Learning Plan — pure helpers, no React, no stores.
  The learner plans sessions onto days themself (stores/plan.js keeps them);
  this file works out what is left, what each day holds, and — on request —
  a suggested layout for everything that is not planned yet.
  Nothing is ever "missed": a planned session that was not done just stays put.
*/
const HORIZON_DAYS = 365

export function startOfDay(t) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function dayKey(t) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/* Weeks of a month, Monday first; cells outside the month are null. */
export function monthGrid(year, month) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

export const sessionId = (date, moduleN, unit) => `${date}:${moduleN}:${unit}`

/*
  Units still to do, in course order: built modules only, from the calibrated
  start (plus any earlier module already begun). The first one is "next up".
*/
export function remainingUnits({ modules = MODULES, progress = {}, calibrate = null, paceFactor = 1 }) {
  const from = startModule(calibrate)
  const out = []
  for (const m of modules) {
    if (!m.built || progress[m.n]?.completed) continue
    const started = Object.keys(progress[m.n]?.stages || {}).length > 0
    if (m.n < from && !started) continue
    for (const u of unitList(m, paceFactor)) {
      if (!unitDone(progress[m.n], u)) out.push({ ...u, id: `${m.n}:${u.unit}`, moduleN: m.n })
    }
  }
  return out
}

/*
  Everything that sits on a calendar day: sessions the learner planned, health
  checks on their due date (overdue ones wait on today), and work already done.
  → { [dayKey]: [{ id, type: 'session' | 'review' | 'done', moduleN, label, minutes, done, sessionId?, to? }] }
*/
export function dayItems({ modules = MODULES, sessions = [], progress = {}, reviews = [], calibrate = null, paceFactor = 1, now = Date.now() }) {
  const todayKey = dayKey(now)
  const days = {}
  const put = (key, item) => (days[key] ||= []).push(item)
  const next = remainingUnits({ modules, progress, calibrate, paceFactor })[0]
  const units = new Map()
  for (const m of modules) for (const u of unitList(m, paceFactor)) units.set(`${m.n}:${u.unit}`, { ...u, moduleN: m.n })

  for (const s of sessions) {
    const u = units.get(`${s.moduleN}:${s.unit}`)
    if (!u) continue
    put(s.date, {
      id: s.id, sessionId: s.id, type: 'session', moduleN: s.moduleN, label: u.label, minutes: u.minutes,
      done: unitDone(progress[s.moduleN], u),
      // the player always opens at the first unfinished step, so only the next-up unit can be started from here
      to: next && next.id === `${s.moduleN}:${s.unit}` ? `/player/${s.moduleN}` : null,
    })
  }

  // Work already done, on the day it was done — unless that day's planned session already shows it.
  for (const m of modules) {
    for (const u of unitList(m, paceFactor)) {
      const stamped = {}
      for (const k of u.stageKeys) {
        const at = progress[m.n]?.stages?.[k]
        if (typeof at === 'number') stamped[dayKey(at)] = (stamped[dayKey(at)] || 0) + 1
      }
      for (const [key, count] of Object.entries(stamped)) {
        if (days[key]?.some((it) => it.type === 'session' && it.moduleN === m.n && it.label === u.label)) continue
        put(key, {
          id: `done:${m.n}:${u.unit}:${key}`, type: 'done', moduleN: m.n, label: u.label, done: true,
          minutes: Math.round((u.minutes * count) / u.stageKeys.length),
          // a lesson has three steps; say so when only some were done that day
          note: count < u.stageKeys.length ? `${count} of ${u.stageKeys.length} steps done` : 'done',
        })
      }
    }
  }

  for (const r of reviews) {
    if (r.done) {
      if (r.doneAt) put(dayKey(r.doneAt), { id: r.id, type: 'review', moduleN: r.moduleId, label: r.title, minutes: STAGE_MINUTES.review, done: true })
      continue
    }
    const due = r.dueAt <= now
    put(due ? todayKey : dayKey(r.dueAt), { id: r.id, type: 'review', moduleN: r.moduleId, label: r.title, minutes: STAGE_MINUTES.review, done: false, to: due ? '/dashboard' : null })
  }
  return days
}

/*
  "Plan it for me": sessions for every remaining unit that has no session yet,
  laid onto the learner's study days from today, each day filled to about the
  session length. A unit longer than the session still gets a day of its own.
*/
export function autoFill({ modules = MODULES, progress = {}, calibrate = null, prefs, paceFactor = 1, sessions = [], now = Date.now() }) {
  if (!prefs.studyDays.length) return []
  const planned = new Set(sessions.map((s) => `${s.moduleN}:${s.unit}`))
  const queue = remainingUnits({ modules, progress, calibrate, paceFactor }).filter((u) => !planned.has(u.id))
  const minutesOf = new Map(remainingUnits({ modules, progress, calibrate, paceFactor }).map((u) => [u.id, u.minutes]))
  const used = {}
  for (const s of sessions) used[s.date] = (used[s.date] || 0) + (minutesOf.get(`${s.moduleN}:${s.unit}`) || 0)

  const out = []
  const today = startOfDay(now)
  let i = 0
  for (let n = 0; n < HORIZON_DAYS && i < queue.length; n++) {
    const date = addDays(today, n)
    if (!prefs.studyDays.includes(date.getDay())) continue
    const key = dayKey(date)
    let total = used[key] || 0
    let placed = 0
    while (i < queue.length) {
      const u = queue[i]
      if (!(total + u.minutes <= prefs.sessionMinutes || (total === 0 && placed === 0))) break
      out.push({ id: sessionId(key, u.moduleN, u.unit), date: key, moduleN: u.moduleN, unit: u.unit })
      total += u.minutes
      placed++
      i++
    }
  }
  return out
}
