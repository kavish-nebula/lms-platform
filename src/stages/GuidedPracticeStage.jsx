import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useReactFlow } from '@xyflow/react'
import { ArrowRight, Bot, CheckCircle2, Hammer, Wrench, XCircle } from 'lucide-react'
import StageShell from './StageShell.jsx'
import N8nCanvas from '../canvas/N8nCanvas.jsx'
import { useTimeline } from '../canvas/useTimeline.js'
import NarrationPanel, { useStageAudio } from '../canvas/NarrationPanel.jsx'
import { AUDIO } from '../content/audio.js'
import PredictReveal from './common/PredictReveal.jsx'
import { Btn } from '../ui/bits.jsx'
import { useSignals } from '../stores/signals.js'
import { usePatch } from '../stores/patch.js'
import { popIn, fadeUp } from '../motion.js'

const KIND_LABEL = { trigger: 'trigger', data: 'data-transform', logic: 'logic/guard', action: 'action', wait: 'wait', http: 'HTTP request', ai: 'AI' }
const an = (word) => `${/^[aeiou]|^(HTTP|AI)/i.test(word) ? 'an' : 'a'} ${word}`

/*
  Stage: guided practice — one per module.
  A problem situation → the learner builds the workflow step by step. Each step
  has its instruction; every move is answered at once (right, or what is wrong —
  more specific each time it goes wrong); and Patch can be asked about the step.
  Then: predict → full run (with item flow) → break-it-on-purpose drill → fix it back.
*/
export default function GuidedPracticeStage({ content, signalsKey, onNext, adapt }) {
  const g = content.guided
  const steps = g.steps
  const [stepIdx, setStepIdx] = useState(0)
  const [started, setStarted] = useState(!g.situation)
  const [placed, setPlaced] = useState([])
  const [hint, setHint] = useState(null)
  const [misses, setMisses] = useState(0) // wrong moves on the step in hand
  const [selected, setSelected] = useState(null)
  const [running, setRunning] = useState(false)
  const [predictDone, setPredictDone] = useState(false)
  const [drill, setDrill] = useState(null) // null | 'pick' | 'broken' | 'fixed'
  const [drillChoice, setDrillChoice] = useState(null)
  const [showBefore, setShowBefore] = useState(adapt.guidedScaffold === 'full')
  const bump = useSignals((s) => s.bump)
  const setHelp = usePatch((s) => s.setHelp)
  const openChat = usePatch((s) => s.setChat)
  const { screenToFlowPosition } = useReactFlow()

  const finalTl = useTimeline(g.finalScript, { autoplay: false })
  const brokenTl = useTimeline(g.breakDrill?.brokenScript || [], { autoplay: false })
  const fixTl = useTimeline(g.breakDrill?.fixScript || [], { autoplay: false })

  const bd = g.breakDrill

  // each run is narrated; the voice drives its canvas and starts when that run comes on screen
  const narration = adapt.narration
  const finalAudio = useStageAudio({ src: AUDIO.guidedFinal(content), text: g.finalNarration, tl: finalTl, narration, autoStart: running && predictDone && !drill })
  const brokenAudio = useStageAudio({ src: AUDIO.guidedBroken(content), text: bd?.brokenNarration, tl: brokenTl, narration, autoStart: drill === 'broken' })
  const fixAudio = useStageAudio({ src: AUDIO.guidedFix(content), text: bd?.fixNarration, tl: fixTl, narration, autoStart: drill === 'fixed' })
  const palette = adapt.showDecoys ? g.palette : g.palette.filter((item) => !item.decoy)
  const current = steps[stepIdx]
  const complete = placed.length >= steps.length
  const activeSlot = complete ? null : { id: 'slot', kind: 'slot', label: 'Drop here', accept: current.accept, x: 40 + stepIdx * 210, y: 140 }
  const lastAfter = placed.length ? steps[placed.length - 1].after : null
  const nameIt = misses >= 3 // after three wrong moves the node to use is pointed out

  // Patch answers doubts about the step in hand
  useEffect(() => {
    if (!started || complete) { setHelp(null); return }
    setHelp({
      title: `Guided practice · step ${stepIdx + 1} of ${steps.length}`,
      prompts: [
        { q: 'What do I do in this step?', a: `${current.task} Click the node in the row above the canvas, then click the highlighted slot.` },
        { q: 'Why does this node go here?', a: current.before },
        { q: 'I’m stuck — give me a hint', a: `This step needs ${an(KIND_LABEL[current.accept])} node. Look for “${current.paletteLabel}”.` },
      ],
      fallback: `I can’t answer that one here — but for this step: ${current.before}`,
    })
  }, [started, complete, stepIdx])
  useEffect(() => () => setHelp(null), [])

  const baseNodes = useMemo(() => {
    const nodes = placed.map((p, i) => ({
      id: `node${i + 1}`, kind: p.kind, label: p.label, sub: p.kind === 'trigger' ? 'wakes the workflow' : 'placed by you',
      x: 40 + i * 210, y: 140, status: 'ok',
    }))
    if (activeSlot) nodes.push(activeSlot)
    return nodes
  }, [placed, activeSlot])

  const baseEdges = useMemo(() => {
    const es = []
    for (let i = 1; i < placed.length; i++) es.push({ id: `pe${i}`, source: `node${i}`, target: `node${i + 1}` })
    if (activeSlot && placed.length) es.push({ id: 'pe-slot', source: `node${placed.length}`, target: 'slot' })
    return es
  }, [placed, activeSlot])

  const tryPlace = (item) => {
    if (!current || complete) return
    if (item.label !== current.paletteLabel) {
      // guidance gets more specific each time: what is wrong → why this step needs something else → which node
      const n = misses + 1
      const what = item.kind === current.accept
        ? `${item.label} is the right kind of node, but not the one this step asks for.`
        : `${item.label} is ${an(KIND_LABEL[item.kind] || item.kind)} node — this step needs ${an(KIND_LABEL[current.accept])}.`
      setHint(n === 1 ? what : n === 2 ? `${what} ${current.before}` : `Use “${current.paletteLabel}” — it is marked in the row above. ${current.before}`)
      setMisses(n)
      setSelected(null)
      bump(signalsKey, 'wrongDrops')
      return
    }
    setPlaced((p) => [...p, item])
    setStepIdx((i) => i + 1)
    setHint(null)
    setMisses(0)
    setSelected(null)
    bump(signalsKey, 'guidedSteps')
  }

  const onDrop = (event) => {
    event.preventDefault()
    if (!selected || complete) return
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const d = Math.hypot(pos.x - activeSlot.x, pos.y - activeSlot.y)
    if (d < 140) tryPlace(selected)
    else setHint('Drop it on the highlighted slot — the pipeline builds left to right.')
  }

  /* ---- final run phase ---- */
  if (running) {
    const runNodes = placed.map((p, i) => ({ id: `node${i + 1}`, kind: p.kind, label: p.label, sub: 'placed by you', x: 40 + i * 210, y: 140 }))
    const runEdges = placed.slice(1).map((p, i) => ({ id: `re${i}`, source: `node${i + 1}`, target: `node${i + 2}` }))

    /* break-it drill sub-flow */    if (drill === 'pick') {
      return (
        <StageShell kicker="Guided build · break drill" title={bd.title} intro={bd.intro}>
          <motion.div className="stack-v" {...fadeUp}>
            <p className="small" style={{ fontWeight: 600, lineHeight: 1.6 }}>{bd.task}</p>
            <p className="muted small">Pick the one change that causes it:</p>
            {bd.bugs.map((b, i) => (
              <button key={i} className={`opt ${drillChoice === i ? (i === bd.correct ? 'wrong' : 'sel') : ''}`} onClick={() => setDrillChoice(i)}>
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
                    <Btn variant="primary" onClick={() => setDrill('fixed')}>
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
                <span className="tag-mono">break it → watch it fail → fix it → watch it hold. that’s the whole craft.</span>
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
            <p className="small mb8"><b>1. You build it.</b> {steps.length} steps on an empty canvas — each step tells you what it is for.</p>
            <p className="small mb8"><b>2. Every move is checked.</b> You’re told at once whether it was right, and if not, what to look at.</p>
            <p className="small"><b>3. Ask when in doubt.</b> “Ask Patch” answers questions about the step you’re on.</p>
          </div>
          <div className="row between">
            <span className="tag-mono">nothing here is graded — mistakes are part of it</span>
            <Btn variant="primary" onClick={() => setStarted(true)}>Start building <ArrowRight size={14} /></Btn>
          </div>
        </motion.div>
      </StageShell>
    )
  }

  return (
    <StageShell kicker="Guided practice — all concepts, one workflow" title={g.title} intro={g.intro}>
      <div className="stack-v">
        {g.situation && !complete && (
          <p className="small situation-line"><b>The situation: </b>{g.situation}</p>
        )}
        {!complete && (
          <motion.div key={stepIdx} className="glass role-card" {...fadeUp}>
            <div className="row between mb8">
              <span className="chip acc">step {stepIdx + 1} of {steps.length}</span>
              {showBefore
                ? <span className="tag-mono">explanation first — then you build</span>
                : <Btn size="sm" variant="ghost" onClick={() => setShowBefore(true)}>show the explanations</Btn>}
            </div>
            {showBefore && (
              <p className="small" style={{ lineHeight: 1.65 }}>
                <b>What will happen: </b>{current.before}
              </p>
            )}
            <div className="row between wrap mt8">
              <p className="small" style={{ fontWeight: 700 }}>→ {current.task}</p>
              <Btn size="sm" onClick={() => openChat(true)}><Bot size={13} /> Ask Patch</Btn>
            </div>
          </motion.div>
        )}

        {!complete && (
          <div className="palette" onDragOver={(e) => e.preventDefault()}>
            {palette.map((item) => (
              <div
                key={item.label}
                className={`palette-item ${item.decoy ? 'decoy' : ''} ${selected?.label === item.label ? 'sel' : ''} ${placed.some((x) => x.label === item.label) ? 'used' : ''} ${nameIt && item.label === current.paletteLabel ? 'point' : ''}`}
                style={selected?.label === item.label ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.label); setSelected(item) }}
                onClick={() => setSelected(selected?.label === item.label ? null : item)}
              >
                {item.label}
              </div>
            ))}
            <span className="tag-mono" style={{ alignSelf: 'center' }}>click a node, then click the slot — or drag it in</span>
          </div>
        )}

        <N8nCanvas
          baseNodes={baseNodes}
          baseEdges={baseEdges}
          mode="build"
          height={300}
          onNodeClick={(id) => { if (id === 'slot' && selected) tryPlace(selected) }}
          caption={(complete ? null : selected ? `${selected.label} selected — now click the highlighted slot.` : null)}
          rfProps={{
            onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
            onDrop,
          }}
        />

        {/* every move is answered: what was wrong, or that it was right */}
        <div aria-live="polite">
          {!complete && hint ? (
            <motion.div key={`miss${misses}`} className="glass fb bad" {...popIn}>
              <p className="small" style={{ lineHeight: 1.6 }}>
                <XCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
                <b>Not this one. </b>{hint}
              </p>
              <div className="row between wrap mt8">
                <span className="tag-mono">{misses < 3 ? 'try again — nothing is lost' : 'the node to use is marked above'}</span>
                <Btn size="sm" variant="ghost" onClick={() => openChat(true)}><Bot size={13} /> Ask Patch about this step</Btn>
              </div>
            </motion.div>
          ) : placed.length > 0 && (
            <motion.div key={`hit${placed.length}`} className="glass fb ok" {...popIn}>
              <p className="small" style={{ lineHeight: 1.6 }}>
                <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 6 }} />
                <b>Right. </b>{lastAfter}
              </p>
            </motion.div>
          )}
        </div>

        {complete && (
          <motion.div className="stack-v" {...popIn}>
            <div className="glass reveal-card">
              <b>The workflow is yours — every node placed by your hand.</b>
              <p className="muted small mt8" style={{ lineHeight: 1.6 }}>Now predict the run — then watch the whole thing against real data.</p>
              <div className="row between mt14">
                <span />
                <Btn variant="primary" onClick={() => setRunning(true)}>
                  Run the pipeline ▶
                </Btn>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </StageShell>
  )
}
