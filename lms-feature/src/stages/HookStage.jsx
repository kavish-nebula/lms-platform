import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, UserRound } from 'lucide-react'
import StageShell from './StageShell.jsx'
import N8nCanvas from '../canvas/N8nCanvas.jsx'
import { useTimeline } from '../canvas/useTimeline.js'
import NarrationPanel, { useStageAudio } from '../canvas/NarrationPanel.jsx'
import { AUDIO } from '../content/audio.js'
import { Btn } from '../ui/bits.jsx'
import { useSignals } from '../stores/signals.js'
import { popIn } from '../motion.js'

/* The spoken intro for the brief — the text is on screen, so the bar alone is enough. */
function IntroNarration({ content, narration }) {
  const intro = useStageAudio({ src: AUDIO.intro(content), text: content.hook.introNarration, narration, autoStart: !narration.muted })
  return <NarrationPanel audio={intro} text={content.hook.introNarration} subtitle={false} />
}

/*
  Stage: Problem hook. Curiosity before content:
  brief (with audio intro) → commit to a guess → narrated reveal (run) → wrap.
  A module whose hook has nothing broken to point at sets `hook.pin: false` and asks for the hunch only.
*/
export default function HookStage({ content, signalsKey, onNext, adapt, nextLabel }) {
  const h = content.hook
  const needsPin = h.pin !== false
  const [phase, setPhase] = useState('brief')
  const [pinned, setPinned] = useState(null)
  const [hunch, setHunch] = useState(null)
  const setField = useSignals((s) => s.setField)

  // the reveal: the voice walks through the run while the canvas plays it
  const tl = useTimeline(h.revealScript, { autoplay: false })
  const reveal = useStageAudio({ src: AUDIO.reveal(content), text: h.revealNarration, tl, narration: adapt.narration, autoStart: phase === 'reveal' })

  const baseNodes = useMemo(() => h.baseNodes, [h])
  const baseEdges = useMemo(() => h.baseEdges, [h])
  const ready = hunch && (pinned || !needsPin)

  const startReveal = () => {
    setField(signalsKey, { pinGuess: pinned, hunch: hunch?.id || null })
    setPhase('reveal')
  }

  return (
    <StageShell kicker={h.kicker} title={h.title}>
      {phase === 'brief' && (
        <div className="stack-v">
          <div className="glass role-card reveal-card" style={{ padding: 24 }}>
            <div className="kicker" style={{ color: 'var(--warn-ink)' }}>Why this matters</div>
            <p style={{ marginTop: 10, fontSize: 17.5, lineHeight: 1.65 }}>{h.whyMatters.text}</p>
            <div className="row mt14 wrap" style={{ gap: 8 }}>
              <span className="chip warn">{h.whyMatters.stat}</span>
            </div>
            <IntroNarration content={content} narration={adapt.narration} />
          </div>
          <div className={adapt.roleLine ? 'hook-pair' : ''}>
            {adapt.roleLine && (
              <div className="glass for-you">
                <div className="kicker mb8"><UserRound size={12} /> For you, as {adapt.roleLabel}</div>
                <p className="small">{adapt.roleLine}</p>
              </div>
            )}
            <div className="glass">
              <div className="kicker mb8">The aftermath, in Slack</div>
              {h.slackMsgs.map((m, i) => (
                <div className="msg" key={i}>
                  <div className="msg-av">{m.av}</div>
                  <div>
                    <div className="msg-who">{m.who} · {m.at}</div>
                    <div className="msg-bubble">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="row between">
            <Btn variant="primary" onClick={() => setPhase('pin')}>Open the canvas →</Btn>
          </div>
        </div>
      )}

      {phase === 'pin' && (
        <div className="stack-v">
          <p className="small" style={{ fontWeight: 600 }}>{h.pinPrompt}</p>
          <N8nCanvas
            baseNodes={baseNodes}
            baseEdges={baseEdges}
            mode={needsPin ? 'pin' : 'sim'}
            pinnedId={pinned}
            onNodeClick={needsPin ? (id) => setPinned(id) : undefined}
            height={300}
            stagger={0.14}
            caption={h.pinCaption}
          />
          <div className="glass">
            <div className="kicker mb8">Your hunch</div>
            {h.hunches.map((op) => (
              <button key={op.id} type="button" className={`opt ${hunch?.id === op.id ? 'sel' : ''}`} onClick={() => setHunch(op)}>
                {op.label}
              </button>
            ))}
          </div>
          <div className="row between wrap">
            <span className="tag-mono">
              {ready ? 'committed — now see what actually happens' : needsPin && !pinned ? 'click the node you suspect, then pick a hunch' : 'pick a hunch to continue'}
            </span>
            <Btn variant="primary" disabled={!ready} onClick={startReveal}>Reveal — run it ▶</Btn>
          </div>
        </div>
      )}

      {phase === 'reveal' && (
        <div className="stack-v">
          <N8nCanvas baseNodes={baseNodes} baseEdges={baseEdges} tl={tl} mode="sim" height={300} />
          <NarrationPanel audio={reveal} text={h.revealNarration} />
          <div className="row between">
            <span className="tag-mono">{reveal.ended ? 'that was the run' : `${reveal.muted ? 'read along' : 'listen'} — the run is being walked through`}</span>
            {reveal.open && (
              <Btn variant="primary" onClick={() => setPhase('wrap')}>What actually happened →</Btn>
            )}
          </div>
        </div>
      )}

      {phase === 'wrap' && (
        <motion.div className="stack-v" {...popIn}>
          <div className="glass reveal-card">
            <div className="row mb8"><AlertTriangle size={16} color="var(--amber)" /><b>{hunch?.id === h.correctHunch ? h.wrapCorrect : h.wrapWrong}</b></div>
            <p className="muted small" style={{ lineHeight: 1.6 }}>{h.wrapPoint}</p>
          </div>
          <div className="row between">
            <span className="tag-mono">
              {pinned && `your pin: ${baseNodes.find((n) => n.id === pinned)?.label || pinned} · `}your hunch: {hunch?.label}
            </span>
            <Btn variant="primary" onClick={onNext}>Next: {nextLabel} →</Btn>
          </div>
        </motion.div>
      )}
    </StageShell>
  )
}
