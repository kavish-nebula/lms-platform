import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* Portfolio of real artifacts: exported workflows + linter reports + reviews. Proof, not badges. */
export const usePortfolio = create(
  persist(
    (set, get) => ({
      artifacts: [],

      // one artifact per source (the course capstone): saving it again replaces the earlier version
      add: (a) =>
        set((s) => ({
          artifacts: [{ id: `art-${Date.now()}`, createdAt: Date.now(), ...a }, ...s.artifacts.filter((x) => x.moduleId !== a.moduleId)],
        })),
      setArtifacts: (artifacts) => set({ artifacts }), // demo controls

      hoursSaved: () => get().artifacts.reduce((sum, a) => sum + (a.hrsSaved || 0), 0),

      resetPortfolio: () => set({ artifacts: [] }),
    }),
    { name: 'pc-portfolio' }
  )
)

/* Hand the learner their workflow as a .json file. */
export function downloadArtifact(a) {
  const blob = new Blob([JSON.stringify(a.workflowJson, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${a.title.replace(/[^\w-]+/g, '-').toLowerCase()}.json`
  link.click()
  URL.revokeObjectURL(url)
}
