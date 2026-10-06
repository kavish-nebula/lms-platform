import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles, Trophy } from 'lucide-react'
import GlassCard from './GlassCard.jsx'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { useStreak, dayKey } from '../stores/streak.js'
import { BINGO } from '../content/course.js'
import { burstConfetti } from './celebrate.jsx'
import { play } from '../sound.js'
import { popIn } from '../motion.js'

/*
  The daily challenge: one small drill, chosen by the date, from field notes
  the learner has already earned. Doing it counts toward today's streak —
  a two-minute reason to open the dashboard.
*/
export default function DailyChallenge() {
  const today = dayKey()
  const done = useStreak((s) => !!s.challengesDone[today])
  const streak = useStreak((s) => s.streak)
  const completeChallenge = useStreak((s) => s.completeChallenge)
  const progress = useCourse((s) => s.progress)
  const reviews = useReview((s) => s.items)
  const [choice, setChoice] = useState(null)

  /* one earned card per day, chosen by the date — everyone gets the same drill on the same day */
  const card = useMemo(() => {
    const ctx = {
      stage: (n, key) => !!progress[n]?.stages?.[key],
      reviewDone: (id) => !!reviews.find((r) => r.id === id)?.done,
      capstone: !!useCourse.getState().capstone,
    }
    const earned = BINGO.filter((b) => b.check(ctx) && b.drill)
    if (!earned.length) return null
    const dayIndex = Math.floor(Date.now() / 86400000)
    return earned[dayIndex % earned.length]
  }, [progress, reviews])

  const correct = choice === card?.drill.correct

  const answer = (i) => {
    if (choice !== null || done) return
    setChoice(i)
    if (i === card.drill.correct) {
      completeChallenge()
      play('streak')
      burstConfetti({ count: 45, origin: { x: 0.72, y: 0.6 } })
    } else {
      play('wrong')
    }
  }

  return (
    <GlassCard className={done ? 'daily-card done' : 'daily-card'}>
      <div className="row between mb8">
        <div className="kicker"><Sparkles size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Daily challenge</div>
        {done && <span className="chip ok"><Check size={11} /> done today</span>}
      </div>

      {done ? (
        <motion.div {...popIn}>
          <p className="small" style={{ fontWeight: 600 }}>That's the streak kept alive — {streak} day{streak === 1 ? '' : 's'} running.</p>
          <p className="muted small mt8">Come back tomorrow for the next drill. Lessons and health checks keep it going too.</p>
        </motion.div>
      ) : !card ? (
        <p className="muted small">
          Your first challenge unlocks once you've earned a field note. Finish Module 1 — the hook alone earns one.
        </p>
      ) : (
        <>
          <p className="small" style={{ fontWeight: 600 }}>
            {card.emoji} {card.drill.q}
          </p>
          <div className="mt8">
            {card.drill.options.map((o, i) => (
              <button
                key={i}
                className={`opt ${choice !== null && i === card.drill.correct ? 'right' : ''} ${choice === i && !correct ? 'wrong' : ''}`}
                onClick={() => answer(i)}
              >
                {o}
              </button>
            ))}
          </div>
          {choice !== null && (
            <motion.div {...popIn}>
              <p className={`small mt8 ${correct ? 'challenge-right' : ''}`}>
                {correct
                  ? <>Right — <b>today's streak is banked</b>. It counts even on a day with no lesson.</>
                  : 'Not that one — try another. Nothing is lost.'}
              </p>
            </motion.div>
          )}
        </>
      )}
      <p className="tag-mono mt14"><Trophy size={11} style={{ verticalAlign: -2, marginRight: 4 }} />one drill a day keeps the skill sharp</p>
    </GlassCard>
  )
}
