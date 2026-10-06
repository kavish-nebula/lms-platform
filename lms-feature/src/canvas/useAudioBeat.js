import { useEffect, useRef, useState } from 'react'

/*
  Audio-file narration: ONE mp3 per clip, played via a native Audio element.
  The audio is the only clock: while it plays, the canvas timeline (if any) is
  scrubbed to the same fraction, so voice and animation pause/skip together.

  Narration never starts by itself: the learner presses play. `autoStart` only marks
  when the clip's step is on screen — the clip is rewound and ready when it turns
  true, and paused when it turns false.
  Missing file → "silent mode": the same controls drive a plain timer of
  `fallbackMs` (or the timeline's own length), so a stage can never get stuck.

  Returns { exists, playing, ended, muted, progress, currentTime, duration, rate,
            play, pause, toggle, back, fwd, restart, toggleMute }
  `ended` is sticky: once a clip has been heard through, whatever it gates stays open.
*/
export function useAudioBeat({ src, tl, autoStart = false, rate = 1, muted: startMuted = false, fallbackMs = 0 }) {
  const audioRef = useRef(null)
  const tlRef = useRef(tl)
  tlRef.current = tl
  const silentMs = useRef(0)
  const [exists, setExists] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(startMuted)
  const [clock, setClock] = useState({ currentTime: 0, duration: 0 })

  const silentTotal = () => fallbackMs || tlRef.current?.total || 4000

  const finish = () => {
    setEnded(true)
    setPlaying(false)
    const t = tlRef.current
    if (t) t.scrub(t.total)
  }

  // (re)create the audio element when the source changes
  useEffect(() => {
    if (!src) return
    const a = new Audio(src)
    a.preload = 'auto'
    a.playbackRate = rate
    a.muted = muted
    audioRef.current = a
    silentMs.current = 0
    setExists(true)
    setEnded(false)
    setPlaying(false)
    setClock({ currentTime: 0, duration: 0 })
    const onErr = () => setExists(false)
    const onMeta = () => setClock((c) => ({ ...c, duration: a.duration || 0 }))
    a.addEventListener('error', onErr)
    a.addEventListener('ended', finish)
    a.addEventListener('loadedmetadata', onMeta)
    return () => {
      a.removeEventListener('error', onErr)
      a.removeEventListener('ended', finish)
      a.removeEventListener('loadedmetadata', onMeta)
      a.pause()
    }
  }, [src])

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = rate }, [rate])

  // let the canvas know a run is in progress (it starts the item-flow dots on that)
  useEffect(() => { tlRef.current?.drive(playing) }, [playing])

  // while playing: audio (or the silent timer) drives the clock and the timeline
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = 0
    const loop = (ts) => {
      const a = audioRef.current
      const dt = last ? ts - last : 0
      last = ts
      let f
      if (exists && a) {
        f = a.duration ? Math.min(1, a.currentTime / a.duration) : 0
        setClock({ currentTime: a.currentTime, duration: a.duration || 0 })
      } else {
        const total = silentTotal()
        silentMs.current = Math.min(total, silentMs.current + dt * rate)
        f = silentMs.current / total
        setClock({ currentTime: silentMs.current / 1000, duration: total / 1000 })
        if (f >= 1) { finish(); return }
      }
      const t = tlRef.current
      if (t) t.scrub(f * t.total)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, exists, rate])

  const play = () => {
    const a = audioRef.current
    setPlaying(true)
    // if the browser refuses playback, stay paused — the bar still works.
    // (a load error is different: keep "playing" so silent mode carries the animation)
    // (a rejection from an element that has since been replaced is ignored)
    if (exists && a) a.play().catch(() => { if (!a.error && audioRef.current === a) setPlaying(false) })
  }
  const pause = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }
  const jump = (seconds) => {
    const a = audioRef.current
    if (exists && a && a.duration) {
      a.currentTime = Math.max(0, Math.min(a.duration - 0.05, a.currentTime + seconds))
      setClock({ currentTime: a.currentTime, duration: a.duration })
      const t = tlRef.current
      if (t) t.scrub((a.currentTime / a.duration) * t.total)
    } else {
      silentMs.current = Math.max(0, Math.min(silentTotal(), silentMs.current + seconds * 1000))
    }
  }
  const restart = () => {
    const a = audioRef.current
    if (a) a.currentTime = 0
    silentMs.current = 0
    const t = tlRef.current
    if (t) t.scrub(0)
    play()
  }

  // rewound and ready when its step comes on screen, but only the learner starts it
  useEffect(() => {
    if (!src) return
    pause()
    if (autoStart && audioRef.current) audioRef.current.currentTime = 0
  }, [autoStart, src])

  return {
    exists, playing, ended, muted, rate,
    // `open`: whatever this clip gates may be shown. A learner who chose to read is never made to wait.
    open: ended || startMuted,
    skipToEnd: () => { audioRef.current?.pause(); finish() },
    currentTime: clock.currentTime,
    duration: clock.duration,
    progress: ended ? 1 : clock.duration ? Math.min(1, clock.currentTime / clock.duration) : 0,
    play, pause, restart,
    toggle: () => (playing ? pause() : play()),
    back: () => jump(-10),
    fwd: () => jump(10),
    toggleMute: () => setMuted((m) => { if (audioRef.current) audioRef.current.muted = !m; return !m }),
  }
}
