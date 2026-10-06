import { useEffect, useRef, useState } from 'react'

/*
  Celebration toolkit: a self-installing canvas confetti burst and a CountUp
  number. Both respect reduced motion (the app-level class or the OS setting).
*/

function motionReduced() {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('.app.reduce-motion')
  } catch {
    return false
  }
}

/* Brand palette of the Frosted Aura system. */
const COLORS = ['#5c7e8f', '#3e5a68', '#d98e2b', '#2f8f6b', '#7b98a8', '#e6b15c']

export function burstConfetti({ count = 110, origin = { x: 0.5, y: 0.32 } } = {}) {
  if (motionReduced()) return
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti-canvas'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const parts = Array.from({ length: count }, () => ({
    x: origin.x * canvas.width + (Math.random() - 0.5) * 90,
    y: origin.y * canvas.height,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 11 - 4,
    w: 5 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    round: Math.random() < 0.3,
  }))
  let frames = 0
  let raf
  const tick = () => {
    frames++
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = 0
    for (const p of parts) {
      p.vy += 0.28
      p.vx *= 0.992
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      if (p.y < canvas.height + 40) alive++
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.max(0, 1 - frames / 135)
      ctx.fillStyle = p.color
      if (p.round) {
        ctx.beginPath()
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.sin(p.rot * 2)) + 2)
      }
      ctx.restore()
    }
    if (alive > 0 && frames < 145) raf = requestAnimationFrame(tick)
    else canvas.remove()
  }
  tick()
}

/* A number that counts up to its value when it changes. */
export function CountUp({ value, duration = 900, decimals = 0, prefix = '', suffix = '', className = '' }) {
  const [display, setDisplay] = useState(motionReduced() ? value : 0)
  const fromRef = useRef(motionReduced() ? value : 0)
  useEffect(() => {
    if (motionReduced()) {
      fromRef.current = value
      setDisplay(value)
      return
    }
    const from = fromRef.current
    const t0 = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return (
    <span className={className}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}
