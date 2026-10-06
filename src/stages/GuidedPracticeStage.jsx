import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Hammer, Wrench } from 'lucide-react'
import StageShell from './StageShell.jsx'
import N8nCanvas from '../canvas/N8nCanvas.jsx'
import { useTimeline } from '../canvas/useTimeline.js'
import NarrationPanel, { useStageAudio } from '../canvas/NarrationPanel.jsx'
import { AUDIO } from '../content/audio.js'
import CasefileStage from './CasefileStage.jsx'
import BigBuildStage from './BigBuildStage.jsx'
import PredictReveal from './common/PredictReveal.jsx'
import { Btn } from '../ui/bits.jsx'
import { useSignals } from '../stores/signals.js'
import { usePatch } from '../stores/patch.js'
import { play } from '../sound.js'
import { popIn, fadeUp } from '../motion.js'
/*
  Stage: guided practice — one per module.
  A problem situation → the CASE FILE: a narrated tour of a real, already-solved
  workflow in the real n8n editor (it plays like a video — the camera glides to
  whatever the narrator points at, and pauses half-way for a check).
  Then: predict → the full run on our canvas (with item flow) → the break drill.
  Free-form building lives in the Sandbox now; here you study the real thing.
*/
export default function GuidedPracticeStage({ content, signalsKey, onNext, adapt }) {
  const g = content.guided
  const [started, setStarted] = useState(!g.situation)
  const [running, setRunning] = useState(false)
  const [predictDone, setPredictDone] = useState(false)
  const [drill, setDrill] = useState(null) // null | 'pick' | 'broken' | 'fixed'
  const [drillChoice, setDrillChoice] = useState(null)
  const [hint, setHint] = useState(null)

  const bump = useSignals((s) => s.bump)
  const setHelp = usePatch((s) => s.setHelp)

  const finalTl = useTimeline(g.finalScript, { autoplay: false })
  const brokenTl = useTimeline(g.breakDrill?.brokenScript || [], { autoplay: false })
  const fixTl = useTimeline(g.breakDrill?.fixScript || [], { autoplay: false })

  const bd = g.breakDrill

  // each run is narrated; the voice drives its canvas and starts when that run comes on screen
  const narration = adapt.narration
  const finalAudio = useStageAudio({ src: AUDIO.guidedFinal(content), text: g.finalNarration, tl: finalTl, narration, autoStart: running && predictDone && !drill })
  const brokenAudio = useStageAudio({ src: AUDIO.guidedBroken(content), text: bd?.brokenNarration, tl: brokenTl, narration, autoStart: drill === 'broken' })
  const fixAudio = useStageAudio({ src: AUDIO.guidedFix(content), text: bd?.fixNarration, tl: fixTl, narration, autoStart: drill === 'fixed' })

  // Patch answers doubts while the case file plays
  useEffect(() => {
    if (!started || running) { setHelp(null); return }
    setHelp({
      title: 'Guided practice · the case file',
      prompts: [
        { q: 'What am I looking at?', a: 'A real, already-solved workflow you can drive: every step asks you to click the actual node, route an item, or run it. Nothing here is graded.' },
        { q: 'Why do this before building?', a: 'You are studying a solved problem the way you would study a colleague’s work: click through it node by node — then the one you run here follows the same shape.' },
        { q: 'Where do the credentials live?', a: 'Inside each node there is a credential field — which account this node talks with. Expired credentials are the classic silent failure.' },
      ],
      fallback: 'I can answer questions about the workflow in the case file — the trigger, the nodes, the branches, or what happens on a run.',
    })
  }, [started, running])
  useEffect(() => () => setHelp(null), [])

  /* the run shows the module's own workflow, built from the guided steps — no assembling needed */
  const runNodes = useMemo(
    () => g.steps.map((p, i) => ({ id: `node${i + 1}`, kind: p.accept, label: p.paletteLabel, sub: 'the workflow you just studied', x: 40 + i * 210, y: 140 })),
    [g.steps]
  )
  const runEdges = useMemo(() => g.steps.slice(1).map((_, i) => ({ id: `re${i}`, source: `node${i + 1}`, target: `node${i + 2}` })), [g.steps])

  /* ---- final run phase ---- */
  if (running) {
    /* break-it drill sub-flow */
    if (drill === 'pick') {
      return (
        <StageShell kicker="Guided build · break drill" title={bd.title} intro={bd.intro}>
          <motion.div className="stack-v" {...fadeUp}>
            <p className="small" style={{ fontWeight: 600, lineHeight: 1.6 }}>{bd.task}</p>
            <p className="muted small">Pick the one change that causes it:</p>
            {bd.bugs.map((b, i) => (
              <button key={i} className={`opt ${drillChoice === i ? (i === bd.correct ? 'wrong' : 'sel') : ''}`} onClick={() => { setDrillChoice(i); play(i === bd.correct ? 'click' : 'wrong') }}>
                <b>{b.label}</b>
                <span className="muted small" style={{ display: 'block', marginTop: 3, fontWeight: 400 }}>{b.note}</span>
              </button>
            ))}
            <div className="row between">
              <span className="tag-mono">yes — you’re allowed to break things here. that’s the point.</span>
              <Btn
                variant="primary"
                disabled={drillChoice === null}
                onClick={() => {
                  if (drillChoice === bd.correct) {
                    play('pop')
                    setDrill('broken')
                  } else {
                    bump(signalsKey, 'checkFails')
                    setHint('Not that one — that change is harmless (or even helpful). Pick the one that removes a guard.')
                    setDrillChoice(null)
                  }
                }}
              >
                <Hammer size={14} /> Break it
              </Btn>
            </div>
            {hint && <div className="glass reveal-card"><p className="small" style={{ lineHeight: 1.6 }}>{hint}</p></div>}
          </motion.div>
        </StageShell>
      )
    }

    if (drill === 'broken') {
      return (
        <StageShell kicker="Guided build · break drill" title="There it is.">
          <div className="stack-v">
            <N8nCanvas baseNodes={runNodes} baseEdges={runEdges} tl={brokenTl} mode="sim" height={320} />
            <NarrationPanel audio={brokenAudio} text={bd.brokenNarration} />
            {brokenAudio.open && (
              <motion.div className="stack-v" {...popIn}>
                <div className="glass reveal-card">
                  <p className="small" style={{ lineHeight: 1.6 }}>
                    <b>{bd.bugs[bd.correct].label}</b> — that’s the one. You just watched the exact failure customers
                    would have found. Now put it back.
                  </p>
                  <div className="row between mt14">
                    <Btn size="sm" onClick={() => { setDrill('pick'); setDrillChoice(null) }}>Try another break</Btn>
                    <Btn variant="primary" onClick={() => { play('click'); setDrill('fixed') }}>
                      <Wrench size={14} /> {bd.fix}
                    </Btn>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </StageShell>
      )
    }

    if (drill === 'fixed') {
      return (
        <StageShell kicker="Guided build · break drill" title="Fixed — and now you own the lesson.">
          <div className="stack-v">
            <N8nCanvas baseNodes={runNodes} baseEdges={runEdges} tl={fixTl} mode="sim" height={320} />
            <NarrationPanel audio={fixAudio} text={bd.fixNarration} />
            {fixAudio.open && (
              <motion.div className="row between" {...popIn}>
                <span className="tag-mono">watched it → predicted it → broke it → fixed it. that’s the whole craft.</span>
                <Btn variant="primary" onClick={() => { bump(signalsKey, 'guidedDone'); onNext() }}>
                  To the module quiz <ArrowRight size={14} />
                </Btn>
              </motion.div>
            )}
          </div>
        </StageShell>
      )
    }

    return (
      <StageShell kicker="Guided practice" title="The full run">
        <div className="stack-v">
          {!predictDone ? (
            <PredictReveal
              q={g.predict.q}
              options={g.predict.options}
              correct={g.predict.correct}
              explain={g.predict.explain}
              onReveal={() => setPredictDone(true)}
            >
              <N8nCanvas baseNodes={runNodes} baseEdges={runEdges} tl={finalTl} mode="sim" height={320} flow={g.flow} flowNodes={runNodes} />
            </PredictReveal>
          ) : (
            <N8nCanvas baseNodes={runNodes} baseEdges={runEdges} tl={finalTl} mode="sim" height={320} flow={g.flow} flowNodes={runNodes} />
          )}
          {predictDone && <NarrationPanel audio={finalAudio} text={g.finalNarration} />}
          <div className="row between wrap">
            <span />
            {finalAudio.open && bd && (
              <Btn size="sm" variant="ghost" onClick={() => { setDrill('pick'); setDrillChoice(null) }}>
                <Hammer size={13} /> {bd.title}
              </Btn>
            )}
          </div>
          {finalAudio.open && (
            <motion.div className="row between" {...popIn}>
              <span className="tag-mono">optional first: break it on purpose, above</span>
              <Btn variant="primary" onClick={() => { bump(signalsKey, 'guidedDone'); onNext() }}>
                To the module quiz <ArrowRight size={14} />
              </Btn>
            </motion.div>
          )}
        </div>
      </StageShell>
    )
  }

  /* ---- the problem situation comes first ---- */
  if (!started) {
    return (
      <StageShell kicker="Guided practice — the situation" title={g.title}>
        <motion.div className="stack-v" {...fadeUp}>
          <div className="glass role-card" style={{ padding: 24 }}>
            <div className="kicker mb8">The situation</div>
            <p style={{ fontSize: 17, lineHeight: 1.7 }}>{g.situation}</p>
          </div>
          <div className="glass">
            <div className="kicker mb8">How this works</div>
            <p className="small mb8"><b>1. Watch the case file.</b> A real, solved workflow in the real n8n editor — narrated, step by step, with a check half-way.</p>
            <p className="small mb8"><b>2. Predict the run.</b> The same shape, rebuilt here — say what happens before you see it.</p>
            <p className="small"><b>3. Break it on purpose.</b> Feel where it snaps, then make it hold. Ask Patch any time.</p>
          </div>
          <div className="row between">
            <span className="tag-mono">nothing here is graded — mistakes are part of it</span>
            <Btn variant="primary" onClick={() => { play('click'); g.bigbuild || g.casefile ? setStarted(true) : setRunning(true) }}>
              {g.bigbuild ? 'Watch how it’s built' : g.casefile ? 'Open the case file' : 'Run the pipeline'} <ArrowRight size={14} />
            </Btn>
          </div>
        </motion.div>
      </StageShell>
    )
  }

  /* ---- the big build: a real problem, built end-to-end like the tutorials ---- */
  if (g.bigbuild) {
    return (
      <StageShell kicker="Guided practice — the big build" title="The AI Lead Desk — part 1" intro="A real agency problem, solved the way it gets solved for real: the hook, the plan, every node configured and explained, the mistake made and fixed, the real final test.">
        <BigBuildStage signalsKey={signalsKey} onDone={() => { bump(signalsKey, 'guidedSteps', 1); setRunning(true) }} />
      </StageShell>
    )
  }

  /* ---- the interactive case file (kept for modules that use it) ---- */
  if (g.casefile) {
    return (
      <StageShell kicker="Guided practice — the case file" title="How a real one was built" intro="A real solved workflow as a live page. Every step asks you to click the actual node, route an item, run it, break it — then fix it.">
        <CasefileStage signalsKey={signalsKey} onDone={() => { bump(signalsKey, 'guidedSteps', 1); setRunning(true) }} />
      </StageShell>
    )
  }

  /* modules without a casefile set running directly from the situation screen,
     so this line is only reachable mid-render — nothing to show */
  return null
}
