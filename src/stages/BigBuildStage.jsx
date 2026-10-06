import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, ChevronLeft, ChevronRight, Inbox, Pause, Play, Sparkles, TriangleAlert, Volume2, VolumeX, Wrench,
} from 'lucide-react'
import { Btn } from '../ui/bits.jsx'
import { play } from '../sound.js'
import { useSignals } from '../stores/signals.js'
import { splitSentences } from '../canvas/useNarration.js'
import { popIn } from '../motion.js'

/*
  THE BIG BUILD — guided practice as a video replacement.
  One big real problem (an agency's lead desk drowning in form submissions),
  taught in the exact sequence popular n8n YouTube tutorials use:
    hook (see the finished thing) → the problem → the map →
    build node-by-node (WHY → exact CONFIG → the DATA through it → what breaks)
    → the mistake, made on camera, fixed → final test → improvements.
  Play mode auto-advances like a video; step mode lets the learner drive.
  Every beat's text is written as a voice script, so it can become real TTS later.
*/

/* ---------------- the content (M1 · AI Lead Desk, part 1) ---------------- */

const LEADS = [
  { name: '  Priya Nair ', email: '  Priya@XeroCoffee.com ', company: 'Xero Coffee', budget: '2500', msg: 'Need ~200 bags/month for our offices. Can we talk Monday?' },
  { name: 'james liu', email: 'james.liu@gmail.com', company: '', budget: '400', msg: 'pricing?' },
  { name: 'ASDF', email: 'asdf@buy-fast.io', company: 'ASDF', budget: '99999', msg: 'CHEAP LEADS BUY NOW' },
  { name: 'Marc Oliveira', email: ' marc@brewco.pt ', company: 'BrewCo', budget: '1200', msg: '' },
  { name: '  Priya Nair ', email: '  Priya@XeroCoffee.com ', company: 'Xero Coffee', budget: '2500', msg: 'Need ~200 bags/month for our offices. Can we talk Monday?' },
  { name: 'Sara Kim', email: 'sara@atlas-labs.io', company: 'Atlas Labs', budget: '1800', msg: 'Refill program for our 40-person team. Timeline this quarter.' },
  { name: 'unknown', email: '', company: '', budget: '', msg: '' },
  { name: 'Tom Reagan', email: 'tom@reaganconsulting.com', company: 'Reagan Consulting', budget: '3000', msg: 'Corporate gifting, 150 clients. What is the lead time?' },
  { name: 'deepak', email: 'deepak@freemail.com', company: '', budget: '150', msg: 'hii' },
  { name: 'Elena Duarte', email: 'elena@duartegroup.com', company: 'Duarte Group', budget: '900', msg: 'Sample pack for an event first, maybe ongoing.' },
]

/* n8n-style glyphs — white on brand tiles, like the real editor */
const G = {
  sheets: <svg viewBox="0 0 24 24" width="17" height="17"><rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="#fff" strokeWidth="2" /><path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h7M12 9.5v7" stroke="#fff" strokeWidth="1.5" /></svg>,
  slack: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" strokeLinecap="round" strokeWidth="2.6"><path d="M10 4v6.2H4.2" stroke="#36C5F0" /><path d="M14 20v-6.2h5.8" stroke="#ECB22E" /><path d="M20 10h-6.2V4.2" stroke="#2EB67D" /><path d="M4 14h6.2v5.8" stroke="#E01E5A" /></svg>,
  sliders: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M4 8h16M4 16h16" /><circle cx="9.5" cy="8" r="2.4" fill="#fff" stroke="none" /><circle cx="15" cy="16" r="2.4" fill="#fff" stroke="none" /></svg>,
  funnel: <svg viewBox="0 0 24 24" width="17" height="17"><path d="M4 5h16l-6.2 7.2v5.3L10.2 20v-7.8L4 5z" fill="#fff" /></svg>,
  if: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 4v5M12 9l-5.5 5.5M12 9l5.5 5.5" /><circle cx="12" cy="4.4" r="1.6" fill="#fff" stroke="none" /><circle cx="6" cy="15.5" r="1.6" fill="#fff" stroke="none" /><circle cx="18" cy="15.5" r="1.6" fill="#fff" stroke="none" /></svg>,
}

