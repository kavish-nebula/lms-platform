import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/*
  Interaction telemetry that feeds the adaptivity engine (engine/adaptive.js).
  Keyed by step key like "m1.explainer" or "m1.practice".
  Never shown as a score to the learner — only used to quietly adapt.
*/
const DEFAULTS = { replays: 0, hintDepth: 0, checkFails: 0, wrongDrops: 0, cleanSolves: 0, pinGuess: null, hunch: null }

export const useSignals = create(
  persist(
    (set, get) => ({
      byStep: {},

      sig: (key) => get().byStep[key] || DEFAULTS,

      bump: (key, field, amt = 1) =>
        set((s) => {
          const cur = { ...DEFAULTS, ...(s.byStep[key] || {}) }
          cur[field] = (cur[field] || 0) + amt
          return { byStep: { ...s.byStep, [key]: cur } }
        }),

      setField: (key, patch) =>
        set((s) => {
          const cur = { ...DEFAULTS, ...(s.byStep[key] || {}) }
          return { byStep: { ...s.byStep, [key]: { ...cur, ...patch } } }
        }),

      resetSignals: () => set({ byStep: {} }),
    }),
    { name: 'pc-signals' }
  )
)
