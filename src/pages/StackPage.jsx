import { motion } from 'framer-motion'
import { Workflow, Clock3, CheckCircle2 } from 'lucide-react'
import { PageHeader, SectionTitle, StatTile } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { useCourse } from '../stores/course.js'
import { MODULES, STACK } from '../content/course.js'
import { fadeUp } from '../motion.js'

/*
  Stack Builder — Nebula's automation stack assembles as you complete modules.
  Progress that IS the course content: each module wires a real workflow into the company.
*/
export default function StackPage({ embedded = false }) {
  const Head = embedded ? SectionTitle : PageHeader // as a tab on the course page it is a section, not a page
  const progress = useCourse((s) => s.progress)
  const done = (n) => !!progress[n]?.completed
  const mod = (n) => MODULES.find((m) => m.n === n)
  const live = STACK.filter((s) => done(s.n))
  const hours = live.reduce((n, s) => n + (mod(s.n)?.hrsSaved || 0), 0)
  const row = STACK.filter((s) => !s.capstone)
  const capstone = STACK.find((s) => s.capstone)

  return (
    <div>
      <Head
        kicker="Stack builder"
        title="Nebula, getting automated"
        sub="Every module you ship wires another workflow into the company's stack. This is what 'progress' looks like here — not points."
      />

      <div className="grid c2">
        <StatTile icon={Workflow} value={live.length} unit={`/${STACK.length}`} label="workflows live" />
        <StatTile icon={Clock3} tone="amber" value={hours} unit="hrs/wk" label="of manual work taken off Nebula" />
      </div>

      <GlassCard className="pad-lg stack-svg-wrap mt20">
        <svg viewBox="0 0 860 230" style={{ width: '100%', height: 'auto' }} role="img" aria-label={`Nebula's automation stack: ${live.length} of ${STACK.length} workflows live`}>
          {/* wires */}
          {row.map((s, i) => {
            const nextNode = row[i + 1]
            if (!nextNode) return null
            const on = done(s.n) && done(nextNode.n)
            return (
              <motion.line
                key={s.n}
                className={`stk-wire ${on ? 'on' : ''}`}
                x1={s.x + 150} y1={s.y + 35} x2={nextNode.x} y2={nextNode.y + 35}
                strokeDasharray="6 5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: on ? 1 : 0.12 }}
                transition={{ duration: 0.8 }}
              />
            )
          })}
          {/* everything upstream feeds the capstone */}
          {capstone && row.map((s) => (
            <line key={s.n} className={`stk-wire ${done(s.n) && done(capstone.n) ? 'on' : ''}`} strokeDasharray="6 5"
              x1={s.x + 75} y1={s.y + 70} x2={Math.min(Math.max(s.x + 75, capstone.x + 20), capstone.x + 130)} y2={capstone.y} />
          ))}
          {/* nodes */}
          {STACK.map((s) => {
            const on = done(s.n)
            return (
              <motion.g key={s.n} className={`stk-node ${on ? 'on' : ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: s.n * 0.06 }}>
                <rect x={s.x} y={s.y} width={150} height={70} rx={14} />
                <text className="stk-tag" x={s.x + 14} y={s.y + 24}>M{s.n}{s.capstone ? ' · last layer' : ''}</text>
                <text className="stk-label" x={s.x + 14} y={s.y + 43}>{s.label}</text>
                <text className="stk-status" x={s.x + 14} y={s.y + 60}>{on ? `live · +${mod(s.n)?.hrsSaved} hrs/wk` : mod(s.n)?.built ? 'waiting for you' : 'coming next'}</text>
              </motion.g>
            )
          })}
        </svg>
      </GlassCard>

      <div className="grid c4 mt20">
        {STACK.map((s) => {
          const on = done(s.n)
          return (
            <GlassCard key={s.n} hover>
              <div className="row between">
                <span className="kicker">Module {s.n}</span>
                {on ? <span className="chip ok"><CheckCircle2 size={12} /> live</span> : <span className="chip">{mod(s.n)?.built ? 'waiting for you' : 'coming next'}</span>}
              </div>
              <h3 style={{ marginTop: 8 }}>{s.label}</h3>
              <p className="tag-mono mt8">+{mod(s.n)?.hrsSaved} hrs/wk{s.capstone ? ' · last layer' : ''}</p>
            </GlassCard>
          )
        })}
      </div>

      <motion.p className="muted small mt14" {...fadeUp}>
        The last layer (AI triage) goes live last — it needs everything upstream of it.
      </motion.p>
    </div>
  )
}
