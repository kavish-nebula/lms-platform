import { useLayoutEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Workflow, Zap, Boxes, Send, Table2, ClipboardList, Clock3, Webhook, BellOff, Download, Pencil, Split,
  ArrowRight, XCircle, Eye, AlertTriangle, FileText, Headset, Check, X, Lightbulb, CheckCircle2,
  Filter, Copy, Database, Braces, CalendarDays, ShoppingCart, Factory, UserRound, Mail, Search, Scale,
} from 'lucide-react'

const ICONS = {
  workflow: Workflow, zap: Zap, boxes: Boxes, send: Send, table: Table2, form: ClipboardList, clock: Clock3,
  webhook: Webhook, 'bell-off': BellOff, download: Download, pencil: Pencil, split: Split, 'arrow-right': ArrowRight,
  'x-circle': XCircle, eye: Eye, alert: AlertTriangle, file: FileText, headset: Headset,
  filter: Filter, copy: Copy, database: Database, code: Braces, calendar: CalendarDays, shop: ShoppingCart,
  factory: Factory, user: UserRound, mail: Mail, search: Search,
}
const Icon = ({ name, ...rest }) => { const C = ICONS[name] || Boxes; return <C {...rest} /> }

/* Something on a slide that appears when the narration reaches it. It keeps its place while hidden. */
function R({ on, children, className = '', x = 0, y = 14 }) {
  return (
    <motion.div
      className={className} initial={false} aria-hidden={!on}
      animate={{ opacity: on ? 1 : 0, x: on ? 0 : x, y: on ? 0 : y, scale: on ? 1 : 0.98 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/*
  One slide of a concept video. `shown(cue)` says whether the narration has
  reached sentence `cue` yet; each kind lays its content out like a presentation slide.
*/
export default function Slide({ slide: s, shown }) {
  /*
    Nothing may leave the slide frame. Everything on a slide is laid out from the
    start (hidden items keep their place), so its full height is known at once:
    if it is taller than the frame, the whole slide is scaled down to fit.
  */
  const frame = useRef(null)
  const body = useRef(null)
  useLayoutEffect(() => {
    const fit = () => {
      const b = body.current
      // measure at natural size, then shrink only if needed (a wider, scaled body can only get shorter)
      b.style.transform = 'none'
      b.style.width = '100%'
      const room = frame.current.clientHeight
      // the lowest edge of anything on the slide, measured from the top of the frame
      const top = frame.current.getBoundingClientRect().top
      let need = b.scrollHeight
      for (const el of b.querySelectorAll('*')) need = Math.max(need, el.getBoundingClientRect().bottom - top)
      if (need <= room) return
      const scale = Math.max(0.5, (room / need) * 0.99)
      b.style.transform = `scale(${scale})`
      b.style.width = `${100 / scale}%`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(frame.current)
    return () => ro.disconnect()
  }, [s])

  return (
    <motion.div className="vl-slide" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
      <div className="vl-frame" ref={frame}>
        <div className={`vl-body vl-k-${s.kind}`} ref={body}>
          {s.kind !== 'title' && <h3 className="vl-title">{s.title}</h3>}
          {KIND[s.kind](s, shown)}
        </div>
      </div>
    </motion.div>
  )
}

const KIND = {
  title: (s) => (
    <div className="vl-cover">
      <span className="vl-cover-ic"><Icon name={s.icon} size={44} /></span>
      <div className="vl-kicker">{s.kicker}</div>
      <h3 className="vl-cover-title">{s.title}</h3>
      <p className="vl-cover-sub">{s.sub}</p>
    </div>
  ),

  compare: (s, shown) => (
    <div className="vl-cols">
      {[s.left, s.right].map((side) => (
        <R key={side.label} on={shown(side.cue)} className={`vl-col ${side.tone}`}>
          <div className="vl-col-head">{side.tone === 'ok' ? <Check size={18} /> : side.tone === 'bad' ? <X size={18} /> : <Scale size={18} />} {side.label}</div>
          <ul>
            {side.points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </R>
      ))}
    </div>
  ),

  define: (s, shown) => (
    <div className="vl-define">
      <R on={shown(0)} className="vl-def-card">
        <div className="vl-kicker">{s.term}</div>
        <p className="vl-def">{s.definition}</p>
        <div className="vl-def-parts">
          {s.parts.map((p, i) => <R key={i} on={shown(p.cue)} className="vl-chip">{p.text}</R>)}
        </div>
      </R>
      <R on={shown(s.parts.at(-1).cue + 1)} className="vl-aside">
        <Lightbulb size={20} />
        <div><b>{s.analogy.label}</b><p>{s.analogy.text}</p></div>
      </R>
    </div>
  ),

  flow: (s, shown) => (
    <div className="vl-flowwrap">
      <div className="vl-flow" style={{ '--n': s.nodes.length }}>
        {s.nodes.map((n, i) => {
          // in a "run", a node turns green once the narration has moved on to the next one
          const ran = s.run && shown(s.nodes[i + 1]?.cue ?? s.note.cue)
          return (
            <div key={i} className="vl-flow-step">
              {i > 0 && <R on={shown(n.cue)} y={0} x={-10} className={`vl-arrow ${s.run && shown(n.cue) ? 'live' : ''}`}><span /><ArrowRight size={22} /></R>}
              <R on={shown(n.cue)} className={`vl-node ${n.kind} ${ran ? 'ran' : ''}`}>
                <span className="vl-node-ic">{ran ? <CheckCircle2 size={26} /> : <Icon name={n.icon} size={26} />}</span>
                <b>{n.label}</b>
                <span>{n.sub}</span>
              </R>
            </div>
          )
        })}
      </div>
      <R on={shown(s.note.cue)} className="vl-note">{s.note.text}</R>
    </div>
  ),

  bullets: (s, shown) => (
    <div className="vl-split">
      <div>
        <p className="vl-lead">{s.lead}</p>
        <ul className="vl-bullets">
          {s.bullets.map((b, i) => (
            <li key={i}><R on={shown(b.cue)} x={-14} y={0} className="vl-bullet"><span className="vl-bullet-ic"><Icon name={b.icon} size={20} /></span>{b.text}</R></li>
          ))}
        </ul>
      </div>
      <R on={shown(s.aside.cue)} className="vl-aside tall">
        <Icon name={s.aside.icon} size={26} />
        <div><b>{s.aside.label}</b><p>{s.aside.text}</p></div>
      </R>
    </div>
  ),

  example: (s, shown) => (
    <div className="vl-example">
      <p className="vl-lead"><b>Scenario: </b>{s.scenario}</p>
      <ol className="vl-steps">
        {s.steps.map((st, i) => (
          <li key={i}>
            <R on={shown(st.cue)} x={-14} y={0} className="vl-step">
              <span className="vl-time-tag">{st.time}</span>
              <span className="vl-bullet-ic"><Icon name={st.icon} size={18} /></span>
              {st.text}
            </R>
          </li>
        ))}
      </ol>
      <R on={shown(s.result.cue)} className="vl-note ok">{s.result.text}</R>
    </div>
  ),

  cards: (s, shown) => (
    <div className="vl-cards">
      {s.cards.map((c, i) => (
        <R key={i} on={shown(c.cue)} className="vl-card">
          <div className="vl-card-head"><Icon name={c.icon} size={22} /> {c.title}</div>
          {c.flow.map((f, k) => (
            <div key={k} className="vl-card-row">
              <span className="vl-card-tag">{['Trigger', 'Step', 'Action'][k]}</span>{f}
            </div>
          ))}
        </R>
      ))}
    </div>
  ),

  table: (s, shown) => (
    <div className="vl-tablewrap">
      <div className="vl-table" style={{ '--cols': s.columns.length }}>
        <div className="vl-tr head">{s.columns.map((c) => <span key={c}>{c}</span>)}</div>
        {s.rows.map((r, i) => (
          <R key={i} on={shown(r.cue)} y={8} className={`vl-tr ${r.tone || ''}`}>{r.cells.map((c, k) => <span key={k}>{c}</span>)}</R>
        ))}
      </div>
      <R on={shown(s.note.cue)} className="vl-note">{s.note.text}</R>
    </div>
  ),

  code: (s, shown) => (
    <div className="vl-split">
      <div>
        <p className="vl-lead">{s.lead}</p>
        <div className="vl-code">
          {s.rows.map((r, i) => (
            <R key={i} on={shown(r.cue)} x={-14} y={0} className="vl-code-row">
              <code>{r.code}</code><ArrowRight size={18} /><span>{r.out}</span>
            </R>
          ))}
        </div>
      </div>
      <R on={shown(s.aside.cue)} className="vl-aside tall">
        <Icon name={s.aside.icon} size={26} />
        <div><b>{s.aside.label}</b><p>{s.aside.text}</p></div>
      </R>
    </div>
  ),

  recap: (s, shown) => (
    <ul className="vl-recap">
      {s.points.map((p, i) => (
        <li key={i}><R on={shown(p.cue)} x={-14} y={0} className="vl-recap-row"><CheckCircle2 size={24} />{p.text}</R></li>
      ))}
    </ul>
  ),

  /*
    A real screenshot, toured like footage: the camera glides to each hotspot as
    the narration reaches it, the rest of the shot dims, and a ring marks the spot.
    Coordinates are percentages of the image, so the tour scales with the frame.
  */
  shot: (s, shown) => <ShotSlide s={s} shown={shown} />,
}

function ShotSlide({ s, shown }) {
  const active = [...(s.hotspots || [])].filter((h) => shown(h.cue)).at(-1) || null
  const z = active ? (s.zoom || 1.55) : 1
  // keep the active spot centred: translate is the inverse of the scale around centre
  const tx = active ? -(z * (active.x - 50)) : 0
  const ty = active ? -(z * (active.y - 50)) : 0
  return (
    <div className="vl-shot">
      <motion.div
        className="vl-shot-cam"
        animate={{ scale: z, x: `${tx}%`, y: `${ty}%` }}
        transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
      >
        <img src={s.src} alt={s.alt || s.title} draggable={false} />
        {s.hotspots?.map((h, i) => (
          <span key={i} className={`vl-shot-mark ${active === h ? 'on' : ''}`} style={{ left: `${h.x}%`, top: `${h.y}%`, opacity: shown(h.cue) ? 1 : 0 }} />
        ))}
        {active && (
          <span className="vl-shot-cut" style={{ left: `${active.x}%`, top: `${active.y}%`, width: `${130 / z}px` }}>
            <span className="vl-shot-ring" />
            <span className="vl-shot-label">{active.label}</span>
          </span>
        )}
      </motion.div>
      <R on={shown(s.cue)} className="vl-shot-cap"><Eye size={13} /> {s.cap}</R>
    </div>
  )
}
