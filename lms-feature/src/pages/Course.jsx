import { Link, useNavigate, useParams } from 'react-router-dom'
import { Play, Lock, RotateCcw, ShieldCheck, Hammer, ArrowRight, Route, Workflow, NotebookPen } from 'lucide-react'
import { Btn, SectionTitle } from '../ui/bits.jsx'
import ProgressRing from '../ui/ProgressRing.jsx'
import ModuleRail from '../ui/ModuleRail.jsx'
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
  One module as a rail card — "Module 3 of 4", progress, and the way in.
  The whole card opens the module when it can be opened; locked cards say so.
*/
function ModuleCard({ m, i, total, prog, openable, current, paceFactor = 1, preview = false }) {
  const done = !!prog?.completed
  const p = moduleProgress(prog, m)
  const locked = !preview && !openable
  const link = !preview && openable
  const status = preview
    ? `${m.submodules.length} lessons`
    : done ? 'shipped' : current ? (p.done ? 'in progress' : 'up next') : openable ? 'open' : 'locked'
  const smDone = (sm) =>
    m.lite ? !!prog?.stages?.[`${sm.id}-explain`] : ['explain', 'worked', 'scenarios'].every((k) => prog?.stages?.[`${sm.id}-${k}`])
  const cls = `glass rail-card ${link ? 'hover link' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${current ? 'current' : ''}`
  const inner = (
    <>
      <div className={`rail-cover tone-${m.n}`}>
        <span className="rail-num" aria-hidden="true">{m.n}</span>
        <div className="rail-cover-copy">
          <span className="rail-of">Module {i} of {total}</span>
          <span className={`rail-status ${done ? 'ok' : ''}`}>{status}</span>
        </div>
        {!preview && <span className="rail-ring"><ProgressRing value={p.value} size={46} stroke={5} /></span>}
        {preview && <span className="rail-ring rail-time tag-mono">≈ {fmtMinutes(moduleMinutes(m))}</span>}
        {locked && <Lock className="rail-lock" size={16} aria-hidden="true" />}
      </div>
      <div className="rail-body">
        <h3>{m.title}</h3>
        <p className="muted small">{m.pain}</p>
        <div className="row wrap" style={{ gap: 6 }}>
          {m.submodules.map((sm) => (
            <span key={sm.id} className={`chip ${!preview && smDone(sm) ? 'ok' : ''}`}>{sm.id} · {sm.title}</span>
          ))}
        </div>
        <p className="tag-mono">
          {preview
            ? `≈ ${fmtMinutes(moduleMinutes(m))} · +${m.hrsSaved} hrs/wk when shipped`
            : `${p.done}/${p.total} steps · ≈ ${fmtMinutes(moduleMinutes(m, paceFactor))} · +${m.hrsSaved} hrs/wk when shipped`}
        </p>
        {!preview && (
          <div className="rail-cta">
            {link ? (
              <span className="rail-open">
                {done
                  ? <><RotateCcw size={13} /> Review module</>
                  : <><Play size={13} /> {current ? (p.done ? 'Continue' : 'Start module') : 'Open module'}</>}
              </span>
            ) : (
              <span className="rail-locked-note"><Lock size={12} /> opens after module {m.n - 1}</span>
            )}
          </div>
        )}
      </div>
    </>
  )
  return link ? (
    <Link to={`/player/${m.n}`} className={cls} aria-label={`Module ${m.n}: ${m.title}`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

/* The two stops after the modules: the capstone project, then the final assessment. */
function StopCard({ icon: Icon, kicker, title, sub, meta, open, to, done, lockedNote, preview = false }) {
  const link = !preview && open
  const cls = `glass rail-card stop ${link ? 'hover link' : ''} ${done ? 'done' : ''} ${!preview && !open ? 'locked' : ''}`
  const inner = (
    <>
      <div className="rail-cover">
        <span className="rail-num" aria-hidden="true"><Icon size={30} strokeWidth={1.8} /></span>
        <div className="rail-cover-copy">
          <span className="rail-of">{kicker}</span>
          <span className={`rail-status ${done ? 'ok' : ''}`}>{preview ? 'at the end' : done ? 'done' : open ? 'ready' : 'locked'}</span>
        </div>
        {!preview && !open && <Lock className="rail-lock" size={16} aria-hidden="true" />}
      </div>
      <div className="rail-body">
        <h3>{title}</h3>
        <p className="muted small">{sub}</p>
        <p className="tag-mono">{meta}</p>
        {!preview && (
          <div className="rail-cta">
            {link ? (
              <span className="rail-open">{done ? <><RotateCcw size={13} /> Revisit</> : <><Play size={13} /> Start</>}</span>
            ) : (
              <span className="rail-locked-note"><Lock size={12} /> {lockedNote}</span>
            )}
          </div>
        )}
      </div>
    </>
  )
  return link ? <Link to={to} className={cls} aria-label={`${kicker}: ${title}`}>{inner}</Link> : <div className={cls}>{inner}</div>
}

/*
  Before the learner starts the course: what it covers, and the way in —
  a few questions about them (first course only), then the pre-assessment.
*/
function Overview() {
  const navigate = useNavigate()
  const hasProfile = useLearner((s) => !!s.profile)
  const minutes = MODULES.reduce((n, m) => n + moduleMinutes(m), 0) + STAGE_MINUTES.project
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
        <div className="rail-skills mt14">
          <span className="skills-label">Skills you&rsquo;ll gain</span>
          {COURSE.skills.map((s) => <span key={s} className="chip">{s}</span>)}
        </div>
        <div className="row wrap mt20" style={{ gap: 16 }}>
          <Btn variant="light" onClick={start}>Start this course <ArrowRight size={14} /></Btn>
          <span className="start-steps small">
            {steps.map((s, i) => <span key={s}><span className="n">{i + 1}</span>{s}</span>)}
          </span>
        </div>
        <p className="tag-mono mt14">
          {MODULES.length} modules · about {fmtMinutes(minutes)} · one capstone project · final assessment
          {hasProfile ? ' · your profile is already set, so it goes straight to the pre-assessment' : ''}
        </p>
      </section>

      <SectionTitle
        kicker="What’s inside"
        title={`${MODULES.length} modules, then a capstone, then the final assessment`}
        sub="Move through the strip with the arrows. Each module is one chapter of Nebula’s story — lessons with explained builds and scenario checks, guided practice, and a quiz."
      />
      <ModuleRail>
        {MODULES.map((m, i) => (
          <ModuleCard key={m.n} m={m} i={i + 1} total={MODULES.length} preview />
        ))}
        <StopCard
          icon={Hammer} kicker="After the modules" title={CAPSTONE.project.title} preview
          sub="One big build that uses every lesson: a brief with requirements and edge cases, no step-by-step help, and an acceptance check at the end."
          meta={`about ${fmtMinutes(STAGE_MINUTES.project)} · saved to your portfolio`}
        />
        <StopCard
          icon={ShieldCheck} kicker="The last stop" title="Everything, from the first lesson to the last" preview
          sub={`${COURSE.final.questions.length} harder questions — theory and scenarios — each mixing ideas from more than one lesson. The same for every learner.`}
          meta={`pass at ${Math.round(COURSE.final.passMark * 100)}% · no timer · retakes allowed`}
        />
      </ModuleRail>
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
      <SectionTitle
        kicker="The path" title={`${MODULES.length} modules of Nebula’s problems · all ${MODULES.length} available now`}
        sub="Move through the strip with the arrows. Each card is one module — lessons with explained builds and scenario checks, guided practice and a quiz. After the last module come the capstone and the final assessment."
      />

      <ModuleRail>
        {MODULES.map((m, i) => {
          const prog = progress[m.n]
          const unlocked = isUnlocked(m, progress, { calibrate }) // what a learner has really unlocked
          const openable = m.built && (unlocked || demoMode)
          return (
            <ModuleCard
              key={m.n} m={m} i={i + 1} total={MODULES.length} prog={prog}
              openable={openable} current={unlocked && current?.n === m.n} paceFactor={paceFactor}
            />
          )
        })}
        {/* after the last module: one project that uses everything */}
        <StopCard
          icon={Hammer} kicker="After the modules" title={CAPSTONE.project.title} to="/capstone"
          sub="One big build that uses every lesson: a brief with requirements and edge cases, no step-by-step help, and an acceptance check at the end."
          meta={`about ${fmtMinutes(STAGE_MINUTES.project)} · saved to your portfolio · unlocks the final assessment`}
          open={demoMode || !current || !!capstone} done={!!capstone} lockedNote="opens when every module is complete"
        />
        {/* the last stop: one assessment across every lesson */}
        <StopCard
          icon={ShieldCheck} kicker="The last stop" title="Everything, from the first lesson to the last" to="/final"
          sub={`${COURSE.final.questions.length} harder questions — theory and scenarios — each mixing ideas from more than one lesson. The same for every learner.`}
          meta={`pass at ${Math.round(COURSE.final.passMark * 100)}% · no timer · retakes allowed`}
          open={demoMode || !finalLocked} done={!!final?.passed} lockedNote="opens after the capstone"
        />
      </ModuleRail>
      </>}
    </div>
  )
}
