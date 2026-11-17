import { useState } from 'react'
import { motion } from 'motion/react'
import { Btn } from '../../ui/bits.jsx'
import { popIn } from '../../motion.js'

/*
  Standardized predict-then-reveal: commit to a guess, see whether it held and why,
  then continue. `children` (optional) is shown alongside the feedback;
  `onReveal` runs when the learner continues.
*/
export default function PredictReveal({ q, options, correct, explain, onReveal, cta = 'See it run →', children }) {
  const [choice, setChoice] = useState(null)
  const right = choice === correct
  return (
    <motion.div className="stack-v" {...popIn}>
      <div className="glass">
        <div className="kicker mb8" style={{ color: 'var(--warn-ink)' }}>Predict, then reveal</div>
        <p className="small mb14" style={{ fontWeight: 600, lineHeight: 1.6 }}>{q}</p>
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            disabled={choice !== null}
            className={`opt ${choice !== null && i === correct ? 'right' : ''} ${choice === i && !right ? 'wrong' : ''}`}
            onClick={() => setChoice(i)}
          >
            {o}
          </button>
        ))}
      </div>
      {choice !== null && (
        <motion.div className="stack-v" {...popIn} aria-live="polite">
          <div className="glass reveal-card">
            <p className="small" style={{ lineHeight: 1.6 }}>
              <b style={{ color: right ? 'var(--ok-ink)' : 'var(--err)' }}>{right ? 'That’s what happens — ' : 'Not quite — '}</b>
              {explain}
            </p>
          </div>
          {children}
          <div className="row between">
            <span className="tag-mono">prediction locked</span>
            <Btn variant="primary" onClick={onReveal}>{cta}</Btn>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
