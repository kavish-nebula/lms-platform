import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, BookOpen, Layers, PackageCheck, HeartPulse, Lock, Check, ArrowRight } from 'lucide-react'
import { Btn, SectionTitle, StatTile } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import ProgressRing from '../ui/ProgressRing.jsx'
import { useLearner, useAdaptation } from '../stores/learner.js'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { usePortfolio } from '../stores/portfolio.js'
import { usePatch } from '../stores/patch.js'
import { usePlanData } from '../stores/plan.js'
import { COURSE, MODULES, BINGO } from '../content/course.js'
import { COURSES } from '../content/catalog.js'
import { LEARNER } from '../content/session.js'
import { courseNext, courseProgress, isEnrolled, fmtMinutes } from '../engine/progress.js'
import { startOfDay, addDays, dayKey } from '../engine/plan.js'
import { popIn } from '../motion.js'

/* One health check = a mini maintenance scenario. */
function HealthCheck({ item }) {
  const [choice, setChoice] = useState(null)
  const complete = useReview((s) => s.complete)
  const pushPatch = usePatch((s) => s.push)
  const right = choice === item.correct
  // true only when a Field Notes card is earned by this very check
  const earnsNote = BINGO.some((b) => !b.check({ stage: () => false, reviewDone: () => false }) && b.check({ stage: () => false, reviewDone: (id) => id === item.id }))

  return (
    <motion.div className="glass role-card reveal-card" {...popIn}>
      <div className="row between mb8">
        <div className="row" style={{ gap: 8 }}>
          <HeartPulse size={16} color="var(--accent-ink)" />
          <b className="small">{item.title}</b>
        </div>
        <span className="chip warn">review due</span>
      </div>
      <p className="small">{item.scenario}</p>
      <div className="mt14">
        {item.options.map((o, i) => (
          <button key={i} className={`opt ${choice !== null && i === item.correct ? 'right' : ''} ${choice === i && !right ? 'wrong' : ''}`} onClick={() => setChoice(i)}>
            {o}
          </button>
        ))}
      </div>
      {choice !== null && (
        <motion.div {...popIn}>
          <p className="small">
            <b style={{ color: right ? 'var(--ok-ink)' : 'var(--err)' }}>{right ? 'Correct — ' : 'Not quite — '}</b>
            {item.explain}
          </p>
          <div className="row between mt14">
            <span className="tag-mono">logged in your review history{earnsNote ? ' · field note earned' : ''}</span>
            <Btn size="sm" variant={right ? 'primary' : ''} onClick={() => { complete(item.id); if (earnsNote) pushPatch('New field note unlocked — see Field Notes on the course page.') }}>
              Mark handled <Check size={13} />
            </Btn>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

/* Left column: every module at a glance; the current one opens up into its steps. */

/* The next seven days from the Learning Plan, and what is planned next. */
function WeekTeaser() {
  const { days, remaining } = usePlanData()
  const today = startOfDay(Date.now())
  const week = Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i); return { date, items: days[dayKey(date)] || [] } })
  const planned = week.flatMap((d) => d.items.filter((it) => it.type === 'session' && !it.done))
  const nextDay = week.find((d) => d.items.some((it) => it.type === 'session' && !it.done))
  const nextItem = nextDay?.items.find((it) => it.type === 'session' && !it.done)
  return (
    <GlassCard>
      <div className="week-mini">
        {week.map((d, i) => {
          const open = d.items.some((it) => !it.done)
          return (
            <div key={i} className={`week-mini-day ${open ? 'has' : d.items.length ? 'done' : ''} ${i === 0 ? 'today' : ''}`}>
              {d.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
              <b>{d.date.getDate()}</b>
            </div>
          )
        })}
      </div>
      <p className="small mt14">
        <b>{planned.length}</b> session{planned.length === 1 ? '' : 's'} planned in the next 7 days
        {planned.length > 0 && <> · <b>{fmtMinutes(planned.reduce((n, it) => n + it.minutes, 0))}</b></>}
      </p>
      <p className="muted small">
        {nextItem
          ? `Next planned: ${nextItem.label} · ${nextDay.date.toLocaleDateString(undefined, { weekday: 'long' })}`
          : remaining.length ? 'Nothing planned yet — add a session, or let the plan lay it out for you.' : 'Nothing left to plan — reviews land on their dates.'}
      </p>
      <div className="mt14"><Btn to="/plan" size="sm">Open the plan <ArrowRight size={13} /></Btn></div>
    </GlassCard>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}

/* "today", "yesterday", "3 days ago" */
function ago(t) {
  const days = Math.round((startOfDay(Date.now()).getTime() - startOfDay(t).getTime()) / 86400000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/* A course in the catalogue: the open one leads to its page, the rest are coming. */
function CourseCard({ course }) {
  return (
    <GlassCard hover={course.open} className={course.open ? 'course-card' : 'course-card locked-card'}>
      <span className={`chip ${course.open ? 'acc' : ''}`}>{course.open ? 'open now' : <><Lock size={11} /> coming soon</>}</span>
      <h3 style={{ margin: '12px 0 8px' }}>{course.title}</h3>
      <p className="muted small">{course.problem}</p>
      {course.open && <div className="mt14"><Btn variant="primary" size="sm" to={`/course/${course.id}`}>View course <ArrowRight size={13} /></Btn></div>}
    </GlassCard>
  )
}

/*
  Dashboard — the learner's home across courses. It works at course level only:
  the learner's own courses to continue, this week's plan, reviews that are due,
  and a few totals. Browsing other courses happens on the Courses page; modules,
  the stack and field notes live on a course's own page.
*/
export default function Dashboard() {
  const { profile, calibrate, precheck } = useLearner()
  const adapt = useAdaptation()
  const progress = useCourse((s) => s.progress)
  const last = useCourse((s) => s.last)
  const capstone = useCourse((s) => s.capstone)
  const final = useCourse((s) => s.final)
  const reviewItems = useReview((s) => s.items)
  const due = reviewItems.filter((r) => !r.done && r.dueAt <= Date.now())
  const artifactsN = usePortfolio((s) => s.artifacts.length)

  const enrolled = isEnrolled(precheck, progress)
  const overall = courseProgress(progress)
  const next = courseNext({ progress, calibrate, last, capstone, final, order: adapt.order })
  const complete = !!final?.passed
  const built = MODULES.filter((m) => m.built)
  const modulesDone = built.filter((m) => progress[m.n]?.completed).length

  // the learner's goal decides which number the dashboard leads with
  const lead = { work: 'modules', ideas: 'modules', portfolio: 'artifacts' }[adapt.goal]
  const tiles = [
    { id: 'courses', icon: BookOpen, value: enrolled && !complete ? 1 : 0, label: 'course in progress' },
    { id: 'modules', icon: Layers, tone: 'amber', value: modulesDone, unit: `/${built.length}`, label: 'modules completed' },
    { id: 'artifacts', icon: PackageCheck, tone: 'ok', value: artifactsN, label: 'portfolio artifacts' },
  ].sort((a, b) => Number(b.id === lead) - Number(a.id === lead))

  /* A dot per active day. Missing days changes nothing. */
  const rhythm = useMemo(() => {
    const marks = [
      ...Object.values(progress).flatMap((m) => [m.completedAt, ...Object.values(m.stages || {})]),
      ...reviewItems.map((r) => r.doneAt),
    ].filter((t) => typeof t === 'number')
    const today = startOfDay(Date.now())
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, i - 13)
      const end = addDays(date, 1).getTime()
      return { date, on: marks.some((t) => t >= date.getTime() && t < end), today: i === 13 }
    })
  }, [progress, reviewItems])

  return (
    <div className="mt14">
      <section className="hero-band">
        <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Dashboard</div>
            <h1>{greeting()}, {LEARNER.name}.</h1>
            <p className="muted mt8">
              {!enrolled
                ? 'Pick a course to begin. A few questions about you and a short pre-assessment set it up for you.'
                : due.length ? `${due.length} review${due.length > 1 ? 's are' : ' is'} due below.` : 'Nothing is due — carry on where you left off.'}
            </p>
          </div>
          {profile && <Btn to="/profile" variant="ghost">How courses adapt to you</Btn>}
        </div>
      </section>

      {!enrolled ? (
        <>
          <SectionTitle kicker="Start here" title="Choose your first course" sub="Open a course to see what it covers. Starting it takes three steps: a few questions about you, a short pre-assessment, then the course set up for you." />
          <div className="grid c3">
            {COURSES.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </>
      ) : (
        <>
          <SectionTitle kicker="Your courses" title="Continue learning" right={<Btn size="sm" variant="ghost" to="/catalog">Browse all courses <ArrowRight size={13} /></Btn>} />
          <GlassCard hover className="continue-card">
            <ProgressRing value={complete ? 1 : overall.value} size={72} stroke={7} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="tag-mono">
                {complete ? 'completed' : `${modulesDone} of ${built.length} modules completed`}
                {next.at ? ` · last opened ${ago(next.at)}` : ''}
              </div>
              <h2 style={{ marginTop: 4, fontSize: 'var(--fs-lg)' }}>{COURSE.title}</h2>
              <p className="muted small" style={{ marginTop: 4 }}><b>Next up:</b> {next.line}</p>
            </div>
            <div className="row wrap">
              <Btn to={`/course/${COURSE.id}`}>Course page</Btn>
              <Btn variant="primary" to={next.to} state={next.state}><Play size={14} /> {next.cta}</Btn>
            </div>
          </GlassCard>

          {due.length > 0 && (
            <div className="stack-v mt20">
              <SectionTitle kicker={COURSE.title} title={`${due.length} review${due.length > 1 ? 's' : ''} due`} sub="Short scenarios from lessons you finished — they keep what you learned in working order." />
              <AnimatePresence>
                {due.map((item) => <HealthCheck key={item.id} item={item} />)}
              </AnimatePresence>
            </div>
          )}

          <div className="grid c3 mt20">
            {tiles.map((t) => (
              <div key={t.id} className={t.id === lead ? 'lead-tile' : ''}>
                <StatTile icon={t.icon} tone={t.tone} value={t.value} unit={t.unit} label={t.id === lead ? `${t.label} · your goal` : t.label} />
              </div>
            ))}
          </div>

          <div className="grid c2">
            <div>
              <SectionTitle kicker="Learning plan" title="This week" />
              <WeekTeaser />
            </div>
            <div>
              <SectionTitle kicker="Activity" title="Last 14 days" sub="A dot per day you studied. Missing days changes nothing." />
              <GlassCard>
                <div className="rhythm">
                  {rhythm.map((d) => (
                    <div key={d.date.getTime()} className={`rhythm-day ${d.today ? 'today' : ''}`} title={d.date.toLocaleDateString()}>
                      <div className={`rhythm-dot ${d.on ? 'on' : ''}`}>{d.on && <Check size={11} strokeWidth={3} />}</div>
                      {d.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