const NODES = [
  { id: 'trigger', icon: G.sheets, brand: '#188038', label: 'Google Sheets Trigger', sub: 'On row added', x: 20, y: 116 },
  { id: 'set', icon: G.sliders, brand: '#3b4d59', label: 'Edit Fields (Set)', sub: '3 fields set', x: 196, y: 116 },
  { id: 'filter', icon: G.funnel, brand: '#3b4d59', label: 'Filter', sub: '2 conditions', x: 372, y: 116 },
  { id: 'ifs', icon: G.if, brand: '#3b4d59', label: 'If', sub: 'budget ≥ $1k', x: 548, y: 116 },
  { id: 'slack', icon: G.slack, brand: '#4A154B', label: 'Slack', sub: 'message → #sales', x: 724, y: 34 },
  { id: 'log', icon: G.sheets, brand: '#188038', label: 'Google Sheets', sub: 'append → Nurture', x: 724, y: 192 },
]
const WIRES = [
  { id: 'w1', d: 'M178,146 L196,146' },
  { id: 'w2', d: 'M354,146 L372,146' },
  { id: 'w3', d: 'M530,150 L548,150' },
  { id: 'w4', d: 'M706,150 C736,150 736,64 748,64' },
  { id: 'w5', d: 'M706,150 C736,150 736,222 748,222' },
]

