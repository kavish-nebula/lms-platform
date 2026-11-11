/* Centralized motion presets — the only place animation variants are defined. */
export const page = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: 'easeOut' },
}

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut' },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25 },
}

export const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
}

export const staggerChild = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

export const spring = { type: 'spring', stiffness: 320, damping: 26 }

export const nodePulse = (color) => ({
  boxShadow: [`0 0 0 0px ${color}55`, `0 0 0 12px ${color}00`],
  transition: { duration: 1.2, repeat: Infinity },
})

export const nodeError = {
  x: [0, -5, 5, -4, 4, 0],
  transition: { duration: 0.45 },
}

export const popIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: spring,
}

/* A path assembling piece by piece — each child sets its own delay. */
export const pathIn = { variants: { initial: {}, animate: {} } }
export const pathStep = { initial: { opacity: 0, y: 14, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 } }
