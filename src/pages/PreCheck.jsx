import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Lock } from 'lucide-react'
import { Btn, ProgressBar } from '../ui/bits.jsx'
import { useLearner, useAdaptation } from '../stores/learner.js'
import { MODULES, COURSE } from '../content/course.js'
import { CONTENT } from '../content/modules/index.js'
import { LEARNER } from '../content/session.js'
import { unitList } from '../engine/progress.js'
import { fadeUp, popIn, pathIn, pathStep } from '../motion.js'

/*
  Pre-assessment — taken once, before the first module, to understand what the
  learner already knows about this course. Never a test and never a gate, and no
  result is shown — not even right or wrong per question: the answers are used
  quietly to shape how each lesson is narrated and explained. Afterwards a short "building your course" moment leads
  to the course page.
*/
export default function PreCheck() {
  const navigate = useNavigate()
  const savePrecheck = useLearner((s) => s.savePrecheck)
  const [phase, setPhase] = useState('intro') // intro | ask | building
  const [i, setI] = useState(0)
  const [right, setRight] = useState({})

  // two quick items per lesson, across every available module
  const mods = MODULES.filter((m) => CONTENT[m.n]?.precheck)
  const items = mods.flatMap((m) => CONTENT[m.n].precheck.map((q) => ({ ...q, moduleN: m.n })))
  const toCourse = () => navigate(`/course/${COURSE.id}`)

  const finish = (result) => { savePrecheck(result); setPhase('building') }
  // an answer is recorded and the next question comes straight up — nothing is marked right or wrong
  const answer = (o) => {
    const q = items[i]
    const tally = o === q.correct ? { ...right, [q.sub]: (right[q.sub] || 0) + 1 } : right
    setRight(tally)
    if (i + 1 < items.length) return setI(i + 1)
    finish({ lessons: Object.fromEntries(mods.flatMap((m) => m.submodules.map((s) => [s.id, tally[s.id] || 0]))) })
  }

  if (phase === 'intro') {
    return (
      <motion.div className="glass pad-lg" style={{ maxWidth: 660, margin: '50px auto' }} {...fadeUp}>
        <div className="kicker mb8">Before you start · not a test</div>
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>A quick pre-assessment</h1>
        <p className="muted mt8">
          {items.length} short questions to understand what you already know about <b>{COURSE.title}</b> — about three
          minutes, once, before Module 1. We use it to shape how the lessons are narrated and explained for you.
          Nothing is graded, there is no score, and it never blocks you.
        </p>
        <div className="row wrap mt20">
          <Btn variant="primary" onClick={() => setPhase('ask')}>Start <ArrowRight size={14} /></Btn>
          <Btn onClick={() => finish({ lessons: {}, isNew: true })}>I’m completely new to this</Btn>
          <Btn variant="ghost" onClick={() => finish({ lessons: {}, skipped: true })}>Skip for now</Btn>
        </div>
        <p className="tag-mono mt14">if you skip, the course follows what you said in your profile</p>
      </motion.div>
    )
  }

  if (phase === 'ask') {
    const q = items[i]
    return (
      <motion.div className="glass pad-lg" style={{ maxWidth: 660, margin: '50px auto' }} {...fadeUp} key={i}>
        <div className="row between mb8">
          <div className="kicker">Pre-assessment · {i + 1}/{items.length}</div>
          <span className="tag-mono">not a test · module {q.moduleN}, lesson {q.sub}</span>
        </div>
        <ProgressBar value={(i + 1) / items.length} label="Pre-assessment progress" />
        <h1 style={{ fontSize: 23, margin: '22px 0 16px', lineHeight: 1.4 }}>{q.q}</h1>
        {q.options.map((o, oi) => (
          <button key={oi} type="button" className="opt" onClick={() => answer(oi)}>{o}</button>
        ))}
        <div className="row between mt14">
          <span className="tag-mono">pick the closest — there is no score</span>
          <Btn size="sm" variant="ghost" onClick={() => answer(-1)}>I don’t know yet</Btn>
        </div>
      </motion.div>
    )
  }

  return <BuildingCourse mods={MODULES} onDone={toCourse} />
}

/*
  "Building your course" — the module path assembles, then one line says who it
  was set up for. It never moves on by itself: the learner clicks through to the
  modules page. Learners who asked for less motion see the finished state at once.
*/
function BuildingCourse({ mods, onDone }) {
  const adapt = useAdaptation()
  const [ready, setReady] = useState(false)
  const still = adapt.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (still) { setReady(true); return } // no animation — show the finished state at once
    const built = mods.filter((m) => m.built).length
    const line = setTimeout(() => setReady(true), 700 + built * 900 + (mods.length - built) * 250)
    return () => clearTimeout(line)
  }, [])

  // "Set up for a team lead in Manufacturing"
  const who = [adapt.roleLabel && `for ${adapt.roleLabel}`, adapt.domain && `in ${adapt.domain.label}`].filter(Boolean).join(' ')
  let order = 0
  return (
    <div className="building" aria-live="polite">
      <div className="row between">
        <div>
          <div className="kicker">{ready ? 'Ready' : 'One moment'}</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>{ready ? `${LEARNER.name}, your course is ready.` : 'Building your course…'}</h1>
        </div>
        {!ready && <Btn size="sm" variant="ghost" onClick={() => setReady(true)}>Skip the animation</Btn>}
      </div>

      <motion.div className="building-path" {...pathIn} initial="initial" animate="animate">
        {mods.map((m) => {
          const delay = m.built ? 0.4 + order++ * 0.9 : 0.4 + order * 0.9 + (m.n - order - 1) * 0.25
          return (
            <motion.div key={m.n} className={`building-mod ${m.built ? '' : 'later'}`} variants={pathStep} transition={{ delay, duration: 0.45, ease: 'easeOut' }}>
              <div className="building-node">{m.built ? m.n : <Lock size={14} />}</div>
              <div style={{ minWidth: 0 }}>
                <div className="kicker">Module {m.n}{!m.built && ' · coming next'}</div>
                <b>{m.title.split(':')[0]}</b>
                {m.built && (
                  <div className="building-dots">
                    {unitList(m).map((u, k) => (
                      <motion.span key={u.unit} className="building-dot" title={u.label} variants={pathStep} transition={{ delay: delay + 0.25 + k * 0.08, duration: 0.25 }} />
                    ))}
                    <span className="tag-mono">{unitList(m).length} steps</span>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {ready && (
        <motion.div className="building-line" {...popIn}>
          <p><b>Set up {who || 'for you'}.</b> Lessons will be narrated and explained to fit what you already know.</p>
          <Btn variant="primary" onClick={onDone}>Go to the modules <ArrowRight size={14} /></Btn>
        </motion.div>
      )}
    </div>
  )
}