const CHAPTERS = [
  {
    id: 'hook', kicker: 'The hook', title: 'This is what you will have built',
    text: 'Six nodes. Every form submission — cleaned, checked, routed. Qualified leads in #sales within a minute, with a line that says WHY they matter. Junk and maybes never reach a human. Nothing gets lost quietly.',
  },
  {
    id: 'problem', kicker: 'The problem', title: '200 leads a week. One inbox. No process.',
    text: 'This agency’s leads land in a Google Sheet from the website form. Sales checks “when they can”. Click the rows below — this is what actually comes in.',
  },
  {
    id: 'setup', kicker: 'Setup · 5 minutes, once', title: 'Get n8n running on your machine',
    text: 'Everything you’re about to read is buildable in a real n8n — free. The configurations coming up are copy-paste ready.',
    steps: [
      ['Create your n8n', 'Zero install: start the free trial at cloud.n8n.io — or self-host with one command:'],
      ['(self-host)', 'docker run -it --rm -p 5678:5678 n8nio/n8n  →  open http://localhost:5678'],
      ['Create a workflow', 'Workflows → “Create Workflow” — a blank canvas opens.'],
      ['Name it', 'Click “My workflow” top-left → rename to “AI Lead Desk — part 1”. Named workflows save you from the graveyard of Untitled-1.'],
      ['First rule of n8n', 'Every workflow starts with a trigger. Yours is next — that’s why the build starts there.'],
    ],
  },
  {
    id: 'map', kicker: 'The plan', title: 'Six nodes — the whole architecture',
    text: 'Good builders decide the shape before touching a node. Read it left to right: a front door, one cleanup, one guard, one decision, two outcomes. Sixty seconds — then we build it for real.',
  },
  {
    id: 'trigger', node: 'trigger', kicker: 'Build · node 1 / 5', title: 'Google Sheets Trigger — the front door',
    why: 'The form writes every submission to the “Leads (website form)” sheet. This trigger polls it every minute and starts an execution on each new row. Polling is the simplest, most reliable start — no public URL to expose. When the agency needs leads in seconds instead of a minute, you swap this single node for a Webhook and nothing else changes.',
    breaks: 'Skip it and there is no front door — the workflow is a machine that never starts.',
    cfg: [
      ['Node', 'Google Sheets Trigger'],
      ['Event', 'On Row Added'],
      ['Document', 'Leads (website form)'],
      ['Sheet', 'Form Responses 1'],
      ['Polling', 'Every minute'],
    ],
    before: null,
    after: { row_number: 41, firstName: '  Priya Nair ', email: '  Priya@XeroCoffee.com ', company: 'Xero Coffee', budget: '2500', msg: 'Need ~200 bags/month…' },
    dataNote: 'The trigger hands over the row exactly as the sheet has it — untouched. Spaces, capital letters and all. That mess is the next node’s job.',
  },
  {
    id: 'set', node: 'set', kicker: 'Build · node 2 / 5', title: 'Edit Fields (Set) — clean it once, early',
    why: '“ Priya@XeroCoffee.com ” with spaces and capitals is not the same string to a computer as “priya@xerocoffee.com”. Edit Fields trims, lowercases, renames — once, here — so every later node reads clean fields. Fix data at the door, not in five places downstream.',
    breaks: 'Skip it and the duplicate guard misses “ Priya@X “ vs “priya@x” — the same lead alerts twice. Expressions everywhere downstream get uglier.',
    cfg: [
      ['Field: firstName', '{{ $json.firstName.trim() }}'],
      ['Field: email', '{{ $json.email.trim().toLowerCase() }}'],
      ['Field: budget', '{{ Number($json.budget) }}'],
      ['Include Other Input Fields', 'false — in with the new, out with the old'],
    ],
    before: { firstName: '  Priya Nair ', email: '  Priya@XeroCoffee.com ', budget: '2500' },
    after: { firstName: 'Priya Nair', email: 'priya@xerocoffee.com', budget: 2500 },
    dataNote: 'Spaces gone, email lowercased, budget became a real number (so “2500” ≥ 1000 works as math, not text).',
    quiz: {
      q: 'Why clean the data here — node 2 — instead of inside each later node?',
      opts: ['Later nodes are not allowed to use expressions', 'Fix it once at the door, or every node re-fixes it — and one forgotten node breaks the guard', 'The Set node is faster than other nodes'],
      correct: 1,
      hint: 'Count the nodes after this one. Where would you rather fix data — once, or five times?',
    },
  },
  {
    id: 'filter', node: 'filter', kicker: 'Build · node 3 / 5', title: 'Filter — the junk guard',
    why: 'Empty emails, double-submits, “CHEAP LEADS BUY NOW”. This node checks each item: a real email, and not one we have already seen today. What fails stops here — silently, permanently, on purpose.',
    breaks: 'Skip it and spam lands in #sales with the founder’s phone buzzing — the channel dies of noise within a week.',
    cfg: [
      ['Condition 1', '{{ $json.email }} contains @'],
      ['Condition 2', '{{ $json.msg }} is not empty'],
      ['Condition 3', 'email not in “seen today” list — kills double-clicks'],
      ['On fail', 'item stops. No error. That is the job.'],
    ],
    before: [
      { email: 'james.liu@gmail.com', msg: 'pricing?' },
      { email: '', msg: '' },
      { email: 'asdf@buy-fast.io', msg: 'CHEAP LEADS BUY NOW' },
    ],
    after: [{ email: 'james.liu@gmail.com', msg: 'pricing?' }],
    dataNote: 'Three in — one out. The empty row and the spam row stopped here. The double-submit rule catches Priya’s second POST later.',
    quiz: {
      q: 'The row with no email fails here. Where does it go?',
      opts: ['To the false branch, logged for later', 'Nowhere — it stops at the Filter, on purpose', 'Back to the form'],
      correct: 1,
      hint: 'A Filter is a guard, not a router. What does a guard do with a failed item?',
    },
  },
  {
    id: 'ifs', node: 'ifs', kicker: 'Build · node 4 / 5', title: 'If — who is worth the phone call',
    why: 'Junk is gone; now the business decision: budget ≥ $1000 means a real opportunity → the founder wants to know now. Smaller budgets are still leads — they go to the nurture sheet, logged but never lost. Two outcomes, one decision, and the team can tune the number any Tuesday without touching the rest.',
    breaks: 'Skip it and every $150 “hii” pings #sales like it’s a $3000 deal. The channel becomes noise; the real ones get missed.',
    cfg: [
      ['Condition', '{{ $json.budget }} is greater than or equal to 1000'],
      ['true →', 'Slack #sales — the loud path'],
      ['false →', 'Sheet “Nurture” — the quiet path'],
    ],
    before: [
      { email: 'james.liu@gmail.com', budget: 400 },
      { email: 'priya@xerocoffee.com', budget: 2500 },
    ],
    after: { branch: 'false → Nurture', for: 'james.liu@gmail.com' },
    dataNote: 'James: $400 → false branch, logged quietly. Priya: $2500 → true, on her way to #sales.',
  },
  {
    id: 'slack', node: 'slack', kicker: 'Build · node 5 / 5', title: 'Slack — Send a message',
    why: 'The alert carries the lead’s fields AND the why-line: “budget ≥ $1k + real message”. At 9pm, “score 80” means nothing; “budget ≥ $1k + real message” tells sales exactly why this one was flagged — and it tells you when the rule misfires.',
    breaks: 'Skip the why-line and sales gets a name with no context — they stop trusting the channel, and un-trusted alerts are unread alerts.',
    cfg: [
      ['Node', 'Slack — Message'],
      ['Send Message To', 'Channel'],
      ['Select a Channel', '#sales'],
      ['Message Text', '🔥 New lead: {{ $json.firstName }} — {{ $json.company }} | Budget: ${{ $json.budget }} | Why: budget ≥ $1k + real message | “{{ $json.msg }}”'],
      ['Credential', 'Slack account (Bot token OAuth)'],
    ],
    before: { firstName: 'Priya Nair', company: 'Xero Coffee', budget: 2500, msg: 'Need ~200 bags/month…' },
    after: { posted: '#sales', alert: '🔥 New lead: Priya Nair — Xero Coffee · Budget: $2500 · Why: budget ≥ $1k + real message' },
    dataNote: 'This is the message sales sees on their phone. One glance: who, how big, why it was flagged, and the actual words.',
  },
  {
    id: 'mistake', kicker: 'The trap', title: 'Everything is green. And nothing works.',
    text: 'Three weeks later. Runs show green, every day. But sales says #sales has been quiet since Monday. The workflow “works”. Click the nodes — find where the truth lives.',
  },
  {
    id: 'finaltest', kicker: 'The real test', title: 'Ten messy rows, end to end',
    text: 'Now the whole pipeline against the real inbox — junk, duplicates, the lot. Count with me.',
  },
  {
    id: 'outro', kicker: 'What you built', title: 'A pipeline you can defend',
    text: 'You didn’t watch an automation — you made the decisions: the front door, the one-place cleanup, the guard, the business rule, the alert that explains itself, and the debugging that proved green ≠ working. This exact pipeline is artifact #1 in your portfolio. Next modules grow this same system: harder data (M2), branching and enrichment APIs (M3), and the AI scorer that changes everything (M4).',
  },
]

