import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Btn, ProgressBar } from '../ui/bits.jsx'
import AdaptationList from '../ui/AdaptationList.jsx'
import { useLearner } from '../stores/learner.js'
import { QUESTIONS, blankProfile } from '../content/profile.js'
import { LEARNER } from '../content/session.js'
import { fadeUp, popIn } from '../motion.js'

/*
  Learner profile — generic questions, one per screen, each skippable. Asked once,
  when the learner starts their first course. "Something else" opens a box to type
  the answer. Ends on the adaptation summary: every answer beside what it changes,
  then on to the course's pre-assessment.
*/
export default function Onboarding() {
  const saved = useLearner((s) => s.profile)
  const saveProfile = useLearner((s) => s.saveProfile)
  const navigate = useNavigate()
  const toCourse = useLocation().state?.next === 'precheck' // came here by starting a course
  const [answers, setAnswers] = useState(() => ({ ...blankProfile(), ...saved }))
  const [i, setI] = useState(0)

  const done = i >= QUESTIONS.length
  const q = QUESTIONS[i]
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }))

  // move on with these answers; after the last question, save and show the summary
  const advance = (a) => {
    setAnswers(a)
    if (i === QUESTIONS.length - 1) saveProfile(a)
    setI(i + 1)
  }
  const next = () => advance(answers)
  const skip = () => advance({ ...answers, [q.id]: q.type === 'multi' ? [] : q.type === 'text' ? '' : null })
  // a plain choice moves straight on; one that needs typing waits for the text
  const choose = (o) => (o.free ? set({ [q.id]: o.v }) : advance({ ...answers, [q.id]: o.v }))

  if (done) {
    return (
      <motion.div className="glass pad-lg" style={{ maxWidth: 820, margin: '40px auto' }} {...popIn}>
        <div className="kicker mb8">Your profile</div>
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>How your courses will adapt to you, {LEARNER.name}</h1>
        <p className="muted small mt8">
          Each answer sets a starting default — a starting guess, not a verdict. The short pre-assessment that comes
          next, and what you actually do in the lessons, count for more. You can change any of this in Profile.
        </p>
        <div className="mt20"><AdaptationList profile={answers} /></div>

        <div className="row between wrap mt20">
          <Btn variant="ghost" size="sm" onClick={() => setI(0)}><ArrowLeft size={13} /> Change my answers</Btn>
          <div className="row wrap">
            {toCourse
              ? <Btn variant="primary" onClick={() => navigate('/precheck')}>Continue to the pre-assessment <ArrowRight size={14} /></Btn>
              : <Btn variant="primary" onClick={() => navigate('/dashboard')}>Go to the dashboard <ArrowRight size={14} /></Btn>}
          </div>
        </div>
      </motion.div>
    )
  }

  const value = answers[q.id]
  const freeOpt = q.type === 'single' ? q.options.find((o) => o.free && o.v === value) : null
  const typed = answers[`${q.id}Other`] || ''
  const answered = q.type === 'text' ? !!value?.trim() : q.type === 'multi' ? true : freeOpt ? !!typed.trim() : value !== null
  return (
    <motion.div className="glass pad-lg" style={{ maxWidth: 620, margin: '60px auto' }} {...fadeUp} key={q.id}>
      <div className="row between mb8">
        <div className="kicker">About you · {i + 1}/{QUESTIONS.length}</div>
        <span className="tag-mono">every question is optional</span>
      </div>
      <ProgressBar value={(i + 1) / QUESTIONS.length} label="Questionnaire progress" />
      <h1 id="q-title" style={{ fontSize: 25, margin: '22px 0 16px', lineHeight: 1.35 }}>{q.q}</h1>

      {q.type === 'text' && (
        <input
          className="input" aria-labelledby="q-title" autoFocus value={value || ''} placeholder={q.placeholder}
          onChange={(e) => set({ [q.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && value?.trim() && next()}
        />
      )}
      {q.type === 'single' && (
        <div role="group" aria-labelledby="q-title">
          {q.options.map((o) => (
            <button key={String(o.v)} type="button" className={`opt ${value === o.v ? 'sel' : ''}`} aria-pressed={value === o.v} onClick={() => choose(o)}>{o.label}</button>
          ))}
          {freeOpt && (
            <motion.div {...popIn}>
              <label className="fld" htmlFor="q-other">Tell us which</label>
              <input
                id="q-other" className="input" autoFocus value={typed} placeholder={freeOpt.free} maxLength={40}
                onChange={(e) => set({ [`${q.id}Other`]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && typed.trim() && next()}
              />
            </motion.div>
          )}
        </div>
      )}
      {q.type === 'multi' && (
        <div role="group" aria-labelledby="q-title">
          {q.options.map((o) => {
            const on = value.includes(o.v)
            return (
              <button key={o.v} type="button" className={`opt ${on ? 'sel' : ''}`} aria-pressed={on} onClick={() => set({ [q.id]: on ? value.filter((v) => v !== o.v) : [...value, o.v] })}>{o.label}</button>
            )
          })}
          <button type="button" className={`opt ${value.length === 0 ? 'sel' : ''}`} aria-pressed={value.length === 0} onClick={() => set({ [q.id]: [] })}>{q.noneLabel}</button>
        </div>
      )}

      <div className="row between wrap mt20">
        <Btn size="sm" variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}><ArrowLeft size={13} /> Back</Btn>
        <div className="row wrap">
          <Btn size="sm" variant="ghost" onClick={skip}>Skip</Btn>
          <Btn size="sm" variant="primary" disabled={!answered} onClick={next}>{i === QUESTIONS.length - 1 ? 'See how it adapts' : 'Next'} <ArrowRight size={13} /></Btn>
        </div>
      </div>
      <p className="tag-mono mt14">If you skip this: {q.ifSkipped}.</p>
    </motion.div>
  )
}
