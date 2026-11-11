import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, CalendarPlus, Wand2, HeartPulse, Play } from 'lucide-react'
import { Btn, PageHeader } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { usePlan, usePlanData } from '../stores/plan.js'
import { autoFill, monthGrid, dayKey, fromKey } from '../engine/plan.js'
import { unitList, unitDone, courseProgress, fmtMinutes } from '../engine/progress.js'
import { COURSE, MODULES } from '../content/course.js'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Monday first
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SESSIONS = [10, 20, 30, 45]
const shortDay = (key) => fromKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/* What a unit is "worth" on the right of its outline row. */
function unitDetail(m, u) {
  if (u.kind === 'guided' && m.guidedSteps) return `${m.guidedSteps} steps`
  if (u.kind === 'quiz' && m.quizQuestions) return `${m.quizQuestions} questions`
  return `${u.minutes} min`
}

/*
  Learning Plan — the learner puts sessions on the days they choose. The outline
  shows the sequence and what is left; the calendar shows what sits on each day.
  Nothing here is a deadline, and nothing is ever marked as missed.
*/
export default function LearningPlan() {
  const { sessions, progress, calibrate, paceFactor, prefs, remaining, days } = usePlanData()
  const addSession = usePlan((s) => s.addSession)
  const removeSession = usePlan((s) => s.removeSession)
  const setSessions = usePlan((s) => s.setSessions)
  const toggleDay = usePlan((s) => s.toggleDay)
  const setSessionMinutes = usePlan((s) => s.setSessionMinutes)

  const todayKey = dayKey(Date.now())
  const [selected, setSelected] = useState(todayKey)
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  const [picked, setPicked] = useState(null)

  const plannedOn = Object.fromEntries(sessions.map((s) => [`${s.moduleN}:${s.unit}`, s.date]))
  const unitId = remaining.some((u) => u.id === picked) ? picked : remaining[0]?.id
  const openSessions = sessions.filter((s) => remaining.some((u) => u.id === `${s.moduleN}:${s.unit}`))
  const overall = courseProgress(progress)
  const status = overall.done === 0 ? 'Not started' : overall.done === overall.total ? 'Shipped' : `In progress · ${Math.round(overall.value * 100)}%`

  const selectDay = (key) => {
    if (!key) return
    setSelected(key)
    const d = fromKey(key)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }
  const moveMonth = (by) => { const d = new Date(view.y, view.m + by, 1); setView({ y: d.getFullYear(), m: d.getMonth() }) }
  const plan = () => { const u = remaining.find((x) => x.id === unitId); if (u) addSession(selected, u.moduleN, u.unit) }
  const fill = () => setSessions([...sessions, ...autoFill({ progress, calibrate, prefs, paceFactor, sessions })])
  const clearPlanned = () => setSessions(sessions.filter((s) => !openSessions.includes(s)))

  const selectedItems = days[selected] || []
  const sessionCount = selectedItems.filter((it) => it.type === 'session').length

  return (
    <div>
      <PageHeader
        kicker="Your schedule"
        title="Learning plan"
        sub="Your lesson sequence and what’s left. Add sessions on the days you choose — nothing here is a deadline."
      />

      <div className="plan-layout">
        {/* ---------- add a session ---------- */}
        <GlassCard className="plan-add">
          <div className="kicker">Add plan</div>
          <p className="muted small mb14">Schedule a learning session on a day you choose.</p>
          {remaining.length > 0 ? (
            <>
              <div className="plan-add-row">
                <div>
                  <label className="fld" htmlFor="plan-day">Day</label>
                  <input id="plan-day" type="date" className="input" min={todayKey} value={selected} onChange={(e) => selectDay(e.target.value)} />
                </div>
                <div>
                  <label className="fld" htmlFor="plan-unit">Session</label>
                  <select id="plan-unit" className="input" value={unitId} onChange={(e) => setPicked(e.target.value)}>
                    {remaining.map((u, i) => (
                      <option key={u.id} value={u.id}>
                        Module {u.moduleN} — {u.label} · {u.minutes} min{i === 0 ? ' · next up' : ''}{plannedOn[u.id] ? ` · planned ${shortDay(plannedOn[u.id])}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <Btn variant="primary" onClick={plan}><CalendarPlus size={15} /> Plan session</Btn>
              </div>

              <div className="hr" />
              <div className="plan-auto">
                <div role="group" aria-label="Study days">
                  <div className="tag-mono mb8">study days</div>
                  <div className="day-pills">
                    {DAY_ORDER.map((d) => (
                      <button key={d} type="button" className="chip" aria-pressed={prefs.studyDays.includes(d)} onClick={() => toggleDay(d)}>{DAY_NAMES[d]}</button>
                    ))}
                  </div>
                </div>
                <div role="group" aria-label="Session length">
                  <div className="tag-mono mb8">a session is about</div>
                  <div className="seg">
                    {SESSIONS.map((m) => (
                      <button key={m} type="button" className="chip" aria-pressed={prefs.sessionMinutes === m} onClick={() => setSessionMinutes(m)}>{m} min</button>
                    ))}
                  </div>
                </div>
                <div className="row wrap plan-auto-actions">
                  <Btn onClick={fill} disabled={prefs.studyDays.length === 0 || remaining.every((u) => plannedOn[u.id])}><Wand2 size={15} /> Plan it for me</Btn>
                  <Btn variant="ghost" size="sm" onClick={clearPlanned} disabled={openSessions.length === 0}>Clear planned</Btn>
                </div>
              </div>
              <p className="tag-mono mt8">
                {prefs.studyDays.length === 0
                  ? 'pick at least one study day to use “plan it for me”'
                  : '“plan it for me” puts whatever isn’t planned yet on your study days, in order'}
              </p>
            </>
          ) : (
            <p className="small"><b>Every available module is shipped.</b> <span className="muted">Health checks still land on their dates in the calendar.</span> <Link to="/complete" className="link-btn">See what you’ve built</Link></p>
          )}
        </GlassCard>

        {/* ---------- study calendar ---------- */}
        <GlassCard className="plan-cal">
          <div className="row between">
            <h2>Study calendar</h2>
            <div className="row" style={{ gap: 4 }}>
              <Btn size="sm" variant="ghost" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={15} /></Btn>
              <b className="small cal-month" aria-live="polite">{new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
              <Btn size="sm" variant="ghost" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={15} /></Btn>
            </div>
          </div>
          <div className="cal-grid mt14" role="grid" aria-label="Study calendar">
            {DAY_ORDER.map((d) => <div key={d} className="cal-head" role="columnheader">{DAY_NAMES[d]}</div>)}
            {monthGrid(view.y, view.m).flat().map((date, i) => {
              if (!date) return <div key={`x${i}`} className="cal-cell empty" />
              const key = dayKey(date)
              const items = days[key] || []
              const open = items.filter((it) => !it.done)
              return (
                <button
                  key={key} type="button" role="gridcell"
                  className={`cal-cell ${key === todayKey ? 'today' : ''} ${key === selected ? 'sel' : ''}`}
                  aria-pressed={key === selected}
                  aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${items.length ? `, ${items.length} item${items.length > 1 ? 's' : ''}` : ''}`}
                  onClick={() => selectDay(key)}
                >
                  <span>{date.getDate()}</span>
                  <span className="cal-dots">
                    {open.some((it) => it.type === 'session') && <i className="dot plan" />}
                    {open.some((it) => it.type === 'review') && <i className="dot review" />}
                    {items.some((it) => it.done) && <i className="dot done" />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="row wrap cal-legend">
            <span><i className="dot plan" /> planned</span>
            <span><i className="dot review" /> health check</span>
            <span><i className="dot done" /> done</span>
            {selected !== todayKey && <Btn size="sm" variant="ghost" onClick={() => selectDay(todayKey)}>Today</Btn>}
          </div>

          <div className="hr" />
          <div className="row between">
            <b>{fromKey(selected).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            <span className="chip">{sessionCount} session{sessionCount === 1 ? '' : 's'}</span>
          </div>
          {selectedItems.length === 0 && <p className="muted small mt8">Nothing on this day.</p>}
          {selectedItems.map((it) => (
            <div key={it.id} className="cal-item">
              <span className={`chip ${it.done ? 'ok' : it.type === 'review' ? 'warn' : 'acc'}`}>
                {it.done ? <Check size={11} /> : it.type === 'review' ? <HeartPulse size={11} /> : null}
                {it.type === 'review' ? 'check' : `M${it.moduleN}`}
              </span>
              <span className="small cal-item-label">{it.label}<span className="tag-mono"> · {it.done ? it.note || 'done' : `${it.minutes} min`}</span></span>
              {!it.done && it.to && (
                <Link to={it.to} className="btn sm primary"><Play size={12} /> {it.type === 'review' ? 'Open' : 'Start'}</Link>
              )}
              {it.type === 'session' && !it.done && (
                <button type="button" className="link-btn" onClick={() => removeSession(it.sessionId)}>Remove</button>
              )}
            </div>
          ))}
        </GlassCard>

        {/* ---------- course outline ---------- */}
        <GlassCard className="plan-outline">
          <div className="row between wrap">
            <h2>{COURSE.title}</h2>
            <span className={`chip ${overall.done === overall.total ? 'ok' : overall.done ? 'acc' : ''}`}>{status}</span>
          </div>
          {MODULES.map((m) => (
            <div key={m.n} className="outline-module">
              <div className="row between">
                <h3>Module {m.n} · {m.title.split(':')[0]}</h3>
                {m.built
                  ? <span className="tag-mono">{fmtMinutes(unitList(m, paceFactor).reduce((n, u) => n + u.minutes, 0))}</span>
                  : <span className="chip">coming next</span>}
              </div>
              {/* one line per module: a circle per lesson, green once it is done */}
              <div className="steps">
                {m.built ? unitList(m, paceFactor).map((u, i) => {
                  const id = `${m.n}:${u.unit}`
                  const done = unitDone(progress[m.n], u)
                  const isNext = remaining[0]?.id === id
                  const canPlan = remaining.some((r) => r.id === id)
                  return (
                    <button
                      key={id} type="button" disabled={!canPlan}
                      className={`step ${done ? 'done' : ''} ${isNext ? 'next' : ''} ${unitId === id && canPlan ? 'sel' : ''}`}
                      aria-pressed={unitId === id && canPlan}
                      onClick={() => setPicked(id)}
                      title={canPlan ? 'Select this session in “Add plan”' : 'Done'}
                    >
                      <span className="step-circle">{done ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                      <span className="step-label">{u.label}</span>
                      <span className="tag-mono">{done ? 'done' : unitDetail(m, u)}</span>
                      {!done && (isNext || plannedOn[id]) && (
                        <span className={`chip ${isNext ? 'acc' : ''}`}>{plannedOn[id] ? shortDay(plannedOn[id]) : 'next up'}</span>
                      )}
                    </button>
                  )
                }) : m.submodules.map((sm) => (
                  <div key={sm.id} className="step muted-step">
                    <span className="step-circle">·</span>
                    <span className="step-label">{sm.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="tag-mono mt14">green = done · times are estimates · click a circle to select that lesson in “add plan”</p>
        </GlassCard>
      </div>
    </div>
  )
}