const INBOX_NOTES = {
  0: 'Real lead — but look at the email: spaces + capitals. A naive duplicate check will miss her twin later.',
  1: '$400 — real human, small budget. Should NOT wake the founder… but shouldn’t be lost either.',
  2: 'Spam. Loudest row in the sheet. If #sales ever sees this, the channel loses trust.',
  3: 'Real, $1200 — but message is EMPTY. Is that junk? Your call — this exact row starts an argument in every team.',
  4: 'Wait — Priya again? The form double-submitted. Two identical rows. This is the duplicate problem.',
  6: 'Completely empty. A bot or a broken embed. This row must never reach a human.',
}

/* the voice script — spoken by the browser's speech engine, doubles as the TTS script */
const VOICE = {
  hook: 'This is what you will have built. Six nodes. Every form submission — cleaned, checked, routed. Qualified leads in Slack within a minute, with a line that says why they matter. Junk and maybes never reach a human. Nothing gets lost quietly.',
  problem: 'Two hundred leads a week land in this sheet, and sales checks it when they can. Click the rows — this is what actually comes in. Empty emails. Double submits. Spam. And real leads hidden in between.',
  setup: 'Five minutes of setup, once. Create your n8n — the cloud free trial, or self-host with one docker command. Create a workflow, name it AI Lead Desk part one, and you are on the canvas. The configurations in this build are copy-paste ready.',
  map: 'The whole plan, before we touch anything. Read it left to right: a front door, one cleanup, one guard, one decision, two outcomes. Sixty seconds to understand — then we build it for real.',
  trigger: 'Node one: the front door. A Google Sheets trigger — on row added. The form writes to the sheet, and within a minute n8n picks it up and starts an execution. Polling the sheet is the simplest start; when you need it instant, you swap this one node for a webhook.',
  set: 'Node two: Edit Fields, the Set node. Priya’s email arrives with spaces and capital letters. This node trims, lowercases and renames — once, at the door — so every later node reads clean fields. Fix data here, or fix it in five places downstream.',
  filter: 'Node three: the junk guard. Empty emails, double submits, spam. The filter checks each item — a real email, and not one we have already seen today. What fails stops here. Silently. Permanently. On purpose.',
  ifs: 'Node four: the business decision. Budget above one thousand dollars means a real opportunity — the founder wants to know now. Smaller budgets still go to the nurture sheet. Logged — never lost.',
  slack: 'Node five: the alert that explains itself. It carries the lead’s fields, and the why line — budget above one k, plus a real message. At nine pm, a bare score means nothing. The why line tells sales exactly why this one was flagged.',
  mistake: 'Now the trap. Three weeks later. Runs show green, every day. But sales says the channel has been quiet since Monday. Everything is green — and nothing works. Click the nodes. Find where the truth lives.',
  finaltest: 'The real test. Ten messy rows, end to end. Count with me. Ten in. Two with no email — stopped. One double submit — stopped. One spam — stopped. Two unqualified — logged to nurture. Four alerts in sales. Every stop accounted for.',
  outro: 'You didn’t watch an automation — you made the decisions. The front door, the cleanup, the guard, the business rule, the alert that explains itself, and the debugging that proved green is not proof. This pipeline is artifact number one in your portfolio.',
}

