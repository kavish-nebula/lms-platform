/*
  Micro sound design — synthesized with the Web Audio API, no asset files.
  Subtle by design: short, quiet, low-passed. Every sound is feedback for an
  action the learner just took, never background music.
  Enabled flag lives in stores/ui.js and is mirrored here to avoid import cycles.
*/

let enabled = true
let ctx = null

export function setSoundEnabled(v) {
  enabled = !!v
}

function audio() {
  if (!enabled) return null
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/* One enveloped oscillator blip. */
function tone({ freq = 660, to = null, type = 'sine', dur = 0.12, vol = 0.06, delay = 0, filter = 2400 }) {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = filter
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(lp).connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

const SOUNDS = {
  /* UI ticks */
  click: () => tone({ freq: 520, to: 460, type: 'triangle', dur: 0.05, vol: 0.03 }),
  pop: () => tone({ freq: 420, to: 720, type: 'sine', dur: 0.09, vol: 0.045 }),

  /* answer feedback */
  correct: () => {
    tone({ freq: 620, type: 'sine', dur: 0.1, vol: 0.05 })
    tone({ freq: 930, type: 'sine', dur: 0.16, vol: 0.05, delay: 0.09 })
  },
  wrong: () => tone({ freq: 240, to: 190, type: 'triangle', dur: 0.16, vol: 0.05, filter: 900 }),

  /* streak / challenge */
  streak: () => {
    tone({ freq: 660, type: 'sine', dur: 0.09, vol: 0.045 })
    tone({ freq: 880, type: 'sine', dur: 0.14, vol: 0.045, delay: 0.08 })
  },

  /* the big one — a module ships / course completes */
  ship: () => {
    ;[523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.22, vol: 0.055, delay: i * 0.11 }))
    tone({ freq: 1568, type: 'sine', dur: 0.4, vol: 0.03, delay: 0.46 })
  },

  /* sandbox */
  whoosh: () => tone({ freq: 300, to: 900, type: 'sawtooth', dur: 0.25, vol: 0.022, filter: 1200 }),
  drill: () => tone({ freq: 180, to: 120, type: 'square', dur: 0.2, vol: 0.03, filter: 600 }),
}

export function play(name) {
  const fn = SOUNDS[name]
  if (fn) try { fn() } catch { /* audio is never allowed to break a lesson */ }
}
