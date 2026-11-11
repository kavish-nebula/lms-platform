import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { blankProfile } from '../content/profile.js'
import { adaptation } from '../engine/adaptive.js'

/* Profile answers, the pre-assessment result, reference book, demo access. */
const fresh = () => ({
  profile: null, // see content/profile.js — values, not display text
  precheck: null, // one pre-assessment before the course: { at, skipped?, isNew?, lessons: { [subId]: items right, 0–2 } }
  calibrate: null, // reserved: { startModule, skipped, at } to begin further in
  referenceBook: [],
  drillsDone: [], // bingo card ids flipped into flash drills
  demoMode: true, // demo: everything (built) accessible; toggle in Profile restores real locking
})

export const useLearner = create(
  persist(
    (set) => ({
      ...fresh(),

      saveProfile: (answers) => set({ profile: { ...blankProfile(), ...answers, at: Date.now() } }),
      updateProfile: (patch) => set((s) => ({ profile: { ...blankProfile(), ...s.profile, ...patch, at: Date.now() } })),
      savePrecheck: (result) => set({ precheck: { ...result, at: Date.now() } }),
      clearPrecheck: () => set({ precheck: null }),
      setCalibrate: (cal) => set({ calibrate: cal }),
      setDemoMode: (v) => set({ demoMode: v }),
      setDrillDone: (id) => set((s) => (s.drillsDone.includes(id) ? s : { drillsDone: [...s.drillsDone, id] })),
      addTeachback: (tb) =>
        set((s) => ({
          referenceBook: [{ id: `tb-${Date.now()}`, createdAt: Date.now(), ...tb }, ...s.referenceBook.filter((t) => t.moduleId !== tb.moduleId)],
        })),
      seed: (patch) => set(patch), // demo controls
      resetAll: () => set(fresh()),
    }),
    {
      name: 'pc-learner',
      version: 3,
      // Older saves kept the name in other places (v0: contextPack, v2: a sign-in account) and one
      // pre-check per module. The name and the answers carry over; pre-check results are merged into one.
      migrate: (state, version) => {
        if (!state || version >= 3) return state
        const { contextPack, account, name: oldName, ...rest } = state
        const answers = version >= 1 ? rest.profile : null
        const old = rest.precheck && typeof rest.precheck === 'object' ? Object.values(rest.precheck).filter((r) => r && !r.skipped) : []
        return {
          ...rest,
          profile: answers ? { ...blankProfile(), ...answers } : null, // the name now comes from the account, not the profile
          precheck: old.length ? { at: Date.now(), isNew: old.every((r) => r.isNew), lessons: Object.assign({}, ...old.map((r) => r.lessons || {})) } : null,
        }
      },
    }
  )
)

/* The course-wide settings derived from the learner's profile and pre-check results. */
export function useAdaptation() {
  const profile = useLearner((s) => s.profile)
  const precheck = useLearner((s) => s.precheck)
  return useMemo(() => adaptation(profile, precheck), [profile, precheck])
}
