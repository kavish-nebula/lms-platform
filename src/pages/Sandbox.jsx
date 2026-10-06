import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, addEdge, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider, MarkerType,
} from '@xyflow/react'
import { motion } from 'framer-motion'
import { CheckCircle2, Hammer, Play, Plus, Trash2, Wrench, XCircle, Download } from 'lucide-react'
import { PageHeader, Btn } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { nodeTypes } from '../canvas/CanvasNode.jsx'
import { lint } from '../engine/linter.js'
import { usePatch } from '../stores/patch.js'
import { useStreak } from '../stores/streak.js'
import { burstConfetti } from '../ui/celebrate.jsx'
import { play } from '../sound.js'
import { popIn, fadeUp } from '../motion.js'

/*
  The Sandbox — where learners stop watching workflows and start building them.
  Two modes:
    · Free build — a node palette, a live canvas, a real run simulation and the
      course's own linter giving acceptance feedback as you build.
    · Fix the break — a healthy workflow is silently damaged; find it, fix it,
      and prove the fix with the linter.
  Everything here reuses the course's visual language: the same node renderer
  the lessons use (CanvasNode) and the same acceptance rules the capstone is
  graded by (engine/linter.js).
*/

const PALETTE = [
  { kind: 'trigger', label: 'Schedule Trigger', sub: 'wakes the workflow' },
  { kind: 'trigger', label: 'Webhook', sub: 'wakes on an event' },
  { kind: 'data', label: 'Set: Edit Fields', sub: 'reshape each item' },
  { kind: 'logic', label: 'Filter', sub: 'a guard — items stop here' },
  { kind: 'http', label: 'HTTP Request', sub: 'call an API' },
  { kind: 'action', label: 'Slack: Message', sub: 'alert a channel' },
  { kind: 'code', label: 'Code', sub: 'a few lines of JS' },
  { kind: 'wait', label: 'Wait', sub: 'pause the pipeline' },
]

const KIND_OF_LABEL = Object.fromEntries(PALETTE.map((p) => [p.label, p]))
const ICON_KIND = { Code: 'ai', 'Slack: Message': 'action' } // canvas icon fallbacks

const startX = (i) => 60 + i * 205

/* A healthy workflow, used as the fix-drill's original and its target topology. */
const GOOD_WF = () => ({
  name: 'Lead alerts → #new-leads',
  nodes: [
    { label: 'Schedule Trigger', kind: 'trigger' },
    { label: 'Set: Normalize fields', kind: 'data' },
    { label: 'Filter: has an email', kind: 'logic' },
    { label: 'Filter: Duplicate IDs', kind: 'logic' },
    { label: 'HTTP Request: CRM append', kind: 'http' },
    { label: 'Slack: #new-leads', kind: 'action' },
  ],
  edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
})

const BREAKS = [
  {
    id: 'skip-guard',
    describe: 'One connection is gone — and the CRM write is no longer protected.',
    apply: (nodes, edges) => ({ edges: edges.filter((e) => !(e.source === 'n3' && e.target === 'n4')) }),
    check: (edges) => edges.some((e) => e.source === 'n3' && e.target === 'n4'),
  },
  {
    id: 'renamed-guard',
    describe: 'A guard got renamed, and its job is no longer named anywhere.',
    apply: (nodes) => ({ nodes: nodes.map((n) => (n.id === 'n3' ? { ...n, data: { ...n.data, label: 'Filter' } } : n)) }),
    check: (edges, nodes) => nodes.some((n) => n.id === 'n3' && /has an email/i.test(n.data.label)),
  },
]

const toWf = (name, nodes) => ({
  name,
  nodes: nodes.map((n) => ({ name: n.data.label, type: typeFor(n.data.kind, n.data.label) })),
})

const typeFor = (kind, label) =>
  kind === 'data' ? 'n8n-nodes-base.set'
    : kind === 'logic' ? 'n8n-nodes-base.filter'
      : kind === 'trigger' ? 'n8n-nodes-base.scheduleTrigger'
        : kind === 'wait' ? 'n8n-nodes-base.wait'
          : kind === 'code' ? 'n8n-nodes-base.code'
            : /slack/i.test(label) ? 'n8n-nodes-base.slack' : 'n8n-nodes-base.httpRequest'

/* Nodes in run order: follow edges from triggers (BFS). Unreached nodes go last. */
function runOrder(nodes, edges) {
  const next = (id) => edges.filter((e) => e.source === id).map((e) => e.target)
  const seen = new Set()
  const order = []
  const queue = nodes.filter((n) => n.data.kind === 'trigger').map((n) => n.id)
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    const n = nodes.find((x) => x.id === id)
    if (n) order.push(n)
    queue.push(...next(id))
  }
  for (const n of nodes) if (!seen.has(n.id)) order.push(n)
  return { order, reached: seen }
}