/* ---------------- the stage ---------------- */

export default function BigBuildStage({ onDone, signalsKey }) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [held, setHeld] = useState(false) // true while narration is held by Pause
  const [narrate, setNarrate] = useState(true)
  const [ch, setCh] = useState({}) // per-chapter interaction state
  const [investigated, setInvestigated] = useState(null)
  const [fixed, setFixed] = useState(false)
  const timer = useRef(null)
  const bump = useSignals((s) => s.bump)
  const advanceRef = useRef(() => {})
  const uttRef = useRef(null)   // the utterance currently being voiced
  const pausedRef = useRef(false) // true while narration is held by Pause
  const chRef = useRef(i)
  chRef.current = i

  const chp = CHAPTERS[i]
  const total = CHAPTERS.length
  /* the voice script for the chapter on screen, sentence by sentence */
  const sentences = useMemo(() => splitSentences(VOICE[CHAPTERS[i].id] || ''), [i])
  const [snd, setSnd] = useState(0)
  advanceRef.current = () => { play('click'); setI((x) => Math.min(total - 1, x + 1)) }

  /* ---- narration engine — the voice script plays sentence by sentence.
     ▶ Play starts/resumes the chain. ⏸ Pause stops it at once. ▶ continues
     from the next sentence. Muted mode delivers on a timer instead. ---- */
  const speechOK = () => typeof window !== 'undefined' && 'speechSynthesis' in window
  const chainRef = useRef({ cancelled: false }) // the live sentence chain
  const sndIdx = useRef(0)                      // next sentence to speak
  const playingRef = useRef(false)
  const narrateRef = useRef(true)
  playingRef.current = playing
  narrateRef.current = narrate

  const stopSpeak = () => {
    chainRef.current.cancelled = true
    setSpeaking(false)
    try { window.speechSynthesis?.cancel() } catch { /* narration must never break the page */ }
  }

  const speakFrom = (idx) => {
    if (chainRef.current.cancelled) return
    const list = sentences
    if (!speechOK() || narrateRef.current === false) {
      // muted: same pacing on a timer, no voice
      if (playingRef.current && idx < list.length) {
        setTimeout(() => { if (!chainRef.current.cancelled) speakFrom(idx + 1) }, 4200)
      } else if (playingRef.current) {
        setTimeout(() => { if (!chainRef.current.cancelled) advanceRef.current() }, 500)
      } else {
        sndIdx.current = 0
        setSnd(0)
      }
      return
    }
    if (idx >= list.length) {
      sndIdx.current = 0
      setSnd(0)
      if (playingRef.current) {
        const nxt = CHAPTERS[i + 1]
        const nst = nxt ? (ch[nxt.id] || {}) : {}
        if (nxt && nxt.quiz && !nst.answered) { setPlaying(false); return } // play pauses at the check
        setTimeout(() => { if (!chainRef.current.cancelled) advanceRef.current() }, 350)
      }
      return
    }
    try {
      const synth = window.speechSynthesis
      const vs = synth.getVoices()
      const v = vs.find((x) => /^en[-_]/i.test(x.lang) && /natural|google|online/i.test(x.name))
        || vs.find((x) => /^en[-_]/i.test(x.lang))
        || vs[0]
      const u = new SpeechSynthesisUtterance(list[idx])
      if (v) u.voice = v
      u.rate = 1.02
      u.onend = () => {
        if (chainRef.current.cancelled) return
        sndIdx.current = idx + 1
        setSnd(idx + 1)
        speakFrom(idx + 1)
      }
      u.onerror = () => { if (!chainRef.current.cancelled) speakFrom(idx + 1) }
      // watchdog: if the engine silently stalls (no voices installed), keep the chain moving
      setTimeout(() => {
        if (chainRef.current.cancelled) return
        if (sndIdx.current <= idx) {
          sndIdx.current = idx + 1
          setSnd(idx + 1)
          speakFrom(idx + 1)
        }
      }, Math.max(2600, (list[idx] || '').split(/\s+/).length * 640))
      synth.speak(u)
    } catch { /* narration must never break the page */ }
  }
  useEffect(() => () => { chainRef.current.cancelled = true; try { window.speechSynthesis?.cancel() } catch { /* fine */ } }, [])
  /* a new chapter: the voice starts from its first sentence (Play/step mode) */
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return } // never speak on page load — wait for Play
    sndIdx.current = 0
    setSnd(0)
    setHeld(false)
    chainRef.current.cancelled = true
    stopSpeak()
    if (playing || narrate) {
      chainRef.current.cancelled = false
      speakFrom(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])
  /* ▶ Play — start or resume the voice chain from where it stopped */
  const onPlayBtn = () => {
    chainRef.current.cancelled = false
    setHeld(false)
    setPlaying(true)
    play('click')
    speakFrom(sndIdx.current)
  }
  /* ⏸ Pause — stop the voice at once; ▶ Play resumes from the next sentence */
  const onPauseBtn = () => {
    chainRef.current.cancelled = true
    try { window.speechSynthesis?.cancel() } catch { /* fine */ }
    setSpeaking(false)
    setPlaying(false)
    setHeld(sndIdx.current > 0)
    play('click')
  }
  const answer = (ci, oi) => {
    const c = CHAPTERS[ci]
    play(oi === c.quiz.correct ? 'correct' : 'wrong')
    setCh((s) => ({ ...s, [c.id]: { ...(s[c.id] || {}), answered: oi === c.quiz.correct, picked: oi } }))
    if (oi === c.quiz.correct) bump(signalsKey, 'guidedSteps', 1)
  }
  const fixIt = () => { setFixed(true); setCh((s) => ({ ...s, mistake: { ...(s.mistake || {}), fixed: true } })); play('correct') }

  /* node-row JSON printer */
  const Json = ({ o, tone }) => (
    <div className={`bb-json ${tone || ''}`}>
      {Object.entries(o).map(([k, v]) => (
        <div key={k} className="bb-kv"><span>{k}</span><b>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</b></div>
      ))}
    </div>
  )

  /* the mini canvas — every chapter renders it with a mode */
  const lit = {
    hook: NODES.map((n) => n.id),
    map: [],
    trigger: ['trigger'],
    set: ['trigger', 'set'],
    filter: ['trigger', 'set', 'filter'],
    ifs: ['trigger', 'set', 'filter', 'ifs'],
    slack: ['trigger', 'set', 'filter', 'ifs', 'slack', 'log'],
    mistake: ['trigger', 'set', 'filter', 'ifs', 'slack'],
    finaltest: NODES.map((n) => n.id),
    outro: NODES.map((n) => n.id),
  }[chp.id] || []

  return (
    <div className="bb">
      {/* ---------- chapter canvas ---------- */}
      <div className="cfx-card bb-stage">
        {chp.id === 'problem' && (
          <div className="bb-inbox">
            <div className="kicker mb8"><Inbox size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Google Sheet · “Website form (live)” · 10 new responses</div>
            {LEADS.map((r, ri) => (
              <button key={ri} className={`bb-row ${ch.row === ri ? 'open' : ''}`} onClick={() => { setCh((s) => ({ ...s, row: ri })); play('click') }}>
                <span className="bb-cell w-name">{r.name.trim() || '—'}</span>
                <span className="bb-cell">{r.email.trim() || '—'}</span>
                <span className="bb-cell">{r.company || '—'}</span>
                <span className="bb-cell w-b">{r.budget || '—'}</span>
                <span className="bb-cell w-m">{r.msg.slice(0, 34)}{r.msg.length > 34 ? '…' : ''}</span>
              </button>
            ))}
            <AnimatePresence>
              {ch.row != null && INBOX_NOTES[ch.row] && (
                <motion.div className="bb-note" {...popIn}>{INBOX_NOTES[ch.row]}</motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {chp.id === 'setup' && (
          <div className="bb-setup">
            {chp.steps.map(([t, d], x) => (
              <div key={x} className="bb-step">
                <span className="bb-stepn">{x + 1}</span>
                <div><b>{t}</b><p className={d.startsWith('docker') ? 'mono' : ''}>{d}</p></div>
              </div>
            ))}
            <div className="bb-note">Real-world reference: the n8n template library ships this exact system — “Qualify Google Sheets leads with OpenAI and send alerts to Slack”. You’re building its spine here; the AI scorer arrives in Module 4.</div>
          </div>
        )}

        {(chp.id !== 'problem' && chp.id !== 'setup') && (
          <div className={`cfx-canvas ms-canvas ${chp.id === 'mistake' && !fixed ? 'ms-shake' : ''}`}>
            <svg className="cfx-wires" width="960" height="320" viewBox="0 0 960 320">
              {WIRES.map((w) => <path key={w.id} id={'bb-' + w.id} d={w.d} className={scheduleLive(chp.id) ? 'live' : ''} />)}
            </svg>
            {NODES.map((n) => {
              const isLit = lit.includes(n.id)
              const isTarget = chp.node === n.id || (chp.id === 'mistake' && investigated === null)
              return (
                <div
                  key={n.id}
                  id={'bb-n-' + n.id}
                  className={`cfx-node ms-node ${isLit ? 'lit' : ''} ${isTarget && chp.id !== 'hook' && chp.id !== 'map' && chp.id !== 'outro' ? 'click' : ''} ${investigated === n.id && chp.id === 'mistake' ? 'selected' : ''}`}
                  style={{ left: n.x, top: n.y }}
                  onClick={() => chp.id === 'mistake' && setInvestigated(n.id)}
                  role="button"
                  aria-label={n.label}
                >
                  <div className="top"><span className="ic" style={{ background: n.brand }}>{n.icon}</span><div><b>{n.label}</b><small>{n.sub}</small></div></div>
                </div>
              )
            })}
            {chp.id === 'mistake' && investigated === 'slack' && !fixed && (
              <motion.div className="cfx-bubble bad on" style={{ left: 640, top: 26 }}>Slack · 401 — invalid_token</motion.div>
            )}
            {chp.id === 'hook' && (
              <motion.div className="bb-slack" {...popIn}>
                <div className="bb-slack-head">#sales</div>
                🔥 New lead: Priya Nair — Xero Coffee<br />
                Budget: $2500 · Why: budget ≥ $1k + real message<br />
                <span className="bb-slack-msg">“Need ~200 bags/month for our offices…”</span>
              </motion.div>
            )}
            {chp.id === 'hook' && (
              <div className="bb-hookstats">
                <div><b>200+</b><span>leads / week</span></div>
                <div><b>&lt; 60s</b><span>to #sales</span></div>
                <div><b>0</b><span>lost quietly</span></div>
              </div>
            )}
            {chp.id === 'mistake' && investigated === 'slack' && !fixed && (
              <motion.div className="bb-resp" {...popIn}>
                <div className="kicker mb8">Slack · last response</div>
                <div className="bb-json bad">{'{ "error": "invalid_token", "msg": "Token expired 21 days ago" }'}</div>
                <Btn size="sm" variant="primary" onClick={() => { fixIt(); play('ship') }}><Wrench size={13} /> Refresh the credential & re-run</Btn>
              </motion.div>
            )}
            {chp.id === 'mistake' && fixed && (
              <motion.div className="bb-slack on" {...popIn}>
                <div className="bb-slack-head">#sales</div>
                🔥 4 new qualified leads just posted — the channel is alive again.
              </motion.div>
            )}
            {chp.id === 'finaltest' && <FinalCounts />}
          </div>
        )}
      </div>

      {/* ---------- explanation card ---------- */}
      <div className="cfx-card cfx-instr">
        <div className="row between wrap mb8">
          <span className="cfx-chip">{chp.kicker}</span>
          {chp.node && <span className="bb-nodename">{NODES.find((n) => n.id === chp.node)?.label}</span>}
        </div>
        <b className="bb-title">{chp.title}</b>
        {chp.text && <p className="bb-text">{chp.text}</p>}

        {chp.why && (
          <div className="bb-why">
            <p><b>Why this node: </b>{chp.why}</p>
            <p className="bb-breaks"><TriangleAlert size={13} style={{ verticalAlign: -2, marginRight: 5 }} /><b>If you skip it: </b>{chp.breaks}</p>
          </div>
        )}

        {chp.cfg && (
          <div className="bb-cfg">
            <div className="kicker mb8">The configuration — exactly as it goes in</div>
            {chp.cfg.map(([k, v], x) => (
              <div key={x} className="bb-cfgrow">{k && <span>{k}</span>}<code className={v.startsWith('{{') ? 'ex' : ''}>{v}</code></div>
            ))}
          </div>
        )}

        {chp.after && (
          <div className="bb-data">
            <div className="kicker mb8">The data through this node</div>
            <div className="bb-cols2">
              {chp.before && (
                <div>
                  <span className="bb-colhead bad">in{Array.isArray(chp.before) ? ` — ${chp.before.length} item${chp.before.length > 1 ? 's' : ''}` : ''}</span>
                  {Array.isArray(chp.before) ? chp.before.map((r, x) => <Json key={x} o={r} />) : <Json o={chp.before} />}
                </div>
              )}
              <div>
                <span className="bb-colhead ok">out{Array.isArray(chp.after) ? ` — ${chp.after.length} item${chp.after.length > 1 ? 's' : ''}` : ''}</span>
                {Array.isArray(chp.after) ? chp.after.map((r, x) => <Json key={x} o={r} />) : <Json o={chp.after} />}
              </div>
            </div>
            {chp.dataNote && <p className="bb-datanote">{chp.dataNote}</p>}
          </div>
        )}

        {chp.quiz && (
          <div className="cfx-opts">
            <p className="bb-quizq"><Sparkles size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{chp.quiz.q}</p>
            {chp.quiz.opts.map((t, oi) => {
              const st = ch[chp.id] || {}
              return (
                <button
                  key={oi}
                  className={`cfx-opt ${st.answered && oi === chp.quiz.correct ? 'right' : ''} ${st.picked === oi && !st.answered ? 'wrong' : ''}`}
                  onClick={() => answer(i, oi)}
                >{t}</button>
              )
            })}
            {ch[chp.id]?.picked != null && !ch[chp.id]?.answered && <p className="ms-panel-bad">Hint: {chp.quiz.hint}</p>}
          </div>
        )}

        {/* ---------- video bar ---------- */}
        <div className="bb-bar">
          <button className="narr-btn" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous chapter"><ChevronLeft size={15} /></button>
          <button
            className="narr-btn narr-play"
            onClick={onPlayBtn}
            aria-label={held ? 'Resume the narration' : 'Play the build'}
          >
            <Play size={14} />{held ? ' Resume' : !playing ? ' Play' : ''}
          </button>
          <button className="narr-btn" onClick={() => go(i + 1)} disabled={i === total - 1} aria-label="Next chapter"><ChevronRight size={15} /></button>
          <button className="narr-btn" onClick={onPauseBtn} aria-label="Pause the narration"><Pause size={14} /> Pause</button>
          <button
            className={`narr-btn ${narrate ? 'narr-on' : ''}`}
            onClick={() => {
              if (narrate) {
                stopSpeak()
                // kill any queued utterance that fires after the state flips
                setTimeout(stopSpeak, 220)
                setNarrate(false)
              } else {
                setNarrate(true)
                speak(VOICE[CHAPTERS[chRef.current].id])
              }
            }}
            aria-label={narrate ? 'Narration on — click to stop' : 'Narration off — click to start'}
            aria-pressed={narrate}
            title="Voice narration"
          >
            {narrate ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <div className="bb-track">
            {CHAPTERS.map((c, x) => (
              <button key={c.id} type="button" className={`bb-seg ${x === i ? 'on' : ''}`} style={{ flexGrow: c.id === 'mistake' || c.id.startsWith('build') ? 1.4 : 1 }} title={c.title} onClick={() => go(x)}>
                <span style={{ width: `${x < i ? 100 : 0}%` }} />
                {c.quiz && <i className={`vl-mark ${ch[c.id]?.answered ? 'ok' : ''}`} title="Check inside" />}
              </button>
            ))}
          </div>
          <span className="chip">{i + 1} / {total}</span>
        </div>
      </div>

      {/* ---------- outro ---------- */}
      {i === total - 1 && (
        <motion.div className="row between wrap mt14" {...popIn}>
          <span className="tag-mono">same machine, new data — every module grows this system</span>
          <Btn variant="primary" onClick={onDone}>Now run OUR pipeline → <ArrowRight size={14} /></Btn>
        </motion.div>
      )}
    </div>
  )
}

function scheduleLive(id) { return ['hook', 'finaltest', 'outro'].includes(id) }

/* final-test counts */
function FinalCounts() {
  const rows = [
    { n: 10, label: 'rows in', tone: '' },
    { n: 2, label: 'no email — stopped', tone: 'bad' },
    { n: 1, label: 'double-submit — stopped', tone: 'bad' },
    { n: 1, label: 'spam — stopped', tone: 'bad' },
    { n: 2, label: 'unqualified → Nurture', tone: '' },
    { n: 4, label: 'alerts in #sales ✓', tone: 'ok' },
  ]
  return (
    <div className="bb-counts">
      {rows.map((r, i) => (
        <motion.div key={i} className={`bb-count ${r.tone}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 * i }}>
          <b>{r.n}</b><span>{r.label}</span>
        </motion.div>
      ))}
    </div>
  )
}
