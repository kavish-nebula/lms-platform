import { Link, useNavigate, useParams } from 'react-router-dom'
import { Play, Lock, CheckCircle2, RotateCcw, ShieldCheck, Hammer, ArrowRight, Route, Workflow, NotebookPen } from 'lucide-react'
import { Btn, SectionTitle } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import ProgressRing from '../ui/ProgressRing.jsx'
import ModuleSteps from '../ui/ModuleSteps.jsx'
import StackPage from './StackPage.jsx'
import BingoPage from './BingoPage.jsx'
import { useCourse } from '../stores/course.js'
import { useLearner, useAdaptation } from '../stores/learner.js'
import { COURSE, MODULES, STAGE_MINUTES } from '../content/course.js'
import { CAPSTONE } from '../content/capstone.js'
import { courseProgress, currentModule, isEnrolled, isUnlocked, moduleMinutes, moduleProgress, fmtMinutes } from '../engine/progress.js'
import { QUESTIONS } from '../content/profile.js'

const TABS = [
  ['', 'Course path', Route],
  ['stack', 'Stack', Workflow],
  ['notes', 'Field notes', NotebookPen],
]

/*
  Before the learner starts the course: what it covers, and the way in —
  a few questions about them (first course only), then the pre-assessment.
*/
function Overview() {
  const navigate = useNavigate()
  const hasProfile = useLearner((s) => !!s.profile)
  const built = MODULES.filter((m) => m.built)
  const minutes = built.reduce((n, m) => n + moduleMinutes(m), 0) + STAGE_MINUTES.project
  const start = () => (hasProfile ? navigate('/precheck') : navigate('/onboarding', { state: { next: 'precheck' } }))
  const steps = [
    ...(hasProfile ? [] : [`${QUESTIONS.length} questions about you`]),
    'A short pre-assessment',
    'Your course, set up for you',
  ]
  return (
    <div>
      <section className="hero-band mt14">
        <div className="kicker">Course</div>
        <h1>{COURSE.title}</h1>
        <p className="muted mt8" style={{ maxWidth: 760 }}>{COURSE.problem}</p>
        <p className="small mt8" style={{ maxWidth: 760 }}><b>By the end: </b>{COURSE.goal}</p>
        <div className="row wrap mt20" style={{ gap: 16 }}>
          <Btn variant="light" onClick={start}>Start this course <ArrowRight size={14} /></Btn>
          <span className="start-steps small">
            {steps.map((s, i) => <span key={s}><span className="n">{i + 1}</span>{s}</span>)}
          </span>
        </div>
        <p className="tag-mono mt14">
          {built.length} of {MODULES.length} modules available · about {fmtMinutes(minutes)} · one capstone project · final assessment
          {hasProfile ? ' · your profile is already set, so it goes straight to the pre-assessment' : ''}
        </p>
      </section>

      <SectionTitle kicker="What’s inside" title="Modules, then a capstone, then the final assessment" sub="Each module: three lessons with explained builds and scenario checks, one guided practice, and a quiz." />
      <div className="grid c2">
        {MODULES.map((m) => (
          <GlassCard key={m.n} className={m.built ? '' : 'locked-card'}>
            <div className="row between">
              <div className="kicker">Module {m.n}</div>
              {!m.built && <span className="chip"><Lock size={11} /> coming next</span>}
            </div>
            <h3 style={{ marginTop: 3 }}>{m.title}</h3>
            <p className="muted small mt8">{m.pain}</p>
            <div className="row wrap mt14" style={{ gap: 6 }}>
              {m.submodules.map((sm) => <span key={sm.id} className="chip">{sm.id} · {sm.title}</span>)}
            </div>
          </GlassCard>
        ))}
        <GlassCard>
          <div className="kicker"><Hammer size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Capstone project</div>
          <h3 style={{ marginTop: 3 }}>{CAPSTONE.project.title}</h3>
          <p className="muted small mt8">One big build after the last module that uses every lesson, checked against an acceptance list and saved to your portfolio.</p>
        </GlassCard>
        <GlassCard>
          <div className="kicker"><ShieldCheck size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Final assessment</div>
          <h3 style={{ marginTop: 3 }}>Everything, from the first lesson to the last</h3>
          <p className="muted small mt8">{COURSE.final.questions.length} harder questions — theory and scenarios — after the capstone. Pass at {Math.round(COURSE.final.passMark * 100)}%.</p>
        </GlassCard>
      </div>
    </div>
  )
}

