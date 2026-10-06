import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setSoundEnabled } from '../sound.js'

/*
  Interface preferences: dark mode and sound. Both persist and both are
  reversible in one click from the top bar — they are comfort settings,
  not learner-model data, so they live apart from the learner store.
*/
const applyTheme = (dark) => {
  const el = document.documentElement
  el.classList.toggle('dark', !!dark)
  el.style.colorScheme = dark ? 'dark' : 'light'
}

export const useUi = create(
  persist(
    (set, get) => ({
      dark: false,
      sound: true,

      setDark: (v) => {
        applyTheme(v)
        set({ dark: !!v })
      },
      toggleDark: () => get().setDark(!get().dark),
      setSound: (v) => {
        setSoundEnabled(v)
        set({ sound: !!v })
      },
      toggleSound: () => get().setSound(!get().sound),
    }),
    {
      name: 'pc-ui',
      onRehydrateStorage: () => (state) => {
        // applied on load too — the theme must survive a refresh
        if (state) {
          applyTheme(state.dark)
          setSoundEnabled(state.sound)
        }
      },
    }
  )
)
