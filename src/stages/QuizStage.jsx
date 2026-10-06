import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, RotateCcw, BookOpen } from 'lucide-react'
import StageShell from './StageShell.jsx'
import { Btn } from '../ui/bits.jsx'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { useLearner } from '../stores/learner.js'
import { usePatch } from '../stores/patch.js'
import { useStreak } from '../stores/streak.js'
import { burstConfetti } from '../ui/celebrate.jsx'
import { play } from '../sound.js'
import { popIn } from '../motion.js'

/*
  Stage: Module quiz.
  MCQs covering every sub-module (M2+ mixes in recall questions from the previous
  module: structural spaced review). Every option teaches after answering.
  The quiz is the same for every learner — it is the one part that never adapts.
  Passing it IS finishing the module: completion and health checks are recorded at
  that moment, so leaving the page afterwards can't strand the module half-done.
*/
export default function QuizStage({ content, moduleId, onNext }) {
  const q = content.quiz
  const [idx, setIdx] = useState(0)
  const [choice, setChoice] = useState(null)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [teachback, setTeachback] = useState('')
  const [tbSaved, setTbSaved] = useState(false)
  const recordQuiz = useCourse((s) => s.recordQuiz)
  const markStage = useCourse((s) => s.markStage)
  const completeModule = useCourse((s) => s.completeModule)
  const scheduleFor = useReview((s) => s.scheduleFor)
  const addTeachback = useLearner((s) => s.addTeachback)
  const pushPatch = usePatch((s) => s.push)
  const touch = useStreak((s) => s.touch)

  const question = q.questions[idx]
  const total = q.questions.length
  const score = answers.filter((a) => a.correct).length
  const passed = score / total >= q.passMark
  const passPct = Math.round(q.passMark * 100)

  const answer = (i) => {
    if (choice !== null) return
    setChoice(i)
    play(i === question.correct ? 'correct' : 'wrong')
    setAnswers((a) => [...a, { q: question.q, sub: question.sub, explain: question.explain, correct: i === question.correct, recall: !!question.recall }])
  }

  const next = () => {
    setChoice(null)
    if (idx + 1 < total) return setIdx(idx + 1)
    const finalScore = answers.filter((a) => a.correct).length
    const isPassed = finalScore / total >= q.passMark
    // per lesson, for the wrap-up's before/after; questions recalling the previous module are counted apart
    const tally = (list) => ({ right: list.filter((a) => a.correct).length, total: list.length })
    const own = answers.filter((a) => !a.recall)
    const recall = answers.filter((a) => a.recall)
    recordQuiz(moduleId, {
      score: finalScore, total, passed: isPassed,
      bySub: Object.fromEntries([...new Set(own.map((a) => a.sub))].map((sub) => [sub, tally(own.filter((a) => a.sub === sub))])),
      recall: recall.length ? tally(recall) : null,
      missed: own.filter((a) => !a.correct).map(({ sub, q, explain }) => ({ sub, q, explain })),
    })
    if (isPassed) {
      markStage(moduleId, 'quiz')
      scheduleFor(moduleId, content.reviews) // no-op if this module's checks already exist
      completeModule(moduleId)
      pushPatch('Module shipped. Health checks are scheduled — I’ll ping the dashboard when one needs attention.')
      // the moment is worth marking: the module is real, shipped, and kept alive from here
      touch('study')
      play('ship')
      burstConfetti({ count: 130 })
    }
    setFinished(true)
  }

  const saveTeachback = () => {
    addTeachback({ moduleId, text: teachback.trim() })
    setTbSaved(true)
  }

  const retake = () => { setIdx(0); setAnswers([]); setChoice(null); setFinished(false) }

  if (finished) {
    return (
      <StageShell kicker="Module quiz" title={passed ? 'Quiz passed — module shipped.' : 'Not yet — and that’s normal.'}>
        <motion.div className="stack-v" {...popIn}>
          <div className={`glass reveal-card ${passed ? '' : 'role-card'}`}>
            <div className="row mb8">
              <ShieldCheck size={18} color={passed ? 'var(--ok)' : 'var(--amber)'} />
              <b>{score}/{total} — {passed ? 'above' : 'below'} the {passPct}% line</b>
            </div>
            {passed ? (
              <p className="small" style={{ lineHeight: 1.6 }}>
                Every sub-module’s concepts, covered. This module is now marked as shipped and its health
                checks are scheduled.
              </p>
            ) : (
              <p className="small" style={{ lineHeight: 1.6 }}>
                Missed questions are shown below — revisit those lessons and retake. No timer, no penalty,
                unlimited attempts.
              </p>
            )}
          </div>

          {answers.map((a, i) => !a.correct && (
            <div key={i} className="glass mb8" style={{ padding: 14 }}>
              <p className="small" style={{ fontWeight: 600 }}>✗ {a.q}</p>
              <p className="muted small mt8" style={{ lineHeight: 1.5 }}>{q.questions.find((x) => x.q === a.q)?.explain}</p>
            </div>
          ))}

          {passed && (
            <div className="glass">
              <label className="kicker mb8" htmlFor="teachback" style={{ display: 'block' }}>
                <BookOpen size={12} style={{ display: 'inline', marginRight: 4 }} />{q.teachbackPrompt} <span className="tag-mono">(optional)</span>
              </label>
              <textarea id="teachback" className="textarea" value={teachback} disabled={tbSaved} onChange={(e) => setTeachback(e.target.value)}
                placeholder="In your own words…" />
              <div className="row mt8">
                {tbSaved
                  ? <span className="chip ok">Saved to your Reference Book</span>
                  : <Btn size="sm" disabled={teachback.trim().length <= 40} onClick={saveTeachback}>Save to my Reference Book</Btn>}
                {!tbSaved && <span className="tag-mono">a couple of sentences is enough</span>}
              </div>
            </div>
          )}

          <div className="row between">
            {passed ? <span /> : <Btn onClick={retake}><RotateCcw size={14} /> Retake the quiz</Btn>}
            {passed && <Btn variant="primary" onClick={onNext}>See the wrap-up →</Btn>}
          </div>
        </motion.div>
      </StageShell>
    )
  }

  return (
    <StageShell kicker={`Module quiz · pass at ${passPct}%`} title={`Question ${idx + 1} of ${total}`}>
      <div className="stack-v">
        <div className="progress"><div style={{ width: `${(idx / total) * 100}%` }} /></div>
        <motion.div className="stack-v" key={idx} {...popIn}>
          <div className="row">
            <span className="chip">{question.sub}</span>
            {question.recall && <span className="chip warn">recall · previous module</span>}
          </div>
          <div className="glass">
            <p className="small" style={{ fontWeight: 600, lineHeight: 1.6 }}>{question.q}</p>
            <div className="mt14">
              {question.options.map((o, i) => {
                const cls = choice === null ? '' : i === question.correct ? 'right' : choice === i ? 'wrong' : ''
                return <button key={i} type="button" className={`opt ${cls}`} onClick={() => answer(i)}>{o}</button>
              })}
            </div>
          </div>
          {choice !== null && (
            <motion.div className="glass reveal-card" {...popIn}>
              <p className="small" style={{ lineHeight: 1.6 }}>
                <b style={{ color: choice === question.correct ? 'var(--ok-ink)' : 'var(--err)' }}>
                  {choice === question.correct ? 'Right — ' : 'Not quite — '}
                </b>
                {question.explain}
              </p>
              <div className="row between mt14">
                <span className="tag-mono">score so far: {answers.filter((a) => a.correct).length}/{answers.length}</span>
                <Btn variant="primary" size="sm" onClick={next}>{idx + 1 < total ? 'Next question →' : 'See result →'}</Btn>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </StageShell>
  )
}
