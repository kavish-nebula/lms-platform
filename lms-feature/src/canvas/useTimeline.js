import { useEffect, useMemo, useRef, useState } from 'react'

/*
  Fold: deterministically derive canvas state at time `elapsed` from the script.
  Actions:
    { t, do:'addNode', node } · { t, do:'addEdge', edge } · { t, do:'setNode', id, state }
    { t, do:'setEdge', id, state } · { t, do:'caption', text } · { t, do:'note', text }
*/
export function foldTimeline(script, elapsed) {
  const s = { nodeState: {}, edgeState: {}, extraNodes: [], extraEdges: [], caption: null, notes: [] }
  for (const a of script) {
    if (a.t > elapsed) break
    switch (a.do) {
      case 'addNode': s.extraNodes.push(a.node); s.nodeState[a.node.id] = a.state || 'idle'; break
      case 'addEdge': s.extraEdges.push(a.edge); break
      case 'setNode': s.nodeState[a.id] = a.state; break
      case 'setEdge': s.edgeState[a.id] = a.state; break
      case 'caption': s.caption = a.text; break
      case 'note': s.notes.push(a.text); break
      default: break
    }
  }
  return s
}

export function useTimeline(script, { autoplay = false, speed = 1 } = {}) {
  const sorted = useMemo(() => [...script].sort((a, b) => a.t - b.t), [script])
  const total = useMemo(() => (sorted.length ? sorted[sorted.length - 1].t + 700 : 0), [sorted])

  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const [driven, setDriven] = useState(false) // an outside clock (narration audio) is moving this timeline
  const [spd, setSpd] = useState(speed)
  const raf = useRef(0)
  const last = useRef(0)

  useEffect(() => {
    if (!playing) return
    last.current = 0
    const tick = (ts) => {
      if (!last.current) last.current = ts
      const dt = (ts - last.current) * spd
      last.current = ts
      setElapsed((e) => {
        const n = Math.min(e + dt, total)
        if (n >= total) setPlaying(false)
        return n
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, spd, total])

  // the canvas state only changes when a script action is crossed — keep the same object in between,
  // so the canvas is not handed new nodes on every animation frame
  const applied = sorted.filter((a) => a.t <= elapsed).length
  const fold = useMemo(() => foldTimeline(sorted, elapsed), [sorted, applied])

  return {
    elapsed, total, playing: playing || driven, speed: spd, setSpeed: setSpd,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying((p) => !p),
    restart: () => { setElapsed(0); setPlaying(true) },
    seek: (t) => { setElapsed(Math.max(0, Math.min(t, total))); if (t < total) setPlaying(true) },
    // move without starting this timeline's own clock — for when narration audio is the driver
    scrub: (t) => setElapsed(Math.max(0, Math.min(t, total))),
    drive: setDriven,
    fold,
    done: total > 0 && elapsed >= total,
  }
}
