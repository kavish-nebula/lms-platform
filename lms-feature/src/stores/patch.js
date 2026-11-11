import { create } from 'zustand'

/*
  Patch's message queue and chat. Components push lines; the dock shows them one
  at a time. A stage can also hand the chat help for the step on screen
  (`help`: { title, prompts: [{ q, a }], fallback }) and open it.
*/
export const usePatch = create((set, get) => ({
  queue: [],
  current: null,
  chatOpen: false,
  help: null,
  push: (text, tone = 'neutral') =>
    set((s) => ({ queue: [...s.queue, { text, tone, id: Date.now() + Math.random() }] })),
  dismiss: () => set((s) => ({ current: null, queue: s.queue })),
  next: () =>
    set((s) => {
      if (!s.queue.length) return { current: null }
      const [head, ...rest] = s.queue
      return { current: head, queue: rest }
    }),
  clear: () => set({ queue: [], current: null }),
  setChat: (chatOpen) => set({ chatOpen, current: null }),
  setHelp: (help) => set({ help }),
}))
