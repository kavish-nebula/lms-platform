import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLearner } from './learner.js'
import { isUnlocked } from '../engine/progress.js'

/*
  Progress per module: stage keys are
    'hook' | '<subId>-explain' | '<subId>-worked' | '<subId>-scenarios'
    | 'guided' | 'quiz'
  plus quiz results and completion. The course capstone and the final assessment
  sit after the last module and are recorded on their own.
*/
const blank = () => ({ stages: {}, completed: false, completedAt: null, quiz: null })

export const useCourse = create(
  persist(
    (set, get) => ({
      progress: {},
      last: null, // the step the learner last had open: { moduleN, key, at } — where the dashboard resumes
      capstone: null, // course capstone, once its build is accepted and saved: { at }
      final: null, // final assessment: { best, passed, attempts, last: { score, total, passed }, passedAt }

      mod: (id) => get().progress[id] || blank(),
      stages: (id) => get().progress[id]?.stages || {},

      markStage: (moduleId, stage) =>
        set((s) => {
          const m = { ...blank(), ...(s.progress[moduleId] || {}) }
          // first-completion time, so the Learning Plan can show the day it was done
          m.stages = { ...m.stages, [stage]: m.stages[stage] || Date.now() }
          return { progress: { ...s.progress, [moduleId]: m } }
        }),

      recordQuiz: (moduleId, result) =>
        set((s) => {
          const m = { ...blank(), ...(s.progress[moduleId] || {}) }
          const prev = m.quiz
          m.quiz = {
            best: Math.max(prev?.best || 0, result.score),
            passed: (prev?.passed || result.passed),
            attempts: (prev?.attempts || 0) + 1,
            last: result,
          }
          return { progress: { ...s.progress, [moduleId]: m } }
        }),

      recordFinal: (result) =>
        set((s) => ({
          final: {
            best: Math.max(s.final?.best || 0, result.score),
            passed: s.final?.passed || result.passed,
            passedAt: s.final?.passedAt || (result.passed ? Date.now() : null),
            attempts: (s.final?.attempts || 0) + 1,
            last: result,
          },
        })),

      setLast: (moduleN, key) => {
        const l = get().last
        if (l?.moduleN !== moduleN || l?.key !== key) set({ last: { moduleN, key, at: Date.now() } })
      },

      recordCapstone: () => set((s) => ({ capstone: s.capstone || { at: Date.now() } })),

      completeModule: (moduleId) =>
        set((s) => {
          const m = { ...blank(), ...(s.progress[moduleId] || {}) }
          m.completed = true
          m.completedAt = m.completedAt || Date.now() // completing twice keeps the first date
          return { progress: { ...s.progress, [moduleId]: m } }
        }),

      highestCompleted: () => {
        const ids = Object.entries(get().progress)
          .filter(([, v]) => v.completed)
          .map(([k]) => Number(k))
        return ids.length ? Math.max(...ids) : 0
      },

      /* Sequential unlocking, with a demo-mode override for built modules. */
      isUnlocked: (moduleId, moduleMeta) => isUnlocked(moduleMeta, get().progress, useLearner.getState()),

      setProgress: (progress, final = null, capstone = null) => set({ progress, final, capstone, last: null }), // demo controls
      resetProgress: () => set({ progress: {}, final: null, capstone: null, last: null }),
    }),
    { name: 'pc-course' }
  )
)
