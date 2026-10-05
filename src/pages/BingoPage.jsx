import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Repeat, Lock, Check, Undo2 } from 'lucide-react'
import { PageHeader, SectionTitle } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { useLearner } from '../stores/learner.js'
import { BINGO } from '../content/course.js'
import { stagger, staggerChild } from '../motion.js'

/*
  Edge-case bingo ("Field Notes") — the nasty list of real-world failures.
  Earned cards flip into flash drills: your collection becomes your spaced-review deck.
*/
export default function BingoPage({ embedded = false }) {
  const Head = embedded ? SectionTitle : PageHeader // as a tab on the course page it is a section, not a page
  const progress = useCourse((s) => s.progress)
  const reviews = useReview((s) => s.items)
  const { drillsDone, setDrillDone } = useLearner()
  const [flipped, setFlipped] = useState(null) // bingo id being drilled
  const [choice, setChoice] = useState(null)

  const ctx = useMemo(
    () => ({
      stage: (n, key) => !!progress[n]?.stages?.[key],
      reviewDone: (id) => !!reviews.find((r) => r.id === id)?.done,
      capstone: !!useCourse.getState().capstone,
    }),
    [progress, reviews]
  )

  const won = BINGO.filter((b) => b.check(ctx)).length

  const flip = (id) => { setFlipped(id); setChoice(null) }
  const answer = (b, i) => {
    if (choice !== null) return
    setChoice(i)
    if (i === b.drill.correct) setDrillDone(b.id)
  }

  return (
    <div>
      <Head
        kicker="Field notes"
        title="The nasty list"
        sub="Every card is a real-world failure you survived. Open a won card to flip it into a flash drill — your collection IS your revision deck."
        right={
          <div className="row">
            <span className="chip ok">{won}/{BINGO.length} survived</span>
            <span className="chip acc">{drillsDone.length} drilled</span>
          </div>
        }
      />
      <motion.div className="grid bingo-grid" {...stagger} initial="initial" animate="animate">
        {BINGO.map((b) => {
          const has = b.check(ctx)
          const drilled = drillsDone.includes(b.id)
          const isFlipped = flipped === b.id && has && b.drill
          return (
            <motion.div key={b.id} className={`bingo-cell ${has ? 'won' : 'locked'} ${isFlipped ? 'flipped' : ''}`} {...staggerChild}>
              {!isFlipped ? (
                <button type="button" className="bingo-face" disabled={!has || !b.drill} onClick={() => flip(b.id)}>
                  {has ? <span className="bingo-emoji">{b.emoji}</span> : <Lock size={20} />}
                  <b className="small">{has ? b.title : 'Not survived yet'}</b>
                  <span className="tag-mono">{b.how}</span>
                  {has && b.drill && (
                    <span className={`chip ${drilled ? 'ok' : 'acc'}`}>
                      {drilled ? <><Check size={11} /> drilled</> : <><Repeat size={11} /> drill me</>}
                    </span>
                  )}
                </button>
              ) : (
                <div className="bingo-back">
                  <p className="small" style={{ fontWeight: 600 }}>{b.drill.q}</p>
                  <div className="mt8">
                    {b.drill.options.map((o, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`opt ${choice !== null && i === b.drill.correct ? 'right' : ''} ${choice === i && choice !== b.drill.correct ? 'wrong' : ''}`}
                        style={{ padding: '7px 10px', fontSize: 14, marginBottom: 5 }}
                        onClick={() => answer(b, i)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  <div className="row between wrap mt8">
                    {choice === null ? <span /> : (
                      <span className={`chip ${choice === b.drill.correct ? 'ok' : 'warn'}`}>{choice === b.drill.correct ? 'in the deck' : 'not quite — try again'}</span>
                    )}
                    <button type="button" className="chip" onClick={() => (choice !== null && choice !== b.drill.correct ? setChoice(null) : flip(null))}>
                      <Undo2 size={11} /> {choice !== null && choice !== b.drill.correct ? 'retry' : 'flip back'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </motion.div>
      <GlassCard className="mt20">
        <p className="muted small">
          Why a list instead of badges? Because senior automation engineers genuinely carry this list in their heads.
          By the capstone, so will you — and your portfolio can say “survived: duplicate webhooks, renamed columns,
          rate-limit storms” instead of “completed course”.
        </p>
      </GlassCard>
    </div>
  )
}
