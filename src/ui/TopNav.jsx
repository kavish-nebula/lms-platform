import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, BookOpen, CalendarDays, PackageCheck, UserRound, FlaskConical, Volume2, VolumeX, Moon, Sun, Flame } from 'lucide-react'
import { useLearner } from '../stores/learner.js'
import { useReview } from '../stores/review.js'
import { useStreak } from '../stores/streak.js'
import { useUi } from '../stores/ui.js'
import { spring } from '../motion.js'
import DemoPanel from './DemoPanel.jsx'
import { LEARNER } from '../content/session.js'

/* [path, label, icon, other path prefixes that keep the tab lit] */
const LINKS = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/catalog', 'Courses', BookOpen, ['/course', '/player', '/capstone', '/final', '/complete']],
  ['/plan', 'Plan', CalendarDays],
  ['/sandbox', 'Sandbox', FlaskConical],
  ['/portfolio', 'Portfolio', PackageCheck],
  ['/profile', 'Profile', UserRound],
]

/* A one-click comfort control. Sound and theme are settings, not navigation. */
function IconToggle({ on, onClick, label, OnIcon, OffIcon }) {
  return (
    <button type="button" className="btn ghost icon" onClick={onClick} aria-label={label} aria-pressed={on} title={label}>
      {on ? <OnIcon size={16} /> : <OffIcon size={16} />}
    </button>
  )
}

export default function TopNav() {
  const demoMode = useLearner((s) => s.demoMode)
  const { pathname } = useLocation()
  const due = useReview((s) => s.items.filter((r) => !r.done && r.dueAt <= Date.now()).length)
  const streak = useStreak((s) => s.streak)
  const { dark, sound, toggleDark, toggleSound } = useUi()
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
      {streak > 0 && (
        <Link to="/dashboard" className="chip nav-streak" aria-label={`${streak}-day streak`}>
          <Flame size={12} /> {streak}d
        </Link>
      )}
      {due > 0 && (
        <Link to="/dashboard" className="chip acc">
          {due} review{due > 1 ? 's' : ''} due
        </Link>
      )}
      {demoMode && <DemoPanel />}
      <IconToggle on={sound} onClick={toggleSound} label={sound ? 'Mute sounds' : 'Unmute sounds'} OnIcon={Volume2} OffIcon={VolumeX} />
      <IconToggle on={dark} onClick={toggleDark} label={dark ? 'Switch to light mode' : 'Switch to dark mode'} OnIcon={Sun} OffIcon={Moon} />
      <Link to="/profile" className="chip">@{LEARNER.name}</Link>
    </nav>
  )
}
