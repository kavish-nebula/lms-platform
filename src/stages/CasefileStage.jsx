import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Flame, Radar, Rocket, X, Zap, AlertTriangle, Timer } from 'lucide-react'
import { Btn } from '../ui/bits.jsx'
import { play } from '../sound.js'
import { useSignals } from '../stores/signals.js'
import { popIn } from '../motion.js'

/*
  MISSION: FILE THE FLARES — the guided practice as a game.
  A real solved workflow (n8n's own tutorial: Schedule Trigger → NASA → If → PostBin)
  becomes mission control: the learner sets the cadence, teaches the expression,
  builds the routing condition, launches live runs — then Friday night happens,
  the credential expires mid-run, and they diagnose and fix it under alarm.
  Every action pays XP; mistakes cost rank, not progress. Pure HTML/SVG — no video.
*/

const NODES = [
  { id: 'trigger', icon: '⚡', label: 'Schedule Trigger', sub: '', x: 30, y: 116 },
  { id: 'nasa', icon: '🛰️', label: 'NASA', sub: 'get: DONKI flare', x: 258, y: 116 },
  { id: 'ifs', icon: '🔀', label: 'If', sub: 'route by class', x: 486, y: 116 },
  { id: 'ntrue', icon: '🌐', label: 'PostBin(true)', sub: 'major → alert', x: 716, y: 40 },
  { id: 'nfalse', icon: '🌐', label: 'PostBin(false)', sub: 'minor → archive', x: 716, y: 192 },
]
const WIRES = [
  { id: 'p1', d: 'M188,146 L258,146' },
  { id: 'p2', d: 'M416,146 L486,146' },
  { id: 'p3', d: 'M644,146 C682,146 682,70 716,70' },
  { id: 'p4', d: 'M644,146 C682,146 682,222 716,222' },
]

const OBJ = [
  { id: 'schedule', xp: 15, title: 'Wake it up', hint: 'Open the Schedule Trigger and set a cadence.' },
  { id: 'expression', xp: 20, title: 'Teach it “this week”', hint: 'In the NASA node, complete the expression so it always covers the last 7 days.' },
  { id: 'route', xp: 25, title: 'Route like a router', hint: 'In the If node, build the condition so MINOR flares go to false. Test with a B1.2.' },
  { id: 'launch', xp: 15, title: 'Launch the mission', hint: 'Press LAUNCH and watch real items fly the wires.' },
  { id: 'diagnose', xp: 20, title: 'Diagnose the silence', hint: 'Friday night came early. Something failed — open the node that failed and read it.' },
  { id: 'fix', xp: 20, title: 'Reconnect the credential', hint: 'You found the expired credential. Hold the reconnect button to re-auth.' },
  { id: 'prove', xp: 25, title: 'Prove it holds', hint: 'Same workflow, one field fixed. LAUNCH again and watch it hold.' },
]

