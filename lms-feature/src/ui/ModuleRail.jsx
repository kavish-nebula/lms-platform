import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/*
  A Coursera-style strip: module cards in a horizontal rail that moves with the
  arrow buttons (and by scrolling, and with a swipe on touch). The arrows fade
  out at the ends, and the cards stop aligned (scroll snapping).
*/
export default function ModuleRail({ label = 'Course modules', children }) {
  const trackRef = useRef(null)
  const [ends, setEnds] = useState({ start: true, end: false })

  const update = () => {
    const el = trackRef.current
    if (!el) return
    setEnds({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    })
  }

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [children])

  /* one card-width per click; smoothness comes from CSS, so reduced motion is honoured */
  const nudge = (dir) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('.rail-card')
    el.scrollBy({ left: dir * ((card?.offsetWidth || 300) + 14) })
  }

  return (
    <div className="rail" role="group" aria-label={label}>
      <button type="button" className="rail-arrow left" onClick={() => nudge(-1)} disabled={ends.start} aria-label="Show earlier modules">
        <ChevronLeft size={19} />
      </button>
      <div className="rail-track" ref={trackRef} onScroll={update}>
        {children}
      </div>
      <button type="button" className="rail-arrow right" onClick={() => nudge(1)} disabled={ends.end} aria-label="Show later modules">
        <ChevronRight size={19} />
      </button>
    </div>
  )
}