function SandboxInner() {
  const [mode, setMode] = useState('build') // 'build' | 'fix'
  const [name, setName] = useState('My first sandbox workflow')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selected, setSelected] = useState(null)
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null) // lint result
  const [breakInfo, setBreakInfo] = useState(null)
  const [fixed, setFixed] = useState(false)
  const counters = useRef(0)
  const { screenToFlowPosition } = useReactFlow()
  const pushPatch = usePatch((s) => s.push)
  const touch = useStreak((s) => s.touch)

  const addNode = useCallback((item, pos) => {
    const id = `n${++counters.current}`
    const n = {
      id,
      type: 'brew',
      position: pos || { x: startX((counters.current - 1) % 6), y: 150 + Math.floor((counters.current - 1) / 6) * 130 },
      data: { kind: ICON_KIND[item.label] || item.kind, label: item.label, sub: item.sub, status: 'idle' },
    }
    setNodes((ns) => [...ns, n])
    play('pop')
    return id
  }, [setNodes])

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds))
    play('click')
  }, [setEdges])

  const clearAll = () => { setNodes([]); setEdges([]); setLog([]); setReport(null); setSelected(null); setBreakInfo(null); setFixed(false); play('click') }

  /* ---- run simulation: linter first, then a node-by-node run with a fake item count ---- */
  const run = () => {
    if (running || !nodes.length) return
    const wf = toWf(name, nodes)
    const rep = lint(wf)
    setReport(rep)
    const { order, reached } = runOrder(nodes, edges)
    const orphan = nodes.filter((n) => n.data.kind !== 'trigger' && !reached.has(n.id))
    setLog([`Lint: ${rep.score}/${rep.total} acceptance checks pass${rep.ok ? '' : ' — fix the fails below and run again'}`])
    if (orphan.length) setLog((l) => [...l, `${orphan.length} node${orphan.length > 1 ? 's are' : ' is'} not connected to a trigger — items can never reach ${orphan.length > 1 ? 'them' : 'it'}`])
    if (!rep.ok || orphan.length) { play('wrong'); return }

    setRunning(true)
    play('whoosh')
    let items = 300
    const timer = (i) => {
      if (i >= order.length) {
        setRunning(false)
        setLog((l) => [...l, `Run finished — ${items} of 300 items made it through, every stop accounted for`])
        play('ship')
        burstConfetti({ count: 70, origin: { x: 0.62, y: 0.5 } })
        touch('study')
        return
      }
      const n = order[i]
      setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, status: 'running' } } : x)))
      setTimeout(() => {
        if (n.data.kind === 'logic') {
          const before = items
          items = Math.max(0, items - (20 + ((items * 7) % 41)))
          setLog((l) => [...l, `${n.data.label} — guard held: ${before - items} item${before - items === 1 ? '' : 's'} stopped, ${items} passed`])
        } else {
          setLog((l) => [...l, `${n.data.label} — ${items} item${items === 1 ? '' : 's'} processed`])
        }
        setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, status: 'ok' } } : x)))
        play('click')
        timer(i + 1)
      }, 430)
    }
    timer(0)
  }

  /* ---- fix-the-break drill ---- */
  const startFix = () => {
    const wf = GOOD_WF()
    counters.current = wf.nodes.length
    const baseNodes = wf.nodes.map((n, i) => ({
      id: `n${i + 1}`, type: 'brew',
      position: { x: startX(i), y: 150 },
      data: { kind: ICON_KIND[n.label] || n.kind, label: n.label, sub: KIND_OF_LABEL[n.label]?.sub || '', status: 'idle' },
    }))
    let eds = wf.edges.map(([a, b]) => ({ id: `e${a}-${b}`, source: `n${a + 1}`, target: `n${b + 1}`, markerEnd: { type: MarkerType.ArrowClosed } }))
    const brk = BREAKS[Math.floor(Date.now() / 86400000) % BREAKS.length]
    const damage = brk.apply(baseNodes, eds)
    if (damage.edges) eds = damage.edges
    setNodes(damage.nodes || baseNodes)
    setEdges(eds)
    setName(wf.name)
    setBreakInfo(brk)
    setReport(null)
    setFixed(false)
    setLog([`A healthy workflow was damaged while you weren't looking. ${brk.describe} Restore it.`])
    play('drill')
  }

  const checkFix = () => {
    if (!breakInfo) return
    const wf = toWf(name, nodes)
    const rep = lint(wf)
    setReport(rep)
    const repaired = breakInfo.check(edges, nodes)
    if (rep.ok && repaired) {
      setFixed(true)
      setLog((l) => [...l, 'Fixed — the linter passes and the guard is back where it belongs'])
      play('ship')
      burstConfetti({ count: 80 })
      touch('drill')
      pushPatch('Break fixed in the sandbox — that’s exactly how maintenance feels on real workflows.')
    } else {
      setLog((l) => [...l, repaired ? 'The break is repaired, but the linter still isn’t happy — check the fails below' : 'Not fixed yet — the original connection/wording isn’t back in place'])
      play('wrong')
    }
  }

  const exportWf = () => {
    const blob = new Blob([JSON.stringify(toWf(name, nodes), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase() || 'sandbox-workflow'}.json`
    a.click()
    URL.revokeObjectURL(url)
    play('pop')
  }

  const onNodeClick = (_, n) => setSelected(n.id)
  const sel = nodes.find((n) => n.id === selected)

  const renameSel = (label) =>
    setNodes((ns) => ns.map((n) => (n.id === selected ? { ...n, data: { ...n.data, label } } : n)))

  const deleteSel = () => {
    setNodes((ns) => ns.filter((n) => n.id !== selected))
    setEdges((es) => es.filter((e) => e.source !== selected && e.target !== selected))
    setSelected(null)
    play('click')
  }

  return (
    <div>
      <PageHeader
        kicker="Sandbox"
        title="Build it. Break it. Prove it holds."
        sub="The same canvas the lessons use — but here you drive. Add nodes, wire them up, run the simulation and satisfy the course linter. Nothing here is graded, everything is practice."
        right={
          <div className="row" style={{ gap: 8 }}>
            <Btn size="sm" variant={mode === 'build' ? 'primary' : ''} onClick={() => { setMode('build'); clearAll() }}>Free build</Btn>
            <Btn size="sm" variant={mode === 'fix' ? 'primary' : ''} onClick={() => { setMode('fix'); startFix() }}>
              <Hammer size={13} /> Fix the break
            </Btn>
          </div>
        }
      />

      <GlassCard className="pad-lg">
        <div className="sandbox-bar">
          <label className="sandbox-name">
            <span className="tag-mono">workflow name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead alerts → #new-leads" aria-label="Workflow name" />
          </label>
          <div className="row" style={{ gap: 8 }}>
            {mode === 'fix' && breakInfo && !fixed && <Btn onClick={startFix}><Hammer size={14} /> Re-break</Btn>}
            {mode === 'fix' && breakInfo && <Btn variant="primary" onClick={checkFix}><Wrench size={14} /> Check my fix</Btn>}
            {mode === 'build' && <Btn variant="primary" onClick={run} disabled={running || !nodes.length}><Play size={14} /> Run simulation</Btn>}
            <Btn onClick={exportWf} disabled={!nodes.length}><Download size={14} /> Export .json</Btn>
            <Btn variant="ghost" onClick={clearAll}><Trash2 size={14} /> Clear</Btn>
          </div>
        </div>

        <div className="sandbox-layout">
          <aside className="sandbox-palette" aria-label="Node palette">
            <div className="kicker mb8"><Plus size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Nodes</div>
            {PALETTE.map((p) => (
              <button key={p.label} className="palette-item" onClick={() => addNode(p)} title={`Add ${p.label}`}>
                <b>{p.label}</b>
                <span>{p.sub}</span>
              </button>
            ))}
            <p className="tag-mono">click to add · drag to arrange · drag between handles to wire</p>
          </aside>

          <div className="sandbox-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              onPaneClick={() => setSelected(null)}
              defaultViewport={{ x: 0, y: 0, zoom: 0.88 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} />
            </ReactFlow>
            {!nodes.length && (
              <div className="sandbox-hint">
                <b>An empty canvas.</b>
                <p className="muted small">Add a trigger from the left, then wire the path an item would travel.</p>
              </div>
            )}
          </div>

          <aside className="sandbox-side">
            {sel ? (
              <div className="glass" style={{ padding: 14 }}>
                <div className="kicker mb8">Inspector</div>
                <input className="sandbox-rename" value={sel.data.label} onChange={(e) => renameSel(e.target.value)} aria-label="Node label" />
                <p className="tag-mono mt8">{sel.data.sub || sel.data.kind}</p>
                <Btn size="sm" variant="ghost" onClick={deleteSel}><Trash2 size={13} /> Remove node</Btn>
              </div>
            ) : (
              <div className="glass" style={{ padding: 14 }}>
                <div className="kicker mb8">Inspector</div>
                <p className="muted small">Click a node to inspect it. Rename guards after their job — the linter reads names.</p>
              </div>
            )}

            <div className="sandbox-log" aria-live="polite">
              <div className="kicker mb8">Run log</div>
              {log.length === 0 && <p className="muted small">Nothing yet — press “Run simulation”.</p>}
              {log.map((line, i) => <p key={i} className="mono sandbox-logline">{line}</p>)}
              {fixed && (
                <motion.p className="small" {...popIn} style={{ color: 'var(--ok-ink)', fontWeight: 700 }}>
                  <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 5 }} />Break fixed — and proven.
                </motion.p>
              )}
            </div>
          </aside>
        </div>

        {report && (
          <motion.div className="grid c3 mt20" {...fadeUp}>
            {report.results.map((r) => (
              <div key={r.id} className={`lint-check ${r.status}`}>
                {r.status === 'pass' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <div>
                  <b className="small">{r.label}</b>
                  {r.status === 'fail' && <p className="muted small">{r.hint}</p>}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </GlassCard>
    </div>
  )
}

export default function Sandbox() {
  return (
    <ReactFlowProvider>
      <SandboxInner />
    </ReactFlowProvider>
  )
}