export default function CasefileStage({ onDone, signalsKey }) {
  /* ---- mission state ---- */
  const [scheduleSet, setScheduleSet] = useState(false)
  const [cadence, setCadence] = useState(6)
  const [exprOk, setExprOk] = useState(false)
  const [exprVal, setExprVal] = useState('')
  const [exprHint, setExprHint] = useState('')
  const [routeOk, setRouteOk] = useState(false)
  const [condOp, setCondOp] = useState('≥')
  const [condVal, setCondVal] = useState('M')
  const [routeTest, setRouteTest] = useState(null) // { cls, to }
  const [launchedOnce, setLaunchedOnce] = useState(false)
  const [failed, setFailed] = useState(false)
  const [diagnosed, setDiagnosed] = useState(false)
  const [credOk, setCredOk] = useState(false)
  const [proved, setProved] = useState(false)
  const [panel, setPanel] = useState(null)
  const [xp, setXp] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [floats, setFloats] = useState([])
  const [log, setLog] = useState([{ text: 'Mission briefing loaded. The canvas is yours — start with the objectives.', tone: '' }])
  const [alarm, setAlarm] = useState(false)
  const [shake, setShake] = useState(false)
  const [holdPct, setHoldPct] = useState(0)
  const [busy, setBusy] = useState(false)
  const [tally, setTally] = useState({ in: 0, t: 0, f: 0 })
  const [finished, setFinished] = useState(false)
  const startT = useRef(Date.now())
  const cfx = useRef(null)
  const holdTimer = useRef(null)
  const ambient = useRef(null)
  const bump = useSignals((s) => s.bump)

  const flags = { schedule: scheduleSet, expression: exprOk, route: routeOk, launch: launchedOnce, diagnose: diagnosed, fix: credOk, prove: proved }
  const doneCount = OBJ.filter((o) => flags[o.id]).length
  const currentObj = OBJ.find((o) => !flags[o.id])

  const addXp = (n, label) => {
    setXp((x) => x + n)
    const id = Date.now() + Math.random()
    setFloats((f) => [...f, { id, text: `+${n} XP · ${label}` }])
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1600)
  }
  const say = (text, tone = '') => setLog((l) => [{ text, tone }, ...l].slice(0, 4))
  const oops = (text) => { setMistakes((m) => m + 1); play('wrong'); say(text, 'bad') }

  /* ---- ambient life: once the cadence is set, items drift through the pipeline ---- */
  useEffect(() => {
    if (!scheduleSet || finished) return
    const dot = async () => {
      const minor = Math.random() < 0.3
      await along('p1', 500); await along('p2', 500)
      await along(minor ? 'p4' : 'p3', 600)
    }
    const tick = () => { if (!document.hidden) dot() }
    const iv = setInterval(tick, 2600)
    const t0 = setTimeout(tick, 400)
    return () => { clearInterval(iv); clearTimeout(t0) }
  }, [scheduleSet, finished])

  useEffect(() => () => { if (holdTimer.current) clearInterval(holdTimer.current) }, [])

  /* ---- dot along a wire ---- */
  const along = (pid, dur) =>
    new Promise((res) => {
      const p = document.getElementById('ms-' + pid)
      if (!p) return res()
      const d = document.createElement('div')
      d.className = 'ms-dots'
      cfx.current?.appendChild(d)
      const L = p.getTotalLength()
      const t0 = performance.now()
      const f = (t) => {
        const k = Math.min(1, (t - t0) / dur)
        const pt = p.getPointAtLength(k * L)
        d.style.left = pt.x + 'px'
        d.style.top = pt.y + 'px'
        if (k < 1) requestAnimationFrame(f)
        else { d.remove(); res() }
      }
      requestAnimationFrame(f)
    })
  const flash = (id) => {
    const el = document.getElementById('ms-n-' + id)
    el?.classList.add('flash')
    setTimeout(() => el?.classList.remove('flash'), 900)
  }
  const complete = (id) => {
    const o = OBJ.find((x) => x.id === id)
    if (!o || flags[id]) return
    addXp(o.xp, o.title)
    play('correct')
    if (id === 'prove') finishMission()
  }

  /* ---- objective handlers ---- */
  const applyCadence = () => {
    setScheduleSet(true)
    complete('schedule')
    say(`Cadence set: every ${cadence}h. Watch the wires — items already drift through on schedule.`)
  }
  const checkExpr = () => {
    if (exprVal.trim() === '7') {
      setExprOk(true)
      complete('expression')
      say('Expression locked: $today.minus(7, \'days\') — the window slides with every run. Never grows old.')
    } else {
      oops(exprVal.trim() === '' ? 'Type the number that means “the last week”.' : 'That would cover the wrong window. The brief says: the last 7 days.')
    }
  }
  const testRoute = () => {
    const v = condVal.trim().toUpperCase()
    if (condOp === '≥' && v === 'M') {
      setRouteOk(true)
      complete('route')
      setBusy(true)
      Promise.all([along('p4', 750)]).then(() => { flash('nfalse'); setBusy(false) })
      setRouteTest({ cls: 'B1.2', to: 'false' })
      say('B1.2 ≥ M? No → false. Minor flares archive; the alert channel stays quiet.')
    } else if (condOp === '≥' && v === 'B') {
      oops('B1.2 ≥ B is TRUE — the minor flare would go to true and spam the alert channel. Aim the condition at MAJORS.')
    } else {
      oops('Try: class ≥ M. M-class and above are the majors worth waking someone for.')
    }
  }
  const launch = async () => {
    if (busy) return
    setBusy(true)
    play('whoosh')
    say('Launch — items incoming…')
    const items = 5
    const majors = 3
    let t = 0, f = 0
    for (let i = 0; i < items; i++) {
      const minor = i >= majors
      await along('p1', 380); await along('p2', 380)
      if (failed && !credOk) {
        document.getElementById('ms-n-nasa')?.classList.add('err')
        setShake(true); setTimeout(() => setShake(false), 500)
        setAlarm(true)
        play('wrong')
        bump(signalsKey, 'checkFails')
        setLog((l) => [{ text: '✖ NASA · 401 — invalid credentials · execution halted', tone: 'bad' }, ...l].slice(0, 4))
        say('It died at NASA — and everything after it never ran. This is what 2:07 AM feels like.', 'bad')
        setBusy(false)
        return
      }
      await along(minor ? 'p4' : 'p3', 550)
      flash(minor ? 'nfalse' : 'ntrue')
      minor ? f++ : t++
      setTally({ in: i + 1, t, f })
    }
    setBusy(false)
    if (!launchedOnce) { setLaunchedOnce(true); complete('launch') } else if (credOk) {
      setProved(true); complete('prove')
    }
    setTally({ in: items, t, f })
    setLog((l) => [{ text: `✓ ${items} in · ${t} major → true · ${f} minor → false · all green`, tone: 'good' }, ...l].slice(0, 4))
  }
  const diagnose = (id) => {
    if (failed && !diagnosed && id === 'nasa') {
      setDiagnosed(true)
      complete('diagnose')
      play('click')
    }
    setPanel(id)
  }
  const reconnect = () => {
    if (holdTimer.current || credOk) return
    play('click')
    say('Re-authenticating with NASA…')
    holdTimer.current = setInterval(() => {
      setHoldPct((pct) => {
        const next = pct + 9
        if (next >= 100) {
          clearInterval(holdTimer.current)
          holdTimer.current = null
          setCredOk(true)
          setAlarm(false)
          complete('fix')
          play('correct')
          say('Credential re-authenticated ✓ NASA account is live again.')
          return 0
        }
        return next
      })
    }, 90)
  }
  const finishMission = () => {
    setFinished(true)
    play('ship')
  }
  const mistakesRank = mistakes === 0 ? 'S' : mistakes <= 2 ? 'A' : mistakes <= 4 ? 'B' : 'C'
  const secs = Math.floor((Date.now() - startT.current) / 1000)
  const timeTxt = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  const target = currentObj
    ? currentObj.id === 'schedule' ? 'trigger'
      : currentObj.id === 'expression' ? 'nasa'
        : currentObj.id === 'route' ? 'ifs'
          : (currentObj.id === 'diagnose' || (currentObj.id === 'fix' && !diagnosed)) ? 'nasa'
            : null
    : null

  return (
    <div className="ms">
      {alarm && <div className="ms-alarmedge" />}

      <div className="ms-layout">
        {/* ---------- MISSION HUD ---------- */}
        <aside className="ms-hud">
          <div className="kicker mb8"><Radar size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Mission control</div>
          <b style={{ fontSize: 16 }}>File the flares</b>
          <div className="ms-xprow">
            <Flame size={13} color="var(--amber)" />
            <div className="ms-xpbar"><motion.div animate={{ width: `${Math.min(100, xp)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
            <span className="ms-xpnum">{xp} XP</span>
          </div>

          <div className="ms-objs">
            {OBJ.filter((o) => failed || (o.id !== 'diagnose' && o.id !== 'fix')).map((o) => (
              <motion.div key={o.id} layout className={`ms-obj ${flags[o.id] ? 'done' : currentObj?.id === o.id ? 'now' : ''}`}>
                <span className="ms-obj-ic">{flags[o.id] ? <Check size={12} strokeWidth={3} /> : currentObj?.id === o.id ? <Rocket size={12} /> : <Timer size={12} />}</span>
                <div>
                  <b>{o.title}</b>
                  {currentObj?.id === o.id && <p>{o.hint}</p>}
                </div>
                <em>+{o.xp}</em>
              </motion.div>
            ))}
          </div>

          <div className="ms-tally">
            <span><Zap size={11} /> {tally.in} items</span>
            <span className="good">↑ {tally.t} major</span>
            <span>{tally.f} minor ↓</span>
          </div>
          <AnimatePresence>
            {floats.map((f) => (
              <motion.div key={f.id} className="ms-float" initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: -18, scale: 1 }} exit={{ opacity: 0, y: -30 }}>
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </aside>

        {/* ---------- THE CANVAS ---------- */}
        <div className="ms-right">
          <div className={`cfx-card ms-canvas ${shake ? 'ms-shake' : ''}`} ref={cfx}>
            <svg className="cfx-wires" width="960" height="320" viewBox="0 0 960 320">
              {WIRES.map((w) => <path key={w.id} id={'ms-' + w.id} d={w.d} className={scheduleSet ? 'live' : ''} />)}
            </svg>
            {NODES.map((n) => (
              <div
                key={n.id}
                id={'ms-n-' + n.id}
                className={`cfx-node ms-node ${target === n.id ? 'target click' : ''} ${failed && n.id === 'nasa' && !credOk ? 'err' : ''} ${credOk && n.id === 'nasa' ? '' : ''}`}
                style={{ left: n.x, top: n.y }}
                onClick={() => diagnose(n.id)}
                role="button"
                aria-label={n.label}
              >
                <div className="top"><span className="ic">{n.icon}</span><div><b>{n.label}</b><small>{n.id === 'trigger' && scheduleSet ? `every ${cadence}h` : n.sub}</small></div></div>
              </div>
            ))}
            <button className={`cfx-wl ${routeTest?.to === 'true' ? 'right' : ''}`} style={{ left: 664, top: 94 }} onClick={() => testRoute()}>true</button>
            <button className={`cfx-wl ${routeTest?.to === 'false' ? 'right' : ''}`} style={{ left: 664, top: 170 }} onClick={() => testRoute()}>false</button>
            {failed && !credOk && <div className="cfx-bubble bad on" style={{ left: 214, top: 52 }}>NASA · 401 — invalid credentials</div>}
            {panel && (
              <motion.div className="cfx-panel ms-panel" {...popIn}>
                <button className="x" onClick={() => setPanel(null)} aria-label="Close panel"><X size={14} /></button>

                {panel === 'trigger' && (
                  <>
                    <h3>⚡ Schedule Trigger <span className="cfx-chip">Parameters</span></h3>
                    <div className="f"><label>Trigger interval — how often the doorbell rings</label>
                      <div className="row" style={{ gap: 6 }}>
                        {[1, 6, 24].map((h) => (
                          <button key={h} className={`btn ${cadence === h ? 'pri' : ''}`} style={{ padding: '6px 12px' }} onClick={() => { setCadence(h); play('click') }}>every {h}h</button>
                        ))}
                      </div>
                    </div>
                    <p className="ms-panel-note">6h → ~28 runs/week · 1h → faster flares, more noise. Pick one and apply.</p>
                    <Btn variant="primary" size="sm" onClick={applyCadence}>Apply cadence</Btn>
                  </>
                )}

                {panel === 'nasa' && (
                  <>
                    <h3>🛰️ NASA <span className="cfx-chip">Parameters</span></h3>
                    <div className="f"><label>Credential to connect with</label>
                      <div className="v cred">
                        <span>{failed && !credOk ? 'NASA account ⚠ expired' : credOk ? 'NASA account ✓ re-authed' : 'NASA account · demo key'}</span>
                        {failed && !credOk && (
                          <button className="btn ms-hold" onClick={reconnect}>
                            <span className="ms-hold-ring" style={{ width: `${holdPct}%` }} />{credOk ? '✓ live' : holdPct > 0 ? 'reconnecting…' : '↻ Reconnect'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="f"><label>Start date — make it always cover the last week</label>
                      <div className="v ex ms-expr">
                        <span>{'{{ $today.minus('}</span>
                        <input
                          value={exprVal}
                          onChange={(e) => setExprVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                          placeholder="?"
                          disabled={exprOk}
                          aria-label="days"
                          maxLength={2}
                        />
                        <span>{", 'days') }}"}</span>
                      </div>
                      {exprHint && <p className="ms-panel-bad">{exprHint}</p>}
                      {!exprOk && <Btn size="sm" style={{ marginTop: 8 }} onClick={checkExpr}>Check expression</Btn>}
                      {exprOk && <p className="ms-panel-note" style={{ color: 'var(--ok-ink)' }}>Result preview: a date 7 days before today — recomputed on every run ✓</p>}
                    </div>
                  </>
                )}

                {panel === 'ifs' && (
                  <>
                    <h3>🔀 If <span className="cfx-chip">Condition</span></h3>
                    <div className="f"><label>Route items — build the condition</label>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="ms-cond">class</span>
                        {['≥', '<', '='].map((op) => (
                          <button key={op} className={`btn ${condOp === op ? 'pri' : ''}`} style={{ padding: '6px 12px' }} onClick={() => { setCondOp(op); play('click') }}>{op}</button>
                        ))}
                        <input
                          className="ms-val"
                          value={condVal}
                          onChange={(e) => setCondVal(e.target.value.slice(0, 2))}
                          aria-label="class value"
                        />
                        <span className="ms-cond">→ true</span>
                      </div>
                    </div>
                    <Btn size="sm" onClick={() => { setRouteTest(null); testRoute() }}>Send test item: B1.2 (minor)</Btn>
                    {routeOk && <p className="ms-panel-note" style={{ color: 'var(--ok-ink)' }}>Condition set — B1.2 tested and routed to false ✓</p>}
                  </>
                )}

                {(panel === 'ntrue' || panel === 'nfalse') && (
                  <>
                    <h3>🌐 {panel === 'ntrue' ? 'PostBin(true)' : 'PostBin(false)'} <span className="cfx-chip">Endpoint</span></h3>
                    <p className="ms-panel-note">{panel === 'ntrue' ? 'Major flares (M+) land here — these wake a human.' : 'Minor flares archive here silently. Boring on purpose.'}</p>
                  </>
                )}
              </motion.div>
            )}
          </div>

          {/* ---------- CONSOLE ---------- */}
          <div className="cfx-card cfx-instr">
            <div className="row between wrap">
              <div className="row"><span className="cfx-chip">{failed && !credOk ? '⚠ INCIDENT' : currentObj ? `Objective ${doneCount + 1} / ${OBJ.length}` : 'All objectives clear'}</span><b>{failed && !credOk ? 'The run died at NASA.' : currentObj ? currentObj.title : 'Mission complete — prove it anytime.'}</b></div>
              <div className="row" style={{ gap: 8 }}>
                <Btn variant="primary" disabled={busy || !scheduleSet || (failed && !credOk)} onClick={launch}>
                  <Rocket size={13} /> {failed && !credOk ? 'Systems down' : 'LAUNCH'}
                </Btn>
                {!failed && launchedOnce && !credOk && (
                  <Btn onClick={() => { setFailed(true); setAlarm(true); play('drill'); say('Friday night, 2:07 AM: the NASA credential expired. LAUNCH again and watch what the alert never saw.', 'bad') }}>
                    <AlertTriangle size={13} /> It's Friday night
                  </Btn>
                )}
              </div>
            </div>
            <div className="ms-console">
              {log.map((l, i) => <p key={i} className={`ms-line ${l.tone}`}>{l.text}</p>)}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- MISSION COMPLETE ---------- */}
      {finished && (
        <motion.div className="cfx-win" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div className="cfx-win-card" {...popIn}>
            <div className="ms-rank">{mistakesRank}</div>
            <div className="cfx-big">Mission complete — the flares are filed.</div>
            <p className="muted small">Every number here is yours: earned in this canvas, in this session.</p>
            <div className="ms-stats">
              <div><b>{xp}</b><span>XP earned</span></div>
              <div><b>{timeTxt}</b><span>mission time</span></div>
              <div><b>{mistakes}</b><span>missteps</span></div>
              <div><b>5</b><span>flares filed</span></div>
            </div>
            <ul className="ms-take">
              <li>A trigger wakes the workflow — no trigger, no run</li>
              <li>Expressions compute fresh on every run — workflows never grow old</li>
              <li>Conditions route items — and you built one yourself</li>
              <li>Green ≠ proof: you read the 401, found the field, fixed it</li>
            </ul>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <Btn onClick={() => setFinished(false)}>Keep exploring</Btn>
              <Btn variant="primary" onClick={onDone}>Now run OUR pipeline →</Btn>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
