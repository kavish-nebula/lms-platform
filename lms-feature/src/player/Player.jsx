import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  MousePointerClick, Lightbulb, PlayCircle, Hand, ShieldCheck, HelpCircle, CheckCircle2, Lock,
} from 'lucide-react'
import HookStage from '../stages/HookStage.jsx'
import ExplainerStage from '../stages/ExplainerStage.jsx'
import WorkedExampleStage from '../stages/WorkedExampleStage.jsx'
import ScenarioQsStage from '../stages/ScenarioQsStage.jsx'
import GuidedPracticeStage from '../stages/GuidedPracticeStage.jsx'
import QuizStage from '../stages/QuizStage.jsx'
import { useCourse } from '../stores/course.js'
import { COURSE, MODULES } from '../content/course.js'
import { CONTENT } from '../content/modules/index.js'
import { Btn } from '../ui/bits.jsx'
import { stageList } from '../engine/progress.js'
import { useLearner, useAdaptation } from '../stores/learner.js'
import { stageSettings } from '../engine/adaptive.js'
import AdaptedStrip from '../ui/AdaptedStrip.jsx'
import Recap from './Recap.jsx'

const KIND = {
  hook: { Icon: MousePointerClick, Comp: HookStage },
  explain: { Icon: Lightbulb, Comp: ExplainerStage },
  worked: { Icon: PlayCircle, Comp: WorkedExampleStage },
  scenarios: { Icon: HelpCircle, Comp: ScenarioQsStage },
  guided: { Icon: Hand, Comp: GuidedPracticeStage },
  quiz: { Icon: ShieldCheck, Comp: QuizStage },
}

/* Stage order comes from engine/progress.js — the same list the Learning Plan schedules. */
function buildStages(content, order) {
  return stageList(content, order).map((s) => ({
    ...s,
    ...KIND[s.kind],
    sm: content.submodules.find((sm) => sm.id === s.subId),
  }))
}

