import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/*
  Spaced reviews = "workflow health checks".
  Scheduled on module completion (3 / 10 / 30 day ladder), surfaced on the Dashboard
  as "a workflow needs attention" — retrieval practice disguised as real maintenance.
*/
const DAY = 86400000

export const useReview = create(
  persist(
    (set, get) => ({
      items: [], // { id, moduleId, title, scenario, options, correct, explain, dueAt, done, doneAt, award }

      // scheduled once per module: passing the quiz again never resets checks already done
      scheduleFor: (moduleId, reviews) =>
        set((s) => {
          if (s.items.some((r) => r.moduleId === moduleId)) return s
          const existing = s.items
          const scheduled = reviews.map((r, i) => ({
            ...r,
            moduleId,
            id: `m${moduleId}-r${i + 1}`,
            dueAt: Date.now() + r.dueInDays * DAY,
            done: false,
            doneAt: null,
          }))
          return { items: [...existing, ...scheduled] }
        }),

      complete: (id) =>
        set((s) => ({
          items: s.items.map((r) => (r.id === id ? { ...r, done: true, doneAt: Date.now() } : r)),
        })),

      makeDue: (id) =>
        set((s) => ({
          items: s.items.map((r) => (r.id === id ? { ...r, dueAt: Date.now() - 1000 } : r)),
        })),

      dueItems: () => get().items.filter((r) => !r.done && r.dueAt <= Date.now()),
      allDoneCount: () => get().items.filter((r) => r.done).length,
      setItems: (items) => set({ items }), // demo controls
      resetReviews: () => set({ items: [] }),
    }),
    { name: 'pc-reviews' }
  )
)
