import { motion } from 'motion/react'
import { Activity, Clock3, Package, HeartPulse, NotebookPen, Download, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Btn, SectionTitle, StatTile } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { useLearner, useAdaptation } from '../stores/learner.js'
import { usePortfolio, downloadArtifact } from '../stores/portfolio.js'
import { COURSE, MODULES, BINGO } from '../content/course.js'
import { LEARNER } from '../content/session.js'
import { currentModule } from '../engine/progress.js'
import { stagger, staggerChild } from '../motion.js'

/*
  The end of the course as it stands today: everything available is shipped.
  Shows the evidence — what was built, what it saves, what is still scheduled —
  and says plainly which modules are still to come.
*/
export default function Complete() {
  const progress = useCourse((s) => s.progress)
  const reviews = useReview((s) => s.items)
  const artifacts = usePortfolio((s) => s.artifacts)
  const { calibrate, drillsDone, demoMode } = useLearner()
  const final = useCourse((s) => s.final)
  const { goal } = useAdaptation()

  const built = MODULES.filter((m) => m.built)
  const coming = MODULES.filter((m) => !m.built)
  const shipped = built.filter((m) => progress[m.n]?.completed)
  const next = currentModule(progress, calibrate)
  const hours = shipped.reduce((n, m) => n + m.hrsSaved, 0)
  const pending = reviews.filter((r) => !r.done).sort((a, b) => a.dueAt - b.dueAt)
  const ctx = {
    stage: (n, key) => !!progress[n]?.stages?.[key],
    reviewDone: (id) => !!reviews.find((r) => r.id === id)?.done,
    capstone: !!useCourse.getState().capstone,
  }
  const notes = BINGO.filter((b) => b.check(ctx)).length
  const name = `, ${LEARNER.name}`

  if (next && !(demoMode && final?.passed)) {
    return (
      <div className="mt30">
        <GlassCard className="pad-lg center" style={{ maxWidth: 620, margin: '0 auto' }}>
          <div className="kicker mb8">Not there yet</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>{shipped.length} of {built.length} available modules shipped</h1>
          <p className="muted mt8">This page fills in once every available module is finished.</p>
          <div className="mt20"><Btn variant="primary" to={`/player/${next.n}`}>Continue Module {next.n} <ArrowRight size={14} /></Btn></div>
        </GlassCard>
      </div>
    )
  }

  // the modules are shipped but the course isn't complete until the final assessment is passed
  if (!final?.passed) {
    return (
      <div className="mt30">
        <GlassCard className="pad-lg center" style={{ maxWidth: 620, margin: '0 auto' }}>
          <div className="kicker mb8">One thing left</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>Every module is shipped — now the capstone and the final assessment</h1>
          <p className="muted mt8">Both are at the end of the course page: the capstone project first, then the final assessment. Pass it and the course is complete.</p>
          <div className="mt20"><Btn variant="primary" to={`/course/${COURSE.id}`}>Go to the course page <ArrowRight size={14} /></Btn></div>
        </GlassCard>
      </div>
    )
  }

  const headline = {
    work: `${hours} hours a week of manual work, automated.`,
    portfolio: `${artifacts.length} working workflow${artifacts.length === 1 ? '' : 's'} in your portfolio.`,
    ideas: `${built.reduce((n, m) => n + m.submodules.length, 0)} ideas, each one built and defended.`,
  }[goal] || 'Every available module, shipped.'

  return (
    <div>
      <section className="hero-band mt14">
        <div className="kicker">Course complete{coming.length ? ' — so far' : ''}</div>
        <h1>{headline}</h1>
        <p className="muted mt8" style={{ maxWidth: 760 }}>
          Well done{name}. You finished everything available in <b>{COURSE.title}</b> — {shipped.map((m) => m.title.split(':')[0]).join(' and ')} — built the capstone and passed the final assessment.
          What you built is below, with the checks it passed.
        </p>
        <div className="row wrap mt20">
          <Btn variant="light" to="/portfolio">Open your portfolio <ArrowRight size={14} /></Btn>
          <Btn variant="ghost" to={`/course/${COURSE.id}/stack`}>See the stack</Btn>
          <Btn variant="ghost" to="/dashboard">Dashboard</Btn>
        </div>
      </section>

      <div className="grid c4 mt20">
        <StatTile icon={Activity} value={final.best} unit={`/${final.last.total}`} label={`final assessment · ${shipped.length} of ${built.length} modules shipped`} />
        <StatTile icon={Clock3} tone="amber" value={hours} unit="hrs/wk" label="of manual work automated" />
        <StatTile icon={Package} tone="ok" value={artifacts.length} label={`portfolio artifact${artifacts.length === 1 ? '' : 's'}`} />
        <StatTile icon={NotebookPen} tone="info" value={notes} unit={`/${BINGO.length}`} label={`field notes survived · ${drillsDone.length} drilled`} />
      </div>

      <SectionTitle kicker="Evidence" title="What you built" sub="Each artifact is the workflow you assembled, with the acceptance checks it passed." />
      {artifacts.length === 0 ? (
        <GlassCard><p className="muted small">No artifact saved — the course capstone’s “Save to Portfolio” step adds it.</p></GlassCard>
      ) : (
        <motion.div className="grid c2" {...stagger} initial="initial" animate="animate">
          {artifacts.map((a) => (
            <motion.div key={a.id} className="glass" {...staggerChild}>
              <div className="row between wrap">
                <h3>{a.title}</h3>
                <span className="chip ok">+{a.hrsSaved} hrs/wk</span>
              </div>
              <p className="tag-mono mt8">{a.moduleId === 'capstone' ? 'Course capstone' : `Module ${a.moduleId}`} · {a.workflowJson?.nodes?.length || 0} nodes · {a.lint?.filter((r) => r.status === 'pass').length}/{a.lint?.length} checks passed</p>
              <div className="row wrap mt14" style={{ gap: 4 }}>
                {a.workflowJson?.nodes?.map((n, i) => <span key={i} className="chip">{n.name}</span>)}
              </div>
              <div className="mt14"><Btn size="sm" onClick={() => downloadArtifact(a)}><Download size={13} /> Download .json</Btn></div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="grid c2">
        <div>
          <SectionTitle kicker="It doesn’t end here" title="Health checks still to come" />
          <GlassCard>
            {pending.length === 0 ? (
              <p className="muted small">All health checks handled.</p>
            ) : pending.map((r) => (
              <div key={r.id} className="plan-list-row">
                <span className="small"><HeartPulse size={13} color="var(--warn-ink)" style={{ verticalAlign: -2, marginRight: 6 }} />{r.title}</span>
                <span className="tag-mono">{r.dueAt <= Date.now() ? 'ready now' : new Date(r.dueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
            <p className="tag-mono mt8">short maintenance scenarios on your dashboard — they keep the skill from fading</p>
          </GlassCard>
        </div>
        <div>
          <SectionTitle kicker="What’s next" title={coming.length ? 'Coming next in this course' : 'You’ve finished the course'} />
          <GlassCard>
            {coming.map((m) => (
              <div key={m.n} className="plan-list-row">
                <div>
                  <b className="small">Module {m.n} · {m.title}</b>
                  <p className="muted small">{m.submodules.map((s) => s.title).join(' · ')}</p>
                </div>
                <span className="chip">coming next</span>
              </div>
            ))}
            {coming.length === 0 && <p className="small"><CheckCircle2 size={14} color="var(--ok)" style={{ verticalAlign: -2, marginRight: 6 }} />Nothing left — every module is shipped.</p>}
            <p className="tag-mono mt8">they open here when they are published; your progress carries over</p>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
