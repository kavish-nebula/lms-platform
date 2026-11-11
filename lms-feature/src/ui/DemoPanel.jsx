import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Presentation, X } from 'lucide-react'
import { useLearner } from '../stores/learner.js'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { usePortfolio } from '../stores/portfolio.js'
import { usePlan } from '../stores/plan.js'
import { useSignals } from '../stores/signals.js'
import { COURSE, MODULES } from '../content/course.js'
import { CONTENT } from '../content/modules/index.js'
import { CAPSTONE } from '../content/capstone.js'
import { blankProfile } from '../content/profile.js'
import { stageList } from '../engine/progress.js'
import { lint, workflowFrom } from '../engine/linter.js'

const DAY = 86400000
const SAMPLE_PROFILE = { role: 'engineer', domain: 'manufacturing', goal: 'work', experience: 'little', firstStep: 'example', style: 'steps', needs: [] }

/* State a learner would have after really doing the work — built the same way the app builds it. */
const quizResult = (n) => {
  const qs = CONTENT[n].quiz.questions
  const own = qs.filter((q) => !q.recall)
  const miss = own.find((q) => q.sub === `${n}.2`) // one question missed, in the module's second lesson
  const bySub = {}
  for (const q of own) { bySub[q.sub] ||= { right: 0, total: 0 }; bySub[q.sub].total++; if (q !== miss) bySub[q.sub].right++ }
  const recallN = qs.length - own.length
  return {
    score: qs.length - 1, total: qs.length, passed: true, bySub,
    recall: recallN ? { right: recallN, total: recallN } : null,
    missed: [{ sub: miss.sub, q: miss.q, explain: miss.explain }],
  }
}
const shippedModule = (n, at) => ({
  stages: Object.fromEntries(stageList(MODULES.find((m) => m.n === n)).map((s, i) => [s.key, at + i * 60000])),
  completed: true, completedAt: at + 3600000,
  quiz: { best: CONTENT[n].quiz.questions.length - 1, passed: true, attempts: 1, last: quizResult(n) },
})
// the accepted capstone, in the order its slots ask for
const capstoneArtifact = (at) => {
  const p = CAPSTONE.project
  const order = ['Normalize Fields', 'Filter: Blank Emails', 'Filter: Duplicate IDs', 'Append to CRM', 'Slack #new-leads']
  const wf = workflowFrom(p.workflowName, order.map((label) => p.buildHere.palette.find((x) => x.label === label)))
  return { id: 'art-demo-capstone', createdAt: at, moduleId: 'capstone', title: wf.name, summary: p.brief.closing, workflowJson: wf, lint: lint(wf).results, hrsSaved: p.hrsSaved }
}
const reviewsFor = (n, shippedAt, firstDueNow) =>
  CONTENT[n].reviews.map((r, i) => ({
    ...r, moduleId: n, id: `m${n}-r${i + 1}`, done: false, doneAt: null,
    dueAt: i === 0 && firstDueNow ? Date.now() - 1000 : shippedAt + r.dueInDays * DAY,
  }))