export default function Player() {
  const { moduleId } = useParams()
  const mid = Number(moduleId)
  const navigate = useNavigate()
  const resumeKey = useLocation().state?.step // “Resume” on the dashboard names the step to open
  const setLast = useCourse((s) => s.setLast)
  const content = CONTENT[mid]
  const modMeta = MODULES.find((m) => m.n === mid)
  const stagesDone = useCourse((s) => s.progress[mid]?.stages) || {}
  const markStage = useCourse((s) => s.markStage)
  const isUnlocked = useCourse((s) => s.isUnlocked)
  const [override, setOverride] = useState(null)

  const unlocked = isUnlocked(mid, modMeta)
  const adapt = useAdaptation()
  const demoMode = useLearner((s) => s.demoMode)
  const hasProfile = useLearner((s) => !!s.profile)
  const prechecked = useLearner((s) => !!s.precheck)
  const untouched = useCourse((s) => Object.values(s.progress).every((m) => Object.keys(m.stages || {}).length === 0))
  const STAGES = useMemo(() => (content ? buildStages(content, adapt.order) : []), [content, adapt.order])

  const firstIncomplete = useMemo(() => {
    const i = STAGES.findIndex((s) => !stagesDone[s.key])
    return i === -1 ? STAGES.length : i
  }, [STAGES, stagesDone])

  // open at the first unfinished step — and stay on a step while it is being finished, rather than
  // sliding forward the instant it is marked done (the quiz result screen comes after the quiz is recorded)
  const opened = useRef(null)
  if (opened.current === null) {
    // a resumed step opens directly, as long as it is one the learner could already reach
    const want = STAGES.findIndex((s) => s.key === resumeKey)
    opened.current = want !== -1 && (demoMode || want <= firstIncomplete || stagesDone[resumeKey]) ? want : firstIncomplete
  }
  const [idx, setIdxState] = useState(null)
  const current = override ?? idx ?? opened.current
  const setIdx = (i) => { setOverride(i); window.scrollTo({ top: 0 }) }
  const next = () => { setOverride(null); setIdxState(current + 1); window.scrollTo({ top: 0 }) }

  // remember the step on screen, so the dashboard can resume from it
  const onKey = STAGES[current]?.key
  const showing = !!content && !!modMeta && unlocked && (prechecked || !untouched)
  useEffect(() => { if (showing && onKey) setLast(mid, onKey) }, [showing, mid, onKey])

  if (!content || !modMeta) {
    return (
      <div className="mt30">
        <div className="empty-note">
          {modMeta ? `Module ${mid} · ${modMeta.title} is coming next — it isn’t available yet.` : 'There is no such module.'}
        </div>
        <div className="mt14"><Btn to={`/course/${COURSE.id}`}>← Back to the course</Btn></div>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="mt30">
        <div className="empty-note">Module {mid} is locked. Finish Module {mid - 1} first — or flip on Demo access in Profile for this walkthrough.</div>
        <div className="mt14"><Btn to={`/course/${COURSE.id}`}>← Back to the course</Btn></div>
      </div>
    )
  }

  // a course is started from its own page: a few questions about the learner, then one pre-assessment
  if (!prechecked && untouched) return <Navigate to={`/course/${COURSE.id}`} replace />

  const isRecap = current >= STAGES.length
  const stage = STAGES[current]
  const stageKey = stage?.key

  const nextFrom = (key) => { markStage(mid, key); next() }

  const doneCount = STAGES.filter((s) => stagesDone[s.key]).length

  return (
    <div>
      <div className="row between wrap mb14">
        <div>
          <div className="kicker">Module {modMeta.n} · {modMeta.pain}</div>
          <h1 style={{ fontSize: 27.5 }}>{modMeta.title}</h1>
        </div>
        <Btn to={`/course/${COURSE.id}`} size="sm" variant="ghost">Exit to course path</Btn>
      </div>

      <div className="player-shell">
        <aside className="stepper">
          {STAGES.map(({ key, label, Icon }, i) => {
            const done = !!stagesDone[key]
            const active = i === current
            const reached = done || i <= firstIncomplete // what a learner could open by themselves
            return (
              <button
                key={key}
                type="button"
                className={`step-item ${active ? 'active' : ''} ${done ? 'done' : ''} ${reached || demoMode || active ? '' : 'locked'}`}
                aria-current={active ? 'step' : undefined}
                title={!reached && demoMode && !active ? 'Locked for a learner — open for this demo' : undefined}
                // finished steps can be revisited; with demo access on, a locked step still opens when clicked
                onClick={() => (reached || demoMode) && !active && setIdx(i)}
              >
                <span className="step-ic">{done && !active ? <CheckCircle2 size={15} /> : <Icon size={15} />}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {!reached && !active && <Lock size={12} className="step-lock" aria-label="locked" />}
              </button>
            )
          })}
          <button type="button" className={`step-item ${isRecap ? 'active' : ''}`} onClick={() => (firstIncomplete >= STAGES.length || demoMode) && setIdx(STAGES.length)}>
            <span className="step-ic">{isRecap ? <CheckCircle2 size={15} /> : <Lock size={14} />}</span>
            Wrap-up
          </button>
          <div className="mt14" style={{ padding: '0 10px' }}>
            <div className="progress"><div style={{ width: `${(doneCount / STAGES.length) * 100}%` }} /></div>
            <div className="tag-mono mt8">{doneCount}/{STAGES.length} steps complete</div>
          </div>
        </aside>

        <section className="glass stage-box">
          {isRecap ? (
            <Recap
              content={content}
              onBack={() => navigate(`/course/${COURSE.id}`)}
              // a finished lesson can always be reopened: go to its idea step
              onRevisit={(subId) => setIdx(STAGES.findIndex((s) => s.key === `${subId}-explain`))}
              onOpenStep={(key) => setIdx(STAGES.findIndex((s) => s.key === key))}
            />
          ) : (
            (() => {
              const { Comp, sm } = stage
              const nextLabel = STAGES[current + 1]?.label || 'Wrap-up'
              // this learner's settings for this step: course-wide answers + this lesson's support level
              const settings = stageSettings(adapt, { module: modMeta, subId: stage.subId, kind: stage.kind, demoMode })
              const props = { content, sm, moduleId: mid, signalsKey: `m${mid}.${stageKey}`, onNext: () => nextFrom(stageKey), adapt: settings, nextLabel }
              return (
                <>
                  <AdaptedStrip chips={settings.chips} hasProfile={hasProfile} fixed={stage.kind === 'quiz'} />
                  <Comp key={stageKey} {...props} />
                </>
              )
            })()
          )}
        </section>
      </div>
    </div>
  )
}
