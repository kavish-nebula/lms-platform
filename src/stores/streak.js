import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/*
  Daily engagement loop. One record per active day; the streak is the run of
  consecutive active days ending today (or yesterday — it isn't broken until a
  full day passes with nothing done). Deliberately forgiving: this is
  encouragement, not pressure — no penalties, only a best to beat.
  Kinds: 'study' (finished a step/quiz), 'drill' (handled a health check),
  'challenge' (did the dashboard's daily challenge).
*/

export const dayKey = (t = Date.now()) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const daysBetween = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

const rollStreak = (s) => {
  const today = dayKey()
  if (s.lastDay === today) return {}
  const gap = s.lastDay ? daysBetween(s.lastDay, today) : Infinity
  const streak = gap === 1 ? s.streak + 1 : 1
  return { streak, best: Math.max(s.best, streak), lastDay: today }
}

export const useStreak = create(
  persist(
    (set) => ({
      days: {}, // { '2026-10-05': ['study', 'challenge'] }
      lastDay: null,
      streak: 0,
      best: 0,
      challengesDone: {}, // { [dayKey]: true } — the dashboard's daily challenge

      /* Record an activity today and roll the streak forward. */
      touch: (kind = 'study') =>
        set((s) => {
          const today = dayKey()
          const day = [...new Set([...(s.days[today] || []), kind])]
          return { days: { ...s.days, [today]: day }, ...rollStreak(s) }
        }),

      completeChallenge: () =>
        set((s) => {
          const today = dayKey()
          if (s.challengesDone[today]) return s
          const day = [...new Set([...(s.days[today] || []), 'challenge'])]
          return { challengesDone: { ...s.challengesDone, [today]: true }, days: { ...s.days, [today]: day }, ...rollStreak(s) }
        }),

      resetStreak: () => set({ days: {}, lastDay: null, streak: 0, best: 0, challengesDone: {} }),
    }),
    { name: 'pc-streak' }
  )
)

/* The last n days as [{ key, date, kinds }] for strips and heatmaps. */
export function lastDays(n = 14) {
  const { days } = useStreak.getState()
  const out = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const key = dayKey(d.getTime())
    out.push({ key, date: d, kinds: days[key] || [] })
  }
  return out
}
