import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe } from 'lucide-react'
import StageShell from './StageShell.jsx'
import { Btn } from '../ui/bits.jsx'
import { ListenButton } from '../canvas/NarrationPanel.jsx'
import { AUDIO } from '../content/audio.js'
import { useSignals } from '../stores/signals.js'
import { popIn } from '../motion.js'

/*
  Stage: per-sub-module scenario questions.
  Applied, situational — not definitions. Immediate explanation after each answer.
*/
export default function ScenarioQsStage({ content, sm, signalsKey, onNext, adapt, nextLabel }) {
  const qs = sm.scenarioQs
  const [i, setI] = useState(0)
  const [choice, setChoice] = useState(null)
  const bump = useSignals((s) => s.bump)
  const done = i >= qs.length
  const q = qs[i]

  const answer = (optIdx) => {
    if (choice !== null) return
    setChoice(optIdx)
    if (optIdx === q.correct) bump(signalsKey, 'scenarioCorrect')
    else bump(signalsKey, 'checkFails')
  }

  return (
    <StageShell kicker={`Sub-module ${sm.id} · Scenario questions`} title="Could you handle it in the wild?">
      {!done ? (
        <motion.div className="stack-v" key={i} {...popIn}>
          <div className="row between">
            <span className="chip info">scenario {i + 1} of {qs.length}</span>
            <div className="row">
              <ListenButton key={i} src={AUDIO.scenario(content, sm, i)} text={q.say || q.q} narration={adapt.narration} label="Hear the question" />
              <span className="tag-mono">{sm.title}</span>
            </div>
          </div>
          {adapt.world && i === 0 && (
            <div className="glass for-you">
              <div className="kicker mb8"><Globe size={12} /> In your world · {adapt.world.label}</div>
              <p className="small">{adapt.world.text} The scenarios below use Nebula’s version of the same situation.</p>
            </div>
          )}
          <div className="glass">
            <p className="small" style={{ fontWeight: 600, lineHeight: 1.6 }}>{q.q}</p>
            <div className="mt14">
              {q.options.map((o, oi) => {
                const cls = choice === null ? '' : oi === q.correct ? 'right' : choice === oi ? 'wrong' : ''
                return (
                  <button key={oi} type="button" className={`opt ${cls}`} onClick={() => answer(oi)}>{o}</button>
                )
              })}
            </div>
          </div>
          {choice !== null && (
            <motion.div className="glass reveal-card" {...popIn}>
              <p className="small" style={{ lineHeight: 1.6 }}>
                <b style={{ color: choice === q.correct ? 'var(--ok-ink)' : 'var(--err)' }}>
                  {choice === q.correct ? 'Exactly — ' : 'Not quite — '}
                </b>
                {q.explain}
              </p>
              <div className="row between mt14">
                <span />
                <Btn variant="primary" size="sm" onClick={() => { setChoice(null); setI(i + 1) }}>
                  {i + 1 < qs.length ? 'Next scenario →' : 'Done with these →'}
                </Btn>
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <motion.div className="stack-v" {...popIn}>
          <div className="glass reveal-card">
            <b>{sm.title} — handled.</b>
            <p className="muted small mt8" style={{ lineHeight: 1.6 }}>
              You’ve defended it in the wild. These concepts roll into this module’s guided practice
              and quiz.
            </p>
          </div>
          <div className="row between">
            <span />
            <Btn variant="primary" onClick={onNext}>Next: {nextLabel} →</Btn>
          </div>
        </motion.div>
      )}
    </StageShell>
  )
}
