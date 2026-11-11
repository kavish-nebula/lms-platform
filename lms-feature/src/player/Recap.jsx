import { motion } from 'motion/react'
import { ArrowRight, Check, Compass, HeartPulse, NotebookText, RotateCcw } from 'lucide-react'
import { Btn } from '../ui/bits.jsx'
import { useCourse } from '../stores/course.js'
import { useReview } from '../stores/review.js'
import { MODULES } from '../content/course.js'
import { popIn } from '../motion.js'

/*
  Wrap-up — what this module did for this learner:
  short notes on each lesson, exactly what to revisit from the module quiz, the workflow they built in guided
  practice, and a look at what comes next.
*/
export default function Recap({ content, onBack, onRevisit, onOpenStep }) {
  const quiz = useCourse((s) => s.progress[content.n]?.quiz)
  const finalPassed = useCourse((s) => !!s.final?.passed)
  const capstoneDone = useCourse((s) => !!s.capstone)
  const practised = useCourse((s) => !!s.progress[content.n]?.stages?.guided)
  const reviews = useReview((s) => s.items).filter((r) => r.moduleId === content.n && !r.done).sort((a, b) => a.dueAt - b.dueAt)

  const last = quiz?.last
  const missed = last?.missed || []
  const meta = MODULES.find((m) => m.n === content.n)
  const nextMod = MODULES.find((m) => m.n === content.n + 1)
  const courseDone = !nextMod?.built

  return (
    <motion.div className="stack-v" {...popIn}>
      <div className="glass role-card" style={{ padding: 24 }}>
        <div className="kicker mb8">Module {content.n} shipped</div>
        <h2 style={{ fontSize: 27.5 }}>{content.title.split(':')[0]} — here’s what changed</h2>
        <p className="muted small mt8">
          {last ? <>Module quiz: <b>{last.score}/{last.total}</b>. </> : null}
          Below: the module in short notes, what’s worth revisiting{content.guided ? ', what you built in guided practice' : ''}, and what comes next.
        </p>
      </div>

      {/* ---------- the module in short notes ---------- */}
      <div className="glass">
        <div className="kicker mb8"><NotebookText size={12} style={{ verticalAlign: -2, marginRight: 4 }} />This module in short notes</div>
        <div className="grid c3">
          {meta.submodules.map((sm) => (
            <div key={sm.id} className="note-card">
              <b className="small">{sm.id} · {sm.title}</b>
              <ul>
                {(sm.notes || []).map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- where to revisit ---------- */}
      <div className="glass">
        <div className="kicker mb8"><RotateCcw size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Where to revisit</div>
        {!last ? (
          <p className="muted small">The quiz result isn’t recorded for this module.</p>
        ) : missed.length === 0 ? (
          <p className="small"><Check size={14} color="var(--ok)" style={{ verticalAlign: -2, marginRight: 6 }} />Nothing — every quiz question on this module was right.</p>
        ) : (
          content.submodules.filter((sm) => missed.some((m) => m.sub === sm.id)).map((sm) => (
            <div key={sm.id} className="revisit">
              <div className="row between wrap">
                <b className="small">{sm.id} · {sm.title}</b>
                <Btn size="sm" onClick={() => onRevisit(sm.id)}><RotateCcw size={13} /> Revisit this lesson</Btn>
              </div>
              {missed.filter((m) => m.sub === sm.id).map((m, i) => (
                <div key={i} className="revisit-q">
                  <p className="small" style={{ fontWeight: 600 }}>{m.q}</p>
                  <p className="muted small">{m.explain}</p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* ---------- what you built ---------- */}
      {content.guided && (
      <div className="glass">
        <div className="kicker mb8">What you built in guided practice</div>
        {practised ? (
          <>
            <b>{content.guided.title.replace(/ yourself$/, '')}</b>
            <div className="built-chain mt14">
              {content.guided.steps.map((s, k) => <span key={k} className="built-node">{s.paletteLabel}</span>)}
            </div>
            <p className="tag-mono mt14">built step by step, run on real data — the course capstone asks for a build like this with no help</p>
          </>
        ) : (
          <div className="row between wrap">
            <p className="muted small">The guided practice isn’t finished yet — that’s where you build this module’s workflow.</p>
            <Btn size="sm" onClick={() => onOpenStep('guided')}>Open the guided practice</Btn>
          </div>
        )}
      </div>
      )}

      {/* ---------- what continues ---------- */}
      {nextMod && (
        <div className="glass for-you">
          <div className="row between wrap">
            <div className="kicker"><Compass size={12} /> What continues in Module {nextMod.n}</div>
            {!nextMod.built && <span className="chip">coming next</span>}
          </div>
          <h3 style={{ marginTop: 6 }}>{nextMod.title}</h3>
          <p className="small mt8">{nextMod.leadIn}</p>
          <div className="row wrap mt14" style={{ gap: 6 }}>
            {nextMod.submodules.map((sm) => <span key={sm.id} className="chip">{sm.id} · {sm.title}</span>)}
          </div>
          <p className="tag-mono mt8">it opens with: {nextMod.pain}</p>
        </div>
      )}

      <div className="row between wrap">
        <span className="small muted">
          {reviews.length > 0 && <><HeartPulse size={13} color="var(--warn-ink)" style={{ verticalAlign: -2, marginRight: 5 }} />Next health check: {reviews[0].dueAt <= Date.now() ? 'ready now on your dashboard' : new Date(reviews[0].dueAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</>}
        </span>
        <span className="row wrap">
          <Btn onClick={onBack}>Back to the course</Btn>
          {!courseDone
            ? <Btn variant="primary" to={`/player/${nextMod.n}`}>Next: Module {nextMod.n} · {nextMod.title.split(':')[0]} <ArrowRight size={14} /></Btn>
            : !capstoneDone
              ? <Btn variant="primary" to="/capstone">Next: the capstone project <ArrowRight size={14} /></Btn>
              : !finalPassed
                ? <Btn variant="primary" to="/final">Next: the final assessment <ArrowRight size={14} /></Btn>
                : <Btn variant="primary" to="/complete">See everything you’ve built <ArrowRight size={14} /></Btn>}
        </span>
      </div>
    </motion.div>
  )
}
