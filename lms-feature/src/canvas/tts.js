/*
  TTS service — one place that owns Chrome's speechSynthesis quirks:
  - voices load ASYNC: speak() before they arrive silently fails. We prime at app start,
    wait for `voiceschanged`, and attach a real voice to every utterance.
  - availability flag: browsers launched with no TTS engines (automation builds) expose
    speechSynthesis but have zero voices. We detect that and let the UI fall back to subtitles.
*/

let voices = []
let primed = false
let available = true // assume yes until proven otherwise
const listeners = new Set()

function notify() { listeners.forEach((f) => f(available)) }

export function primeVoices() {
  if (primed || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  primed = true
  const load = () => {
    voices = window.speechSynthesis.getVoices() || []
    if (voices.length > 0 && !available) { available = true; notify() }
  }
  load()
  window.speechSynthesis.onvoiceschanged = load
  // automation builds never populate voices — decide within 2s
  setTimeout(() => {
    voices = window.speechSynthesis.getVoices() || []
    if (voices.length === 0) { available = false; notify() }
  }, 2000)
}

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/* Subscribe to availability. Returns unsubscribe. Initial value delivered async. */
export function onAvailability(f) {
  listeners.add(f)
  return () => listeners.delete(f)
}

function pickVoice() {
  if (!voices.length) return null
  return voices.find((v) => /en[-_]/i.test(v.lang)) || voices[0]
}

export function speakText(text, { rate = 1.04, onend, onerror } = {}) {
  if (!ttsSupported()) return null
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = rate
  const v = pickVoice()
  if (v) u.voice = v
  if (onend) u.onend = onend
  if (onerror) u.onerror = onerror
  window.speechSynthesis.speak(u)
  return u
}

export function stopSpeech() { if (ttsSupported()) window.speechSynthesis.cancel() }
export function pauseSpeech() { if (ttsSupported()) window.speechSynthesis.pause() }
export function resumeSpeech() { if (ttsSupported()) window.speechSynthesis.resume() }
