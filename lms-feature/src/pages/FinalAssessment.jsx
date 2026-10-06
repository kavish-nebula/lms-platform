import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ShieldCheck, RotateCcw, ArrowRight } from 'lucide-react'
import { Btn } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { useCourse } from '../stores/course.js'
import { useLearner } from '../stores/learner.js'
import { COURSE, MODULES } from '../content/course.js'
import { currentModule } from '../engine/progress.js'
import { popIn, fadeUp } from '../motion.js'

/*
  Final assessment — one quiz across every lesson of the course, taken after the
  last available module and the course capstone. The same questions and pass mark for every learner:
  like the module quizzes, it never adapts.
*/
export default function FinalAssessment() {
  const navigate = useNavigate()
  const { questions, passMark } = COURSE.final
  const progress = useCourse((s) => s.progress)
  const final = useCourse((s) => s.final)
  const capstone = useCourse((s) => s.capstone)
  const recordFinal = useCourse((s) => s.recordFinal)
  const { calibrate, demoMode } = useLearner()
  const [phase, setPhase] = useState('intro') // intro | ask | result
  const [idx, setIdx] = useState(0)
  const [choice, setChoice] = useState(null)
  const [answers, setAnswers] = useState([])

  const built = MODULES.filter((m) => m.built)
  const pending = currentModule(progress, calibrate)
  const total = questions.length
  const passPct = Math.round(passMark * 100)
  const q = questions[idx]
  const score = answers.filter(Boolean).length
  const passed = score / total >= passMark

  const answer = (i) => { if (choice === null) { setChoice(i); setAnswers((a) => [...a, i === q.correct]) } }
  const next = () => {
    setChoice(null)
    if (idx + 1 < total) return setIdx(idx + 1)
    recordFinal({ score, total, passed })
    setPhase('result')
  }
  const retake = () => { setIdx(0); setAnswers([]); setChoice(null); setPhase('ask') }

  // it opens only when every available module is complete (demo access opens it early)
  if (pending && !demoMode) {
    return (
      <div className="mt30">
        <GlassCard className="pad-lg center" style={{ maxWidth: 620, margin: '0 auto' }}>
          <div className="kicker mb8">Final assessment · locked</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>Finish the modules first</h1>
          <p className="muted mt8">It covers every lesson, so it opens once every available module is shipped.</p>
          <div className="mt20"><Btn variant="primary" to={`/player/${pending.n}`}>Continue Module {pending.n} <ArrowRight size={14} /></Btn></div>
        </GlassCard>
      </div>
    )
  }

  // …and after the capstone
  if (!capstone && !demoMode) {
    return (
      <div className="mt30">
        <GlassCard className="pad-lg center" style={{ maxWidth: 620, margin: '0 auto' }}>
          <div className="kicker mb8">Final assessment · locked</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>Build the capstone first</h1>
          <p className="muted mt8">Every module is complete. The capstone project comes next — the final assessment opens once it is accepted.</p>
          <div className="mt20"><Btn variant="primary" to="/capstone">Go to the capstone <ArrowRight size={14} /></Btn></div>
        </GlassCard>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <motion.div className="glass pad-lg" style={{ maxWidth: 680, margin: '50px auto' }} {...fadeUp}>
        <div className="kicker mb8">Final assessment</div>
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>Everything, from the first lesson to the last</h1>
        <p className="muted mt8">
          {total} questions — {questions.filter((x) => x.type === 'theory').length} on theory, {questions.filter((x) => x.type === 'scenario').length} scenarios — across
          the lessons of the course. Harder than the module quizzes: each question
          draws on more than one lesson. Pass at {passPct}%. No timer, and you can retake it. It is the same for every learner.
        </p>
        {final && (
          <p className="small mt14">
            <span className={`chip ${final.passed ? 'ok' : 'warn'}`}>{final.passed ? 'passed' : 'not passed yet'}</span>{' '}
            <span className="muted">best {final.best}/{total} · {final.attempts} attempt{final.attempts === 1 ? '' : 's'}</span>
          </p>
        )}
        <div className="row wrap mt20">
          <Btn variant="primary" onClick={() => setPhase('ask')}>{final ? 'Take it again' : 'Start'} <ArrowRight size={14} /></Btn>
          {final?.passed && <Btn to="/complete">See what you’ve built</Btn>}
          <Btn variant="ghost" to={`/course/${COURSE.id}`}>Back to the course</Btn>
        </div>
      </motion.div>
    )
  }

  if (phase === 'result') {
    return (
      <motion.div className="glass pad-lg" style={{ maxWidth: 720, margin: '40px auto' }} {...popIn}>
        <div className="kicker mb8">Final assessment</div>
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>{passed ? 'Passed — the course is complete.' : 'Not yet — and that’s normal.'}</h1>
        <p className="mt14">
          <ShieldCheck size={18} color={passed ? 'var(--ok)' : 'var(--amber)'} style={{ verticalAlign: -3, marginRight: 6 }} />
          <b>{score}/{total}</b> — {passed ? 'above' : 'below'} the {passPct}% line
        </p>
        {questions.map((x, i) => !answers[i] && (
          <div key={i} className="glass mt14" style={{ padding: 14 }}>
            <p className="small" style={{ fontWeight: 600 }}>✗ {x.q}</p>
            <p className="muted small mt8">{x.explain} <span className="tag-mono">· {x.type} · lessons {x.subs.join(', ')}</span></p>
          </div>
        ))}
        <div className="row between wrap mt20">
          <Btn onClick={retake}><RotateCcw size={14} /> Take it again</Btn>
          {passed
            ? <Btn variant="primary" onClick={() => navigate('/complete')}>See everything you’ve built <ArrowRight size={14} /></Btn>
            : <Btn variant="ghost" to={`/course/${COURSE.id}`}>Revisit the lessons</Btn>}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="glass pad-lg" style={{ maxWidth: 680, margin: '50px auto' }} {...fadeUp} key={idx}>
      <div className="row between mb8">
        <div className="kicker">Final assessment · {idx + 1}/{total}</div>
        <span className="row" style={{ gap: 6 }}>
          <span className={`chip ${q.type === 'scenario' ? 'warn' : 'info'}`}>{q.type === 'scenario' ? 'Scenario' : 'Theory'}</span>
          <span className="chip">lessons {q.subs.join(' · ')}</span>
        </span>
      </div>
      <div className="progress"><div style={{ width: `${(idx / total) * 100}%` }} /></div>
      <h1 style={{ fontSize: 23, margin: '22px 0 16px', lineHeight: 1.4 }}>{q.q}</h1>
      {q.options.map((o, i) => {
        const cls = choice === null ? '' : i === q.correct ? 'right' : choice === i ? 'wrong' : ''
        return <button key={i} type="button" className={`opt ${cls}`} onClick={() => answer(i)}>{o}</button>
      })}
      {choice !== null && (
        <motion.div {...popIn} aria-live="polite">
          <p className="small mt14">
            <b style={{ color: choice === q.correct ? 'var(--ok-ink)' : 'var(--err)' }}>{choice === q.correct ? 'Right — ' : 'Not quite — '}</b>
            {q.explain}
          </p>
          <div className="row between mt14">
            <span className="tag-mono">score so far: {score}/{answers.length}</span>
            <Btn variant="primary" size="sm" onClick={next}>{idx + 1 < total ? 'Next question →' : 'See result →'}</Btn>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
