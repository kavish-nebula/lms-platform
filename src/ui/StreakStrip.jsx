import { Flame } from 'lucide-react'
import { lastDays, useStreak } from '../stores/streak.js'
import { useMemo } from 'react'

/*
  The streak, kept honest and small: a flame, today's run, the best so far,
  and the last 14 days as dots. Missing a day never erases history — the
  counter simply restarts, and the dots keep the record.
*/
export default function StreakStrip() {
  const streak = useStreak((s) => s.streak)
  const best = useStreak((s) => s.best)
  const days = useMemo(() => lastDays(14), [streak])

  return (
    <div className="glass streak-strip" aria-label={`Current streak: ${streak} days`}>
      <span className={`streak-flame ${streak > 0 ? 'lit' : ''}`}>
        <Flame size={18} strokeWidth={2.2} />
      </span>
      <div className="streak-nums">
        <b>{streak}<span className="stat-unit"> day{streak === 1 ? '' : 's'}</span></b>
        <span className="stat-label">streak · best {best}</span>
      </div>
      <div className="streak-dots" aria-hidden="true">
        {days.map((d) => (
          <span
            key={d.key}
            className={`streak-dot ${d.kinds.length ? 'on' : ''} ${d.kinds.includes('challenge') ? 'star' : ''}`}
            title={`${d.date.toLocaleDateString()}${d.kinds.length ? ' · active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