export default function Course() {
  const { tab = '' } = useParams()
  const precheck = useLearner((s) => s.precheck)
  const progress = useCourse((s) => s.progress)
  const final = useCourse((s) => s.final)
  const capstone = useCourse((s) => s.capstone)
  const { demoMode, calibrate } = useLearner()
  const { paceFactor } = useAdaptation()
  const current = currentModule(progress, calibrate)
  const overall = courseProgress(progress)
  const finalLocked = !!current || !capstone // the final assessment comes after the capstone
  // Demo access: the locks stay on screen, as a learner would see them, but everything opens when clicked
  const lockedOpen = (to, label = 'Open') => <Btn size="sm" to={to} title="Locked for a learner — open for this demo"><Lock size={12} /> {label}</Btn>

  if (!isEnrolled(precheck, progress)) return <Overview />

  return (
    <div>
      <section className="hero-band mt14">
        <div className="row between wrap" style={{ gap: 24 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="kicker">Course</div>
            <h1>{COURSE.title}</h1>
            <p className="muted mt8" style={{ maxWidth: 760 }}>{COURSE.problem}</p>
            <p className="small mt8" style={{ maxWidth: 760 }}><b>By the end: </b>{COURSE.goal}</p>
            {demoMode && (
              <p className="small mt14">
                <span className="chip">demo access on — locks are shown, but everything opens when clicked</span>
                <span className="tag-mono" style={{ marginLeft: 8 }}>turn it off in Profile for real sequential unlocking</span>
              </p>
            )}
          </div>
          <div className="center">
            <ProgressRing value={overall.value} size={96} stroke={8} />
            <div className="tag-mono mt8">{overall.done}/{overall.total} steps in available modules</div>
          </div>
        </div>
      </section>

      <nav className="course-tabs" aria-label="Course sections">
        {TABS.map(([id, label, Icon]) => (
          <Link key={id} to={`/course/${COURSE.id}${id ? `/${id}` : ''}`} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined}><Icon size={14} /> {label}</Link>
        ))}
      </nav>

      {tab === 'stack' && <StackPage embedded />}
      {tab === 'notes' && <BingoPage embedded />}

      {tab === '' && <>
      <SectionTitle kicker="The path" title={`${MODULES.length} modules of Nebula’s problems · ${MODULES.filter((m) => m.built).length} available now`} sub="Each module: lessons with explained builds and scenario checks, one guided practice and a quiz. After the last module comes one capstone project, then a final assessment that covers everything." />

      <div className="timeline">
        {MODULES.map((m) => {
          const prog = progress[m.n]
          const done = !!prog?.completed
          const unlocked = isUnlocked(m, progress, { calibrate }) // what a learner has really unlocked
          const openable = m.built && (unlocked || demoMode)
          const isCurrent = unlocked && current?.n === m.n
          const p = moduleProgress(prog, m)
          return (
            <div key={m.n} className={`timeline-item ${done ? 'done' : ''} ${unlocked ? '' : 'locked'}`}>
              <div className="timeline-node">
                {m.built ? <ProgressRing value={p.value} size={46} /> : <Lock size={16} color="var(--faint)" />}
              </div>
              <GlassCard hover={openable}>
                <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="kicker">Module {m.n}</div>
                    <h3 style={{ marginTop: 3 }}>{m.title}</h3>
                    <p className="muted small mt8" style={{ maxWidth: 640 }}>{m.pain}</p>
                  </div>
                  {done ? (
                    <span className="row">
                      <span className="chip ok"><CheckCircle2 size={12} /> shipped</span>
                      <Btn size="sm" variant="ghost" to={`/player/${m.n}`}><RotateCcw size={13} /> Review</Btn>
                    </span>
                  ) : unlocked ? (
                    <Btn variant={isCurrent ? 'primary' : ''} size="sm" to={`/player/${m.n}`}>
                      <Play size={13} /> {isCurrent ? (p.done ? 'Continue' : 'Start') : 'Open'}
                    </Btn>
                  ) : openable ? (
                    <span className="row"><span className="chip"><Lock size={11} /> locked</span>{lockedOpen(`/player/${m.n}`)}</span>
                  ) : (
                    <span className="chip"><Lock size={11} /> {m.built ? 'locked' : 'coming next'}</span>
                  )}
                </div>

                {m.built && <ModuleSteps m={m} prog={prog} className="mt14" />}

                <p className="tag-mono mt14">
                  {m.built ? `${p.done}/${p.total} steps · about ${fmtMinutes(moduleMinutes(m, paceFactor))}` : m.submodules.map((s) => s.title).join(' · ')}
                  {' · '}+{m.hrsSaved} hrs/wk when shipped
                </p>
              </GlassCard>
            </div>
          )
        })}
        {/* after the last module: one project that uses everything */}
        <div className={`timeline-item ${capstone ? 'done' : ''} ${current ? 'locked' : ''}`}>
          <div className="timeline-node"><Hammer size={19} color={capstone ? 'var(--ok)' : 'var(--accent-ink)'} /></div>
          <GlassCard hover={!current}>
            <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="kicker">Capstone project</div>
                <h3 style={{ marginTop: 3 }}>{CAPSTONE.project.title}</h3>
                <p className="muted small mt8" style={{ maxWidth: 640 }}>
                  One big build that uses every lesson: a brief with requirements and edge cases, no step-by-step help, and an
                  acceptance check at the end. Opens once every module is complete.
                </p>
              </div>
              {capstone ? (
                <span className="row">
                  <span className="chip ok"><CheckCircle2 size={12} /> accepted</span>
                  <Btn size="sm" variant="ghost" to="/capstone"><RotateCcw size={13} /> Rebuild</Btn>
                </span>
              ) : !current ? (
                <Btn variant="primary" size="sm" to="/capstone"><Play size={13} /> Start</Btn>
              ) : (
                <span className="row wrap"><span className="chip"><Lock size={11} /> opens when every module is complete</span>{demoMode && lockedOpen('/capstone')}</span>
              )}
            </div>
            <p className="tag-mono mt14">about {fmtMinutes(STAGE_MINUTES.project)} · saved to your portfolio · unlocks the final assessment</p>
          </GlassCard>
        </div>

        {/* the last stop: one assessment across every lesson */}
        <div className={`timeline-item ${final?.passed ? 'done' : ''} ${finalLocked ? 'locked' : ''}`}>
          <div className="timeline-node"><ShieldCheck size={20} color={final?.passed ? 'var(--ok)' : 'var(--accent-ink)'} /></div>
          <GlassCard hover={!finalLocked}>
            <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="kicker">Final assessment</div>
                <h3 style={{ marginTop: 3 }}>Everything, from the first lesson to the last</h3>
                <p className="muted small mt8" style={{ maxWidth: 640 }}>
                  {COURSE.final.questions.length} harder questions — theory and scenarios — each mixing ideas from more than one lesson.
                  Opens once the capstone is accepted. The same for every learner.
                </p>
              </div>
              {final?.passed ? (
                <span className="row">
                  <span className="chip ok"><CheckCircle2 size={12} /> passed · {final.best}/{COURSE.final.questions.length}</span>
                  <Btn size="sm" variant="ghost" to="/final"><RotateCcw size={13} /> Retake</Btn>
                </span>
              ) : !finalLocked ? (
                <Btn variant="primary" size="sm" to="/final"><Play size={13} /> {final ? 'Try again' : 'Start'}</Btn>
              ) : (
                <span className="row wrap"><span className="chip"><Lock size={11} /> opens after the capstone</span>{demoMode && lockedOpen('/final')}</span>
              )}
            </div>
            <p className="tag-mono mt14">pass at {Math.round(COURSE.final.passMark * 100)}% · no timer · retakes allowed</p>
          </GlassCard>
        </div>
      </div>
      </>}
    </div>
  )
}
