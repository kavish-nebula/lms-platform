import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

/* Circular progress ring — module completion at a glance. 100% = solid ring + check. */
export default function ProgressRing({ value = 0, size = 44, stroke = 4 }) {
  const v = Math.max(0, Math.min(1, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const full = v >= 1
  return (
    <div className="pring" style={{ width: size, height: size }} title={`${Math.round(v * 100)}% complete`}>
      <svg width={size} height={size}>
        <circle className="pring-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <motion.circle
          className={`pring-fg ${full ? 'full' : ''}`}
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="pring-center">
        {full ? <Check size={size * 0.42} strokeWidth={3} /> : <span style={{ fontSize: size * 0.26, fontWeight: 800 }}>{Math.round(v * 100)}<span style={{ fontSize: size * 0.18 }}>%</span></span>}
      </span>
    </div>
  )
}
