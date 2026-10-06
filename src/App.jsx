import { useEffect } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { page } from './motion.js'
import TopNav from './ui/TopNav.jsx'
import { useAdaptation } from './stores/learner.js'
import { useUi } from './stores/ui.js'
import PatchDock from './patch/PatchDock.jsx'
import Landing from './pages/Landing.jsx'
import Onboarding from './pages/Onboarding.jsx'
import PreCheck from './pages/PreCheck.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Catalog from './pages/Catalog.jsx'
import Course from './pages/Course.jsx'
import Player from './player/Player.jsx'
import Capstone from './pages/Capstone.jsx'
import FinalAssessment from './pages/FinalAssessment.jsx'
import Complete from './pages/Complete.jsx'
import LearningPlan from './pages/LearningPlan.jsx'
import Sandbox from './pages/Sandbox.jsx'
import { COURSE } from './content/course.js'
import Portfolio from './pages/Portfolio.jsx'
import Profile from './pages/Profile.jsx'
import NotFound from './pages/NotFound.jsx'

const ROUTES = [
  ['/', Landing],
  ['/onboarding', Onboarding],
  ['/dashboard', Dashboard],
  ['/catalog', Catalog],
  ['/course/:courseId/:tab?', Course],
  ['/precheck', PreCheck],
  ['/player/:moduleId', Player],
  ['/capstone', Capstone],
  ['/final', FinalAssessment],
  ['/complete', Complete],
  ['/plan', LearningPlan],
  ['/sandbox', Sandbox],
  // the stack and field notes are tabs of the course they belong to
  ['/stack', () => <Navigate to={`/course/${COURSE.id}/stack`} replace />],
  ['/bingo', () => <Navigate to={`/course/${COURSE.id}/notes`} replace />],
  ['/portfolio', Portfolio],
  ['/profile', Profile],
  ['*', NotFound],
]

/* Welcome and course setup (profile questions, pre-assessment) have no app navigation, so a learner isn't led away mid-setup. */
const ENTRY = ['/', '/onboarding', '/precheck']

export default function App() {
  const location = useLocation()
  const adapt = useAdaptation()
  const dark = useUi((s) => s.dark)
  // the theme class is applied by the store too — this keeps it true after a refresh
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  const entry = ENTRY.includes(location.pathname)
  return (
    <MotionConfig reducedMotion={adapt.reduceMotion ? 'always' : 'user'}>
    <div className={`app ${adapt.textScale > 1 ? 'text-lg' : ''} ${adapt.reduceMotion ? 'reduce-motion' : ''}`}>
      {entry ? (
        <header className="topnav">
          <Link to="/dashboard" className="logo"><span className="logo-mark">P</span> Proofcraft</Link>
        </header>
      ) : <TopNav />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={location.pathname} {...page} style={{ minHeight: 'calc(100vh - var(--nav-h))' }}>
          <Routes location={location}>
            {ROUTES.map(([path, Comp]) => (
              <Route key={path} path={path} element={<Comp />} />
            ))}
          </Routes>
        </motion.main>
      </AnimatePresence>
      {!entry && <PatchDock />}
    </div>
    </MotionConfig>
  )
}
