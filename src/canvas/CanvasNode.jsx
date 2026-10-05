import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import NodeIcon from './NodeIcon.jsx'

/*
  Custom n8n-style node.
  Outer motion.div = entrance formation animation (plays whenever the node appears).
  Inner motion.div = status animation (running pulse / error shake / ok flash).
*/
export default function CanvasNode({ data }) {
  const st = data.status || 'idle'
  const isSlot = data.kind === 'slot'

  const statusAnim =
    st === 'running'
      ? { boxShadow: ['0 0 0 0px rgba(217,146,43,.5)', '0 0 0 14px rgba(217,146,43,0)'], transition: { duration: 1.1, repeat: Infinity } }
      : st === 'error'
        ? { x: [0, -5, 5, -4, 4, 0], transition: { duration: 0.45 } }
        : st === 'ok'
          ? { scale: [1, 1.05, 1], transition: { duration: 0.4 } }
          : {}

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.55, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: data.delay || 0 }}
    >
      <motion.div
        className={`cnode kind-${data.kind} st-${st} ${data.pinned ? 'pinned' : ''} ${data.hotspot ? 'hotspot' : ''}`}
        animate={statusAnim}
        style={isSlot ? { minWidth: 150 } : undefined}
      >
        <Handle type="target" position={Position.Left} className="hd" />
        <div className="cnode-ic">
          <NodeIcon kind={data.iconKind || data.kind} />
        </div>
        <div>
          <div className="cnode-lb">{data.label}</div>
          {data.sub && <div className="cnode-sub">{data.sub}</div>}
        </div>
        <Handle type="source" position={Position.Right} className="hd" />
      </motion.div>
    </motion.div>
  )
}

export const nodeTypes = { brew: CanvasNode }
