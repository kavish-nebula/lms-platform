import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, HelpCircle, Globe } from 'lucide-react'
import StageShell from './StageShell.jsx'
import VideoLesson from '../video/VideoLesson.jsx'
import N8nCanvas from '../canvas/N8nCanvas.jsx'
import { useTimeline } from '../canvas/useTimeline.js'
import NarrationPanel, { useStageAudio } from '../canvas/NarrationPanel.jsx'
import { AUDIO } from '../content/audio.js'
import { Btn } from '../ui/bits.jsx'
import QuestionDialog from '../ui/QuestionDialog.jsx'
import { useSignals } from '../stores/signals.js'
import { shouldOfferAltTake } from '../engine/adaptive.js'
import { popIn, fadeUp } from '../motion.js'

/* One beat = real narration audio + its canvas formation. Ends with a tap-check. */
function Beat({ beat, src, beatIdx, beatCount, sigKey, adapt, altTake, nodeLabels, offerNow, onAltOpened, onDone }) {
  const tl = useTimeline(beat.script, { autoplay: false })
  const audio = useStageAudio({ src, text: beat.narration, tl, narration: adapt.narration, autoStart: true })
  const [answered, setAnswered] = useState(null)
  // on extra support (or for learners who asked for step-by-step) the analogy is open on every beat,
  // and the first “why” note is already showing
  const [altOpen, setAltOpen] = useState(adapt.analogyUpFront)
  const whyIds = Object.keys(beat.why || {})
  const [showWhy, setShowWhy] = useState(adapt.whyOpen ? whyIds[0] || null : null)
  const [checkOpen, setCheckOpen] = useState(false)

  // the quick check pops up once, when the narration has been heard through
  useEffect(() => { if (audio.ended && beat.check) setCheckOpen(true) }, [audio.ended])
  const bump = useSignals((s) => s.bump)

  const answer = (i) => {
    setAnswered(i)
    if (i !== beat.check.correct) bump(sigKey, 'checkFails')
  }

  return (
    <motion.div {...fadeUp}>
      <N8nCanvas baseNodes={[]} baseEdges={[]} tl={tl} mode="sim" height={310} />
      <NarrationPanel audio={audio} text={beat.narration} onRestart={() => bump(sigKey, 'replays')} />

      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {beatCount > 1 && <span className="chip info">Part {beatIdx + 1} of {beatCount}</span>}
        {(audio.open || adapt.whyOpen) && whyIds.map((id) => (
          <Btn key={id} size="sm" aria-pressed={showWhy === id} onClick={() => setShowWhy(showWhy === id ? null : id)}>
            <Lightbulb size={13} /> why “{nodeLabels[id] || id}”?
          </Btn>
        ))}
        {!altOpen && !offerNow && (
          <Btn size="sm" variant="ghost" onClick={() => setAltOpen(true)}>explain it another way</Btn>
        )}
        {audio.open && beat.check && !checkOpen && (
          answered === null
            ? <Btn size="sm" variant="primary" onClick={() => setCheckOpen(true)}><HelpCircle size={13} /> Take the quick check</Btn>
            : <Btn size="sm" variant="primary" onClick={onDone}>Continue →</Btn>
        )}
        {audio.open && !beat.check && <Btn size="sm" variant="primary" onClick={onDone}>Continue →</Btn>}
      </div>
      {showWhy && (
        <motion.div className="glass mt14 reveal-card" {...popIn}>
          <div className="kicker mb8" style={{ color: 'var(--info-ink)' }}>Why “{nodeLabels[showWhy] || showWhy}” exists</div>
          <p className="small" style={{ lineHeight: 1.6 }}>{beat.why[showWhy]}</p>
        </motion.div>
      )}

      {/* alt-take: offered once confusion is detected, dismissible, never auto-repeats */}
      {offerNow && !altOpen && (
        <motion.div className="glass mt14 reveal-card" {...popIn}>
          <div className="row between">
            <b className="small">{altTake.offer}</b>
            <Btn size="sm" onClick={() => { setAltOpen(true); onAltOpened() }}>{altTake.cta || 'Show me'}</Btn>
          </div>
        </motion.div>
      )}
      {altOpen && (
        <motion.div className="glass role-card reveal-card mt14" {...popIn}>
          <div className="row between mb8">
            <div className="kicker" style={{ color: 'var(--warn-ink)' }}>{altTake.analogyTitle}</div>
            <Btn size="sm" variant="ghost" onClick={() => setAltOpen(false)}>Dismiss ×</Btn>
          </div>
          <p className="small" style={{ lineHeight: 1.65 }}>{altTake.analogy}</p>
          <p className="small muted mt8" style={{ lineHeight: 1.6 }}>{altTake.nounsNote}</p>
        </motion.div>
      )}

      {adapt.world && (
        <div className="glass for-you mt14">
          <div className="kicker mb8"><Globe size={12} /> In your world · {adapt.world.label}</div>
          <p className="small">{adapt.world.text}</p>
        </div>
      )}

      {beat.check && (
        <QuestionDialog
          open={checkOpen}
          kicker="Quick check — not graded"
          question={beat.check.q}
          options={beat.check.options}
          correct={beat.check.correct}
          explain={beat.check.explain}
          answered={answered}
          onAnswer={answer}
          onContinue={onDone}
          onClose={() => setCheckOpen(false)}
        />
      )}
    </motion.div>
  )
}

