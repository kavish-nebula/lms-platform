import { motion } from 'framer-motion'
import { fadeUp } from '../motion.js'

export default function StageShell({ kicker, title, intro, children, footer }) {
  return (
    <motion.div initial={fadeUp.initial} animate={fadeUp.animate} transition={fadeUp.transition}>
      <div className="stage-head">
        <div>
          <div className="kicker">{kicker}</div>
          <h2 style={{ fontSize: 25, marginTop: 4 }}>{title}</h2>
        </div>
      </div>
      {intro && <p className="muted small" style={{ marginBottom: 14, maxWidth: 640, lineHeight: 1.55 }}>{intro}</p>}
      {children}
      {footer && <div className="row between mt20">{footer}</div>}
    </motion.div>
  )
}
