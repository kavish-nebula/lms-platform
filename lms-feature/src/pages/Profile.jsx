import { useNavigate } from 'react-router-dom'
import { BookOpen, RotateCcw, TriangleAlert } from 'lucide-react'
import { Btn, PageHeader, SectionTitle, EmptyNote } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { useLearner, useAdaptation } from '../stores/learner.js'
import { MODULES } from '../content/course.js'
import { QUESTIONS } from '../content/profile.js'
import { LEARNER } from '../content/session.js'
import { SUPPORT_LABEL } from '../engine/adaptive.js'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { useSignals } from '../stores/signals.js'
import { usePortfolio } from '../stores/portfolio.js'
import { usePatch } from '../stores/patch.js'
import { usePlan } from '../stores/plan.js'
import AdaptationList from '../ui/AdaptationList.jsx'

export default function Profile() {
  const learner = useLearner()
  const { demoMode, setDemoMode } = useLearner()
  const resetProgress = useCourse((s) => s.resetProgress)
  const resetReviews = useReview((s) => s.resetReviews)
  const resetSignals = useSignals((s) => s.resetSignals)
  const resetPortfolio = usePortfolio((s) => s.resetPortfolio)
  const resetPlan = usePlan((s) => s.resetPlan)
  const makeDue = useReview((s) => s.makeDue)
  const items = useReview((s) => s.items)
  const pushPatch = usePatch((s) => s.push)

  const adapt = useAdaptation()
  const navigate = useNavigate()
  const built = MODULES.filter((m) => m.built)

  // answers save as they change; they take effect from the next step the learner opens
  const edit = (patch) => learner.updateProfile(patch)

  const resetEverything = () => {
    learner.resetAll()
    resetProgress()
    resetReviews()
    resetSignals()
    resetPortfolio()
    resetPlan()
    navigate('/') // back to the front door, as a new learner
  }

  return (
    <div>
      <PageHeader
        kicker="Profile"
        title="How this course adapts to you"
        sub="Each answer sets a default you control — pick a different one and it applies from the next step you open. Click a selected answer again to clear it."
        right={!learner.profile && <Btn to="/onboarding" variant="primary">Answer the {QUESTIONS.length} questions</Btn>}
      />

      <GlassCard>
        <div className="kicker">Learner</div>
        <b>{LEARNER.name}</b> <span className="tag-mono">· from your account</span>
        <div className="hr" />
        <AdaptationList profile={learner.profile} onEdit={edit} />
      </GlassCard>

      <div className="grid c2 mt20">

        <GlassCard>
          <div className="kicker mb8">Demo access</div>
          <p className="muted small mb14" style={{ lineHeight: 1.5 }}>
            When ON, every built module is open — for walkthroughs. When OFF, real sequential
            unlocking applies: each module opens when the previous one is completed.
          </p>
          <div className="row" style={{ gap: 10 }} role="group" aria-label="Demo access">
            <Btn size="sm" variant={demoMode ? 'primary' : ''} aria-pressed={demoMode} onClick={() => setDemoMode(true)}>Demo: all open</Btn>
            <Btn size="sm" variant={!demoMode ? 'primary' : ''} aria-pressed={!demoMode} onClick={() => setDemoMode(false)}>Real unlocking</Btn>
          </div>
          <p className="tag-mono mt8">current: {demoMode ? 'all built modules open' : 'sequential unlocking'}</p>
        </GlassCard>

        <GlassCard>
          <div className="kicker mb8">Learner model · support per lesson</div>
          <p className="muted small mb14">
            Set by the pre-assessment you took before Module 1; where you skipped it, by your “experience” answer.
            Module quizzes and the final assessment never change.
          </p>
          <div className="mb14">
            <Btn size="sm" onClick={() => { learner.clearPrecheck(); navigate('/precheck') }}>
              <RotateCcw size={13} /> {learner.precheck && !learner.precheck.skipped ? 'Retake the pre-assessment' : 'Take the pre-assessment'}
            </Btn>
          </div>
          {built.map((m) => (
            <div key={m.n} className="mb14">
              <b className="small">Module {m.n} · {m.title.split(':')[0]}</b>
              {m.submodules.map((sm) => {
                const level = adapt.support(m.n, sm.id)
                return (
                  <div key={sm.id} className="plan-list-row">
                    <span className="small">{sm.id} · {sm.title}</span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="tag-mono">from {adapt.source(m.n, sm.id) === 'default' ? 'the course default' : `your ${adapt.source(m.n, sm.id)}`}</span>
                      <span className={`chip ${level === 'extra' ? 'warn' : level === 'light' ? 'ok' : ''}`}>{SUPPORT_LABEL[level]}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </GlassCard>
      </div>

      <SectionTitle kicker="Reference book" title="Your own words, your own notes" sub="Every teach-back lands here automatically — the notes you wrote while you still remembered the struggle." />
      {learner.referenceBook.length === 0 ? (
        <EmptyNote>Nothing yet. Write the teach-back after a module quiz and it appears here.</EmptyNote>
      ) : (
        <div className="stack-v">
          {learner.referenceBook.map((t) => (
            <GlassCard key={t.id}>
              <div className="row between">
                <b className="small"><BookOpen size={13} style={{ display: 'inline', marginRight: 6 }} />Module {t.moduleId} teach-back</b>
                <span className="tag-mono">{new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="small mt8" style={{ lineHeight: 1.6 }}>{t.text}</p>
              {t.unclear && <p className="tag-mono mt8">still unclear: “{t.unclear}” — a health check may pick this up</p>}
            </GlassCard>
          ))}
        </div>
      )}

      <SectionTitle kicker="Prototype controls" title="Demo helpers" sub="Pull a health check forward instead of waiting days, or wipe everything. For jumping around the journey, use the Demo button in the top bar." />
      <GlassCard className="dev-panel">
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="chip warn"><TriangleAlert size={11} /> demo only</span>
          {items.filter((r) => !r.done).map((r) => (
            <Btn key={r.id} size="sm" onClick={() => { makeDue(r.id); pushPatch('Health check pulled forward — check the dashboard.') }}>
              Make “{r.title}” (+{r.dueInDays} days) due now
            </Btn>
          ))}
          {items.length === 0 && <span className="tag-mono">no health checks scheduled yet — finish a module first</span>}
        </div>
        <div className="hr" />
        <Btn size="sm" variant="ghost" onClick={resetEverything}>Reset ALL prototype data</Btn>
      </GlassCard>
    </div>
  )
}
