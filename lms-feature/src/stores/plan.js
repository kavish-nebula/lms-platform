import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCourse } from './course.js'
import { useReview } from './review.js'
import { useLearner, useAdaptation } from './learner.js'
import { dayItems, remainingUnits, sessionId } from '../engine/plan.js'

/*
  Learning Plan: the sessions the learner has put on days, plus the two
  preferences "Plan it for me" uses. What each day shows is derived from these
  and from progress (engine/plan.js).
*/
const defaults = () => ({
  sessions: [], // { id, date: 'YYYY-MM-DD', moduleN, unit }
  studyDays: [1, 3, 5], // Date.getDay() indices — Mon, Wed, Fri
  sessionMinutes: 30,
})

export const usePlan = create(
  persist(
    (set) => ({
      ...defaults(),

      addSession: (date, moduleN, unit) =>
        set((s) => {
          const id = sessionId(date, moduleN, unit)
          return s.sessions.some((x) => x.id === id) ? s : { sessions: [...s.sessions, { id, date, moduleN, unit }] }
        }),
      removeSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
      setSessions: (sessions) => set({ sessions }),

      toggleDay: (d) =>
        set((s) => ({
          studyDays: s.studyDays.includes(d) ? s.studyDays.filter((x) => x !== d) : [...s.studyDays, d].sort(),
        })),
      setSessionMinutes: (m) => set({ sessionMinutes: m }),
      resetPlan: () => set(defaults()),
    }),
    { name: 'pc-plan' }
  )
)

/* Everything the Plan page and the Dashboard teaser need, derived in one place. */
export function usePlanData() {
  const progress = useCourse((s) => s.progress)
  const reviews = useReview((s) => s.items)
  const calibrate = useLearner((s) => s.calibrate)
  const sessions = usePlan((s) => s.sessions)
  const studyDays = usePlan((s) => s.studyDays)
  const sessionMinutes = usePlan((s) => s.sessionMinutes)
  const { paceFactor } = useAdaptation()
  return useMemo(() => ({
    sessions,
    progress,
    calibrate,
    paceFactor,
    prefs: { studyDays, sessionMinutes },
    remaining: remainingUnits({ progress, calibrate, paceFactor }),
    days: dayItems({ sessions, progress, reviews, calibrate, paceFactor }),
  }), [progress, reviews, calibrate, sessions, studyDays, sessionMinutes, paceFactor])
}
