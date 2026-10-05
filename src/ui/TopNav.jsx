import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, BookOpen, CalendarDays, PackageCheck, UserRound } from 'lucide-react'
import { useLearner } from '../stores/learner.js'
import { useReview } from '../stores/review.js'
import { spring } from '../motion.js'
import DemoPanel from './DemoPanel.jsx'
import { LEARNER } from '../content/session.js'

/* [path, label, icon, other path prefixes that keep the tab lit] */
const LINKS = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/catalog', 'Courses', BookOpen, ['/course', '/player', '/capstone', '/final', '/complete']],
  ['/plan', 'Plan', CalendarDays],
  ['/portfolio', 'Portfolio', PackageCheck],
  ['/profile', 'Profile', UserRound],
]

export default function TopNav() {
  const demoMode = useLearner((s) => s.demoMode)
  const { pathname } = useLocation()
  const due = useReview((s) => s.items.filter((r) => !r.done && r.dueAt <= Date.now()).length)
  return (
    <nav className="topnav" aria-label="Main">
      <Link to="/dashboard" className="logo">
        <span className="logo-mark">P</span> Proofcraft
      </Link>
      <div className="topnav-links">
        {LINKS.map(([to, label, Icon, also = []]) => {
          const active = [to, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`))
          return (
            <Link key={to} to={to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={spring} />}
              <Icon size={15} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
      <div className="topnav-spacer" />
      {due > 0 && (
        <Link to="/dashboard" className="chip acc">
          {due} review{due > 1 ? 's' : ''} due
        </Link>
      )}
      {demoMode && <DemoPanel />}
      <Link to="/profile" className="chip">@{LEARNER.name}</Link>
    </nav>
  )
}
