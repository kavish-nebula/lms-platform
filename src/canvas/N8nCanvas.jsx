import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, Background, BezierEdge, useInternalNode } from '@xyflow/react'
import { nodeTypes } from './CanvasNode.jsx'

/* Edge that refuses to render NaN paths while endpoints are unmeasured,
   and draws itself in on first appearance. */
function QuietEdge(props) {
  const source = useInternalNode(props.source)
  const target = useInternalNode(props.target)
  if (!source?.measured || !target?.measured) return null
  return (
    <g className="edge-draw">
      <BezierEdge {...props} />
    </g>
  )
}

const edgeTypes = { quiet: QuietEdge }

const DEFAULT_VIEW = { x: 40, y: 24, zoom: 0.9 }

/*
  The one visual language of the course. Fixed camera (no auto-fit, no zoom jumps),
  formation animations, item-flow dots during runs.

  Props:
    baseNodes/baseEdges — static parts (stagger-animate on mount when `stagger` set)
    tl                  — timeline from useTimeline (drives fold state)
    mode                — 'sim' | 'pin' | 'build'
    stagger             — seconds between node entrances on static canvases (e.g. 0.12)
    flow                — { total, stops: {nodeId: count} } → item-flow dots during runs
    viewport            — override {x, y, zoom}
    caption             — override caption
*/
export default function N8nCanvas({
  baseNodes = [],
  baseEdges = [],
  tl,
  mode = 'sim',
  onNodeClick,
  rfProps = {},
  pinnedId = null,
  hotspotIds = [],
  caption,
  height = 340,
  stagger = 0,
  flow = null,
  flowNodes = null,
  viewport,
}) {
  const dummy = useMemo(
    () => ({ fold: { nodeState: {}, edgeState: {}, extraNodes: [], extraEdges: [], caption: null, notes: [] }, elapsed: 0, total: 0, playing: false, done: true }),
    []
  )
  const live = tl || dummy
  const vp = viewport || DEFAULT_VIEW

  // React Flow hides a node until it has been measured, and a re-created node object counts as
  // unmeasured. Remember each node's size so a status change does not blink the node out.
  const sizes = useRef({})
  const rememberSizes = (changes) => {
    for (const c of changes) if (c.type === 'dimensions' && c.dimensions) sizes.current[c.id] = c.dimensions
  }

  const nodes = useMemo(() => {
    const all = [...baseNodes, ...live.fold.extraNodes]
    return all.map((n, i) => ({
      id: n.id,
      measured: sizes.current[n.id],
      type: 'brew',
      position: { x: n.x, y: n.y },
      draggable: false,
      selectable: mode !== 'sim',
      data: {
        label: n.label,
        sub: n.sub || (n.kind === 'slot' ? 'drop a node here' : null),
        kind: n.kind,
        iconKind: n.iconKind,
        status: live.fold.nodeState[n.id] || n.status || 'idle',
        pinned: pinnedId === n.id,
        hotspot: hotspotIds.includes(n.id),
        accept: n.accept,
        // formation stagger: static canvases cascade in; timeline nodes arrive on cue
        delay: stagger ? i * stagger : 0,
      },
    }))
  }, [baseNodes, live.fold, mode, stagger, pinnedId, hotspotIds])

  const edges = useMemo(() => {
    const all = [...baseEdges, ...live.fold.extraEdges]
    return all.map((e, i) => {
      const tgtState = live.fold.nodeState[e.target]
      const explicit = live.fold.edgeState[e.id]
      let cls = ''
      let animated = false
      if (explicit === 'error' || tgtState === 'error') { cls = 'path-error'; animated = true }
      else if (explicit === 'ok' || tgtState === 'ok') cls = 'path-ok'
      else if (explicit === 'active' || tgtState === 'running') { cls = 'path-active'; animated = true }
      return {
        id: e.id || `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        type: 'quiet',
        animated,
        className: cls,
      }
    })
  }, [baseEdges, live.fold])

  /* ---------- item-flow dots ---------- */
  const [dotRun, setDotRun] = useState(0)
  const wasPlaying = useRef(false)
  useEffect(() => {
    if (live.playing && !wasPlaying.current) setDotRun((d) => d + 1)
    wasPlaying.current = live.playing
  }, [live.playing])

  const flowDots = useMemo(() => {
    if (!flow || dotRun === 0) return null
    const source = flowNodes || [...baseNodes, ...live.fold.extraNodes]
    const ordered = [...source].sort((a, b) => a.x - b.x)
    if (ordered.length < 2) return null
    const x0 = ordered[0].x
    const xEnd = ordered[ordered.length - 1].x
    const nDots = Math.min(flow.total, 14)
    const stopNodes = Object.entries(flow.stops || {})
      .map(([id, count]) => ({ x: ordered.find((n) => n.id === id)?.x ?? Infinity, count }))
      .filter((s) => s.x !== Infinity)
      .sort((a, b) => a.x - b.x)
    const budgets = stopNodes.map((s) => ({ ...s, left: s.count }))
    const px = (fx) => Math.round(fx * vp.zoom + vp.x)
    const py = Math.round((ordered[0].y + 34) * vp.zoom + vp.y)
    const dur = 2.6
    const dots = []
    for (let i = 0; i < nDots; i++) {
      const delay = Math.round(((i / nDots) * 2.2 + 0.3) * 100) / 100
      let stopped = null
      for (const b of budgets) {
        if (b.left > 0) { stopped = b; b.left--; break }
      }
      const sx = px(x0 + 60)
      const tx = stopped ? px(stopped.x + 40) : px(xEnd + 60)
      dots.push({
        i,
        style: {
          left: sx, top: py,
          '--tx': `${tx - sx}px`,
          animationDelay: `${delay}s, ${delay + dur}s`,
          animationDuration: `${dur}s, .6s`,
        },
        stopped: !!stopped,
      })
    }
    return dots
  }, [flow, flowNodes, baseNodes, vp, dotRun])

  const flowActive = flow && (live.playing || live.done) && flowDots

  return (
    <div className="canvas-wrap" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => onNodeClick && onNodeClick(node.id)}
        onNodesChange={rememberSizes}
        nodesDraggable={false}
        nodesConnectable={!!rfProps.onConnect}
        elementsSelectable={mode !== 'sim'}
        defaultViewport={vp}
        zoomOnScroll={false}
        panOnScroll={false}
        minZoom={0.5}
        maxZoom={1.25}
        proOptions={{ hideAttribution: true }}
        {...rfProps}
      >
        <Background color="#cfd9e0" gap={18} size={1.4} />
      </ReactFlow>

      {flowActive && (
        <div className="flow-layer" key={dotRun} aria-hidden>
          {flowDots.map((d) => (
            <span key={d.i} className={`flow-dot ${d.stopped ? 'stopped' : 'through'}`} style={d.style} />
          ))}
        </div>
      )}

      {live.fold.notes?.length > 0 && (
        <div className="canvas-notes">
          {live.fold.notes.slice(-3).map((note, i) => <div key={i}>{note}</div>)}
        </div>
      )}

      {(caption !== undefined ? caption : live.fold.caption) && (
        <div className="canvas-caption">{caption !== undefined ? caption : live.fold.caption}</div>
      )}
    </div>
  )
}
