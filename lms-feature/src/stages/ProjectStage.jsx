import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Upload, Download, CheckCircle2, XCircle, FileJson, ScrollText, UserRound } from 'lucide-react'
import StageShell from './StageShell.jsx'
import N8nCanvas from '../canvas/N8nCanvas.jsx'
import NarrationPanel, { useStageAudio } from '../canvas/NarrationPanel.jsx'
import { AUDIO } from '../content/audio.js'
import PredictReveal from './common/PredictReveal.jsx'
import { Btn } from '../ui/bits.jsx'
import { lint, workflowFrom } from '../engine/linter.js'
import { usePortfolio } from '../stores/portfolio.js'
import { usePatch } from '../stores/patch.js'
import { popIn, fadeUp } from '../motion.js'

const KIND_NAME = { data: 'data-transform', logic: 'filter', action: 'final action' }

function LintReport({ report }) {
  return (
    <div className="glass">
      <div className="row between mb14">
        <b className="small">Acceptance check</b>
        <span className={`chip ${report.ok ? 'ok' : 'warn'}`}>{report.score}/{report.total}</span>
      </div>
      {report.results.map((r) => (
        <div key={r.id} className="row mb8" style={{ gap: 10, alignItems: 'flex-start' }}>
          {r.status === 'pass' ? <CheckCircle2 size={16} color="var(--ok)" /> : <XCircle size={16} color="var(--err)" />}
          <div>
            <p className="small" style={{ fontWeight: 600 }}>{r.label}</p>
            {r.status !== 'pass' && <p className="muted small" style={{ lineHeight: 1.5 }}>{r.hint}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

/*
  The course capstone — a full brief, then build it and submit it for an acceptance check.
  No step-by-step help here: the requirements are the spec.
*/
export default function ProjectStage({ content, moduleId, onNext, onSaved, doneLabel = 'Continue →', adapt }) {
  const p = content.project
  const [phase, setPhase] = useState('brief') // brief | build
  const [tab, setTab] = useState('build')
  const [wfName, setWfName] = useState(p.workflowName || `${content.title.split(':')[0]} — capstone`)
  const [placed, setPlaced] = useState({})
  const [selectedItem, setSelectedItem] = useState(null)
  const [pasted, setPasted] = useState('')
  const [report, setReport] = useState(null)
  const [saved, setSaved] = useState(false)
  const [predictDone, setPredictDone] = useState(false)
  const addArtifact = usePortfolio((s) => s.add)
  const pushPatch = usePatch((s) => s.push)

  // the brief is read aloud; the full text stays on screen, so no subtitle is needed
  const briefAudio = useStageAudio({ src: AUDIO.brief(content), text: p.briefNarration, narration: adapt.narration, autoStart: phase === 'brief' && !adapt.narration.muted })

  const slots = p.buildHere.slots
  const complete = slots.every((s) => placed[s.id])

  const baseNodes = useMemo(() => {
    const nodes = [{ id: 'sheet', kind: 'trigger', label: 'Sheet Trigger', sub: 'rows arrive', x: 40, y: 140 }]
    // a filled slot keeps its own id and shows the node the learner chose for it
    for (const s of slots) {
      const item = placed[s.id]
      nodes.push(item ? { id: s.id, kind: item.kind, label: item.label, sub: 'placed by you', x: s.x, y: s.y, status: 'ok' } : s)
    }
    return nodes
  }, [slots, placed])

  const baseEdges = useMemo(() => {
    const chain = ['sheet', ...slots.map((s) => s.id)]
    return chain.slice(0, -1).map((src, i) => ({ id: `e${i}`, source: src, target: chain[i + 1] }))
  }, [slots])

  const lintWf = (wf) => {
    const finalName = wf.name || wfName
    const r = lint({ ...wf, name: finalName })
    setReport({ ...r, wf: { ...wf, name: finalName } })
  }

  const exportAndCheck = () => {
    // exactly what was built, in the order it sits on the canvas
    lintWf(workflowFrom(wfName, slots.map((s) => placed[s.id])))
  }

  const tryParse = (text) => {
    try { lintWf(JSON.parse(text)) }
    catch { pushPatch('That JSON didn’t parse — export from n8n with ⋯ → Download, then upload the file directly.') }
  }

  const save = () => {
    addArtifact({
      moduleId,
      title: wfName,
      summary: p.brief.closing,
      workflowJson: report.wf,
      lint: report.results,
      hrsSaved: p.hrsSaved,
    })
    setSaved(true)
    onSaved?.()
  }

  const onNodeClick = (id) => {
    const slot = slots.find((s) => s.id === id)
    if (!slot || placed[slot.id] || !selectedItem) return
    if (selectedItem.kind === slot.accept && slot.only && selectedItem.label !== slot.only) {
      // right kind, wrong place — the order is part of the requirements
      pushPatch(slot.why)
    } else if (selectedItem.kind === slot.accept) {
      setPlaced((pl) => ({ ...pl, [slot.id]: selectedItem }))
      setSelectedItem(null)
    } else {
      pushPatch(`That slot needs a ${KIND_NAME[slot.accept]} node — check the requirements in the brief.`)
    }
  }

  return (
    <StageShell kicker={p.kicker} title={p.title}>
      <div className="stack-v">
        {phase === 'brief' && (
          <motion.div className="stack-v" {...fadeUp}>
            <div className="glass role-card" style={{ padding: 28 }}>
              <div className="row mb8"><ScrollText size={17} color="var(--accent-ink)" /><b>The brief</b></div>
              <NarrationPanel audio={briefAudio} text={p.briefNarration} subtitle={false} />
              <div className="hr" />
              <p style={{ fontSize: 17, lineHeight: 1.7 }}>{p.brief.scene}</p>
              {adapt.roleBrief && (
                <p className="small for-you-line"><UserRound size={13} /> <b>For you, as {adapt.roleLabel}:</b> {adapt.roleBrief}</p>
              )}
              <div className="hr" />
              <div className="kicker mb8">Requirements — all of them</div>
              {p.brief.requirements.map((r, i) => (
                <p key={i} className="small mb8" style={{ lineHeight: 1.55 }}>{i + 1}. {r}</p>
              ))}
              <div className="hr" />
              <div className="kicker mb8" style={{ color: 'var(--amber)' }}>Edge cases you must survive</div>
              {p.brief.edgeCases.map((e, i) => (
                <p key={i} className="small mb8" style={{ lineHeight: 1.55 }}>⚠ {e}</p>
              ))}
              <div className="hr" />
              <p className="small muted" style={{ lineHeight: 1.6 }}>{p.brief.closing}</p>
            </div>
            <div className="row between">
              <span className="tag-mono">no hints — the requirements above are your spec</span>
              <Btn variant="primary" onClick={() => setPhase('build')}>Accept the brief → build it</Btn>
            </div>
          </motion.div>
        )}

        {phase === 'build' && !report && (
          <motion.div className="stack-v" {...fadeUp}>
            <div className="row">
              <Btn size="sm" variant={tab === 'build' ? 'primary' : 'ghost'} onClick={() => setTab('build')}>Build it here</Btn>
              <Btn size="sm" variant={tab === 'upload' ? 'primary' : 'ghost'} onClick={() => setTab('upload')}><Upload size={13} /> Upload from real n8n</Btn>
            </div>

            {tab === 'build' && (
              <>
                <p className="muted small">{p.buildHere.intro}</p>
                <label className="fld">Name your workflow</label>
                <input className="input" value={wfName} onChange={(e) => setWfName(e.target.value)} />
                <div className="palette">
                  {p.buildHere.palette.map((item) => {
                    const used = Object.values(placed).some((x) => x.label === item.label)
                    return (
                      <div
                        key={item.label}
                        className={`palette-item ${used ? 'used' : ''} ${selectedItem?.label === item.label ? 'sel' : ''}`}
                        style={selectedItem?.label === item.label ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
                        onClick={() => !used && setSelectedItem(item)}
                      >
                        {item.label}
                      </div>
                    )
                  })}
                  <span className="tag-mono" style={{ alignSelf: 'center' }}>click a node, then click its slot</span>
                </div>
                <N8nCanvas baseNodes={baseNodes} baseEdges={baseEdges} mode="build" height={280} onNodeClick={onNodeClick}
                  caption={complete ? 'Pipeline complete — run the acceptance check.' : selectedItem ? `${selectedItem.label} selected — click the matching slot.` : null} />
                <div className="row between">
                  <span />
                  <Btn variant="primary" disabled={!complete} onClick={exportAndCheck}>
                    <Download size={14} /> Export JSON → acceptance check
                  </Btn>
                </div>
              </>
            )}

            {tab === 'upload' && (
              <>
                <div className="glass">
                  <div className="kicker mb8">{p.realN8n.intro}</div>
                  {p.realN8n.steps.map((s, i) => (
                    <p key={i} className="small muted mb8" style={{ lineHeight: 1.55 }}>{i + 1}. {s}</p>
                  ))}
                </div>
                <label className="fld">Paste your workflow JSON (or upload below)</label>
                <textarea className="textarea mono" value={pasted} onChange={(e) => setPasted(e.target.value)}
                  placeholder='{ "name": "…", "nodes": [ … ] }' />
                <div className="row between wrap">
                  <label className="btn sm">
                    <FileJson size={13} /> Upload .json file
                    <input type="file" accept=".json,application/json" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => { setPasted(t); tryParse(t) }) }} />
                  </label>
                  <Btn variant="primary" disabled={!pasted.trim()} onClick={() => tryParse(pasted)}>Run acceptance check →</Btn>
                </div>
              </>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {report && !predictDone && (
            <motion.div key="predict" {...popIn}>
              <PredictReveal
                q={p.predict.q}
                options={p.predict.options}
                correct={p.predict.correct}
                explain={p.predict.explain}
                onReveal={() => setPredictDone(true)}
                cta="See the acceptance report →"
              >
                <div className="glass">
                  <div className="kicker mb8">Acceptance run</div>
                  <div className="row wrap" style={{ gap: 8 }}>
                    {p.runSummary.map((s, i) => <span key={i} className={`chip ${i === p.runSummary.length - 1 ? 'ok' : ''}`}>{s}</span>)}
                  </div>
                </div>
              </PredictReveal>
            </motion.div>
          )}
          {report && predictDone && (
            <motion.div className="stack-v" {...popIn}>
              <LintReport report={report} />
              <div className="glass role-card reveal-card">
                <p className="small" style={{ lineHeight: 1.6 }}>
                  {report.ok
                    ? 'Accepted. This artifact goes to your portfolio with its acceptance report — proof, with receipts.'
                    : 'Not shippable yet — fix the flagged items above and run the check again.'}
                </p>
              </div>
              <div className="row between">
                <Btn size="sm" variant="ghost" onClick={() => { setReport(null); setSaved(false) }}>← Back</Btn>
                {report.ok && !saved && <Btn variant="primary" onClick={save}>Save to Portfolio 📁</Btn>}
              </div>
              {saved && (
                <>
                  <div className="row between glass">
                    <span className="chip ok">Saved — one artifact richer</span>
                    <Btn variant="primary" onClick={onNext}>{doneLabel}</Btn>
                  </div>
                  <motion.div className="glass role-card" {...popIn}>
                    <div className="kicker mb8">The Nebula crew reacts</div>
                    {p.reactions.map((m, i) => (
                      <div className="msg" key={i}>
                        <div className="msg-av">{m.av}</div>
                        <div>
                          <div className="msg-who">{m.who}</div>
                          <div className="msg-bubble">{m.text}</div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StageShell>
  )
}