/*
  Stage: the concept for one lesson. A lesson that has a concept video is taught
  by it (narrated slides with checks inside); the others use narrated canvas beats.
*/
export default function ExplainerStage(props) {
  return props.sm.video ? <VideoExplainer {...props} /> : <BeatsExplainer {...props} />
}

function VideoExplainer({ sm, onNext, adapt, nextLabel }) {
  return (
    <StageShell kicker={`Lesson ${sm.id} · concept video`} title={sm.video.title}>
      <div className="stack-v">
        <VideoLesson video={sm.video} onDone={onNext} doneLabel={`Next: ${nextLabel}`} />
        {adapt.world && (
          <div className="glass for-you">
            <div className="kicker mb8"><Globe size={12} /> In your world · {adapt.world.label}</div>
            <p className="small">{adapt.world.text}</p>
          </div>
        )}
      </div>
    </StageShell>
  )
}

/* Per-beat audio, one beat at a time. */
function BeatsExplainer({ content, sm, signalsKey, onNext, adapt, nextLabel }) {
  const e = sm.explainer
  const [beatIdx, setBeatIdx] = useState(0)
  const [altOffered, setAltOffered] = useState(false)
  const sig = useSignals((s) => s.sig(signalsKey))

  const beats = e.beats
  // node ids → the names on the canvas, so the “why” buttons can use real names
  const nodeLabels = Object.fromEntries(beats.flatMap((b) => b.script.filter((a) => a.do === 'addNode').map((a) => [a.node.id, a.node.label])))
  const finished = beatIdx >= beats.length
  const beat = beats[Math.min(beatIdx, beats.length - 1)]

  // behaviour outranks stated preference: two failed checks or replays offer the analogy to anyone
  const offerNow = !finished && !altOffered && shouldOfferAltTake(sig)

  return (
    <StageShell kicker={`Sub-module ${sm.id}`} title={sm.title + ' — how it works'}>
      <div className="stack-v">
        {!finished && (
          <Beat
            beatCount={beats.length}
            key={beatIdx}
            beat={beat}
            src={AUDIO.beat(content, sm, beatIdx)}
            beatIdx={beatIdx}
            sigKey={signalsKey}
            adapt={adapt}
            altTake={e.altTake}
            nodeLabels={nodeLabels}
            offerNow={offerNow}
            onAltOpened={() => setAltOffered(true)}
            onDone={() => setBeatIdx((i) => i + 1)}
          />
        )}

        {finished && (
          <motion.div className="stack-v" {...popIn}>
            <div className="glass reveal-card">
              <b>{sm.title} — locked in.</b>
              <p className="muted small mt8" style={{ lineHeight: 1.6 }}>
                The full pipeline you just watched form — that’s the shape of this sub-module.
              </p>
            </div>
            <div className="row between">
              <span className="tag-mono">sub-module {sm.id} of this module</span>
              <Btn variant="primary" onClick={onNext}>Next: {nextLabel} →</Btn>
            </div>
          </motion.div>
        )}
      </div>
    </StageShell>
  )
}
