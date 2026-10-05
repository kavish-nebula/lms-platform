import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Undo2, Trash2 } from 'lucide-react'
import StageShell from './StageShell.jsx'
import N8nCanvas from '../canvas/N8nCanvas.jsx'
import { useTimeline } from '../canvas/useTimeline.js'
import NarrationPanel, { useStageAudio } from '../canvas/NarrationPanel.jsx'
import { AUDIO } from '../content/audio.js'
import PredictReveal from './common/PredictReveal.jsx'
import { Btn } from '../ui/bits.jsx'
import { useSignals } from '../stores/signals.js'
import { popIn } from '../motion.js'

function BrokenSim({ broken, onRestore }) {
  const tl = useTimeline(broken.brokenScript, { autoplay: true })
  return (
    <motion.div {...popIn}>
      <N8nCanvas baseNodes={[]} baseEdges={[]} tl={tl} mode="sim" height={300} />
      <div className="row between mt8">
        {tl.done && <Btn size="sm" variant="ok" onClick={onRestore}><Undo2 size={13} /> {broken.restore || 'Put it back'}</Btn>}
      </div>
      <AnimatePresence>
        {tl.done && broken.moral && (
          <motion.div className="glass mt14 reveal-card" {...popIn}>
            <p className="small" style={{ lineHeight: 1.6 }}>{broken.moral}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* Stage: per-sub-module worked example — predict → narrated build-along. */
export default function WorkedExampleStage({ content, sm, signalsKey, onNext, adapt, nextLabel }) {
  const w = sm.worked
  const [phase, setPhase] = useState('predict') // predict | run
  const tl = useTimeline(w.script, { autoplay: false })
  const flowNodes = useMemo(() => w.script.filter((a) => a.do === 'addNode').map((a) => a.node), [w])
  const [brokenOpen, setBrokenOpen] = useState(false)
  const audio = useStageAudio({
    src: AUDIO.worked(content, sm), text: w.narration, tl, narration: adapt.narration,
    autoStart: phase === 'run' && !brokenOpen,
  })
  const bump = useSignals((s) => s.bump)

  return (
    <StageShell kicker={`Sub-module ${sm.id}`} title={w.title} intro={w.intro}>
      {phase === 'predict' ? (
        <PredictReveal
          q={w.predict.q}
          options={w.predict.options}
          correct={w.predict.correct}
          explain={w.predict.explain}
          onReveal={() => setPhase('run')}
        >
          <motion.div className="glass reveal-card" {...popIn}>
            <p className="small" style={{ lineHeight: 1.6 }}>
              <b>Prediction locked. </b>Now the run — the narration walks you through it while the canvas shows it.
            </p>
          </motion.div>
        </PredictReveal>
      ) : !brokenOpen ? (
        <div className="stack-v">
          <N8nCanvas baseNodes={[]} baseEdges={[]} tl={tl} mode="sim" height={310} flow={w.flow} flowNodes={flowNodes} />
          <NarrationPanel audio={audio} text={w.narration} onRestart={() => bump(signalsKey, 'replays')} />
          <div className="row between wrap">
            {audio.open && w.hotspot ? (
              <Btn size="sm" variant="ghost" onClick={() => setBrokenOpen(true)}>
                <Trash2 size={13} /> {w.hotspot.button}
              </Btn>
            ) : <span className="tag-mono">watch the pieces earn their place</span>}
            {audio.open && (
              <Btn variant="primary" onClick={onNext}>Next: {nextLabel} →</Btn>
            )}
          </div>
        </div>
      ) : (
        <div className="stack-v">
          <BrokenSim broken={w.hotspot} onRestore={() => setBrokenOpen(false)} />
        </div>
      )}
    </StageShell>
  )
}