/*
  Presenter controls — jump straight to a point in the learner's journey.
  Only shown while Demo access is on (Profile). Each jump replaces the saved
  state in this browser with what a learner would have at that point.
*/
export default function DemoPanel() {
  const ref = useRef(null)
  const navigate = useNavigate()

  const jump = (scene) => {
    const now = Date.now()
    const learner = useLearner.getState()
    const profile = learner.profile || { ...blankProfile(), ...SAMPLE_PROFILE, at: now }
    useSignals.getState().resetSignals()
    usePlan.getState().resetPlan()

    const set = ({ who = { profile }, precheck = null, progress = {}, final = null, capstone = null, reviews = [], artifacts = [], to }) => {
      useLearner.getState().seed({ ...who, precheck, calibrate: null, referenceBook: [], drillsDone: [], demoMode: true })
      useCourse.getState().setProgress(progress, final, capstone)
      useReview.getState().setItems(reviews)
      usePortfolio.getState().setArtifacts(artifacts)
      ref.current?.close()
      navigate(to)
    }
    const pre = { lessons: { '1.1': 0, '1.2': 1, '1.3': 2, '2.1': 1, '2.2': 1, '2.3': 2 }, at: now }

    if (scene === 'new') return set({ who: { profile: null }, to: '/dashboard' })
    if (scene === 'enrolled') return set({ precheck: pre, to: `/course/${COURSE.id}` })
    if (scene === 'mid') {
      const keys = ['hook', '1.1-explain', '1.1-worked', '1.1-scenarios']
      return set({ precheck: pre, progress: { 1: { stages: Object.fromEntries(keys.map((k, i) => [k, now - DAY + i * 60000])), completed: false, completedAt: null, quiz: null } }, to: '/player/1' })
    }
    if (scene === 'm1done') {
      const at = now - 4 * DAY
      return set({ precheck: pre, progress: { 1: shippedModule(1, at) }, reviews: reviewsFor(1, at, true), to: '/dashboard' })
    }
    const a1 = now - 9 * DAY, a2 = now - 2 * DAY
    const both = Object.fromEntries(MODULES.filter((m) => m.built).map((m) => [m.n, shippedModule(m.n, m.n === 1 ? a1 : a2)]))
    const shipped = { precheck: pre, progress: both, reviews: [...reviewsFor(1, a1, true), ...reviewsFor(2, a2, false)] }
    if (scene === 'capstone') return set({ ...shipped, to: `/course/${COURSE.id}` })
    const built = { ...shipped, capstone: { at: a2 + DAY / 2 }, artifacts: [capstoneArtifact(a2 + DAY / 2)] }
    if (scene === 'final') return set({ ...built, to: `/course/${COURSE.id}` })
    const total = COURSE.final.questions.length
    return set({
      ...built,
      final: { best: total - 1, passed: true, passedAt: a2 + DAY, attempts: 1, last: { score: total - 1, total, passed: true } },
      to: '/complete',
    })
  }

  const SCENES = [
    ['new', 'New learner', 'Nothing chosen yet — the dashboard asks them to pick a first course.'],
    ['enrolled', 'Course started, no lessons yet', 'Profile and pre-assessment done — opens the course page with its module path.'],
    ['mid', 'Mid Module 1', 'First lesson done, pre-assessment taken — opens the next lesson.'],
    ['m1done', 'Module 1 finished', 'Shipped, with a health check due on the dashboard.'],
    ['capstone', 'Ready for the capstone', 'Every module shipped — opens the course page, where the capstone project is now unlocked.'],
    ['final', 'Ready for the final', 'Capstone accepted and in the portfolio — the final assessment is now unlocked on the course page.'],
    ['complete', 'Course complete', 'Modules, capstone and final assessment done — opens the completion page.'],
  ]

  return (
    <>
      <button type="button" className="chip demo-btn" onClick={() => ref.current?.showModal()}><Presentation size={13} /> Demo</button>
      <dialog ref={ref} className="qdialog" aria-labelledby="demo-title" onClick={(e) => { if (e.target === ref.current) ref.current.close() }}>
        <div className="qdialog-body">
          <div className="row between">
            <div className="kicker">Presenter controls</div>
            <button type="button" className="btn sm ghost" aria-label="Close" onClick={() => ref.current.close()}><X size={14} /></button>
          </div>
          <h2 id="demo-title">Jump to a point in the journey</h2>
          <div>
            {SCENES.map(([id, title, sub]) => (
              <button key={id} type="button" className="opt" onClick={() => jump(id)}>
                <b>{title}</b>
                <span className="muted small" style={{ display: 'block', marginTop: 2 }}>{sub}</span>
              </button>
            ))}
          </div>
          <p className="tag-mono">replaces the saved progress in this browser · your profile answers are kept (except “new learner”) · inside a lesson, any step can be opened and narration can be skipped</p>
        </div>
      </dialog>
    </>
  )
}
