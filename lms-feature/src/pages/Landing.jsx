import { motion } from 'motion/react'
import { ArrowRight, PackageCheck, Activity, HeartPulse } from 'lucide-react'
import { Btn } from '../ui/bits.jsx'
import { stagger, staggerChild } from '../motion.js'

const PILLARS = [
  {
    icon: PackageCheck,
    title: 'Proof, not badges',
    text: 'Every module ships a real artifact — a working workflow with the acceptance checks it passed. Your portfolio is evidence, not decoration.',
  },
  {
    icon: Activity,
    title: 'Adapts quietly',
    text: 'When you start a course, a few questions about you set the framing and the order, and one short pre-assessment sets how much support each lesson gives. Every change is shown to you.',
  },
  {
    icon: HeartPulse,
    title: 'Health checks that keep it alive',
    text: 'Days later, a workflow “needs attention.” Maintenance scenarios keep the skill alive — retention disguised as real work.',
  },
]

/* The welcome page: it leads to the dashboard, where the learner picks a course. */
export default function Landing() {
  return (
    <div>
      <div className="hero">
        <motion.div {...stagger} initial="initial" animate="animate">
          <motion.div {...staggerChild} className="chip acc mb14">Nebula KnowLab — learning you can prove</motion.div>
          <motion.h1 {...staggerChild}>
            Learning that fits you.<br />Then <em>proof</em> you can do it.
          </motion.h1>
          <motion.p {...staggerChild} className="sub">
            Choose a course, tell it a little about yourself, and take a short pre-assessment. Each lesson is then
            put in your own field and explained at the depth you need — and you can change any of it later.
          </motion.p>
          <motion.div {...staggerChild} className="hero-cta">
            <Btn to="/dashboard" variant="primary">Go to your dashboard <ArrowRight size={15} /></Btn>
          </motion.div>
          <motion.div {...staggerChild} className="loop-strip">
            <span className="chip">1 · choose a course</span>
            <span className="loop-arrow">→</span>
            <span className="chip">2 · a few questions about you</span>
            <span className="loop-arrow">→</span>
            <span className="chip">3 · a short pre-assessment</span>
            <span className="loop-arrow">→</span>
            <span className="chip">4 · your course</span>
          </motion.div>
        </motion.div>
      </div>

      <motion.div className="grid c3 mt30" {...stagger} initial="initial" animate="animate">
        {PILLARS.map((p) => (
          <motion.div key={p.title} className="glass hover" {...staggerChild}>
            <p.icon size={20} color="var(--accent)" />
            <h3 style={{ margin: '10px 0 6px', fontSize: 18 }}>{p.title}</h3>
            <p className="muted small" style={{ lineHeight: 1.6 }}>{p.text}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
