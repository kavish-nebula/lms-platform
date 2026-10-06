import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Send } from 'lucide-react'
import { usePatch } from '../stores/patch.js'
import { useSignals } from '../stores/signals.js'
import { answerQuestion, SUGGESTIONS } from './knowledgeBase.js'
import TypingDots from '../ui/TypingDots.jsx'
import { play } from '../sound.js'
import { popIn } from '../motion.js'

/*
  Patch — Nebula's on-call ops bot, and the course's Q&A.
  Scope-guarded: answers only course-context questions (see knowledgeBase.js).
  Adaptive depth: if the learner's signals show confusion, answers lead with the analogy.
  A stage can hand it help for the step on screen (guided practice does): those
  questions are offered first and answered from the step itself.
*/
export default function PatchDock() {
  const { current, queue, next, dismiss, help } = usePatch()
  const open = usePatch((s) => s.chatOpen)
  const setOpen = usePatch((s) => s.setChat)
  const [messages, setMessages] = useState([]) // {who:'you'|'patch', text}
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const thinkingTimer = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => () => clearTimeout(thinkingTimer.current), [])

  useEffect(() => {
    if (!current && queue.length) next()
  }, [current, queue, next])

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => { dismiss(); }, 11000)
    return () => clearTimeout(t)
  }, [current, dismiss])

  const confused = () => {
    const sigs = useSignals.getState().byStep
    return Object.values(sigs).some((s) => (s?.checkFails || 0) >= 2 || (s?.replays || 0) >= 2)
  }

  const contextLine = () => {
    const m = window.location.pathname.match(/player\/(\d+)/)
    return m ? `Module ${m[1]}` : ''
  }

  const ask = (text) => {
    const question = (text ?? input).trim()
    if (!question) return
    // a question about the step on screen is answered from that step; anything else from the course notes
    const known = help?.prompts.find((p) => p.q === question)
    let reply = known ? { text: known.a } : answerQuestion(question, { confused: confused(), context: help?.title || contextLine() })
    if (!known && !reply.inScope && help) reply = { text: help.fallback }
    setMessages((m) => [...m, { who: 'you', text: question }])
    setInput('')
    setOpen(true)
    play('pop')
    // Patch "types" before answering — a short beat makes the reply feel composed, not canned
    setThinking(true)
    setTimeout(() => inputRef.current?.focus(), 50)
    clearTimeout(thinkingTimer.current)
    thinkingTimer.current = setTimeout(() => {
      setThinking(false)
      setMessages((m) => [...m, { who: 'patch', text: reply.text }])
      play('click')
    }, Math.min(1500, 450 + reply.text.length * 5))
  }

  return (
    <div className="patch-dock">
      <AnimatePresence>
        {current && !open && (
          <motion.div className="patch-card" {...popIn}>
            <div className="row mb8" style={{ gap: 8 }}>
              <Bot size={15} color="var(--accent-ink)" />
              <b style={{ fontSize: 15 }}>Patch</b>
              <span className="tag-mono">Nebula ops bot</span>
              <span style={{ flex: 1 }} />
              <button className="btn sm ghost" onClick={() => dismiss()}>×</button>
            </div>
            <p className="small" style={{ lineHeight: 1.6 }}>{current.text}</p>
          </motion.div>
        )}
        {open && (
          <motion.div className="patch-card patch-chat" {...popIn}>
            <div className="row mb8" style={{ gap: 8 }}>
              <Bot size={15} color="var(--accent-ink)" />
              <b style={{ fontSize: 15 }}>Patch</b>
              <span className="tag-mono">{help ? help.title : 'Nebula ops bot · course Q&A'}</span>
              <span style={{ flex: 1 }} />
              <button className="btn sm ghost" onClick={() => setOpen(false)}>×</button>
            </div>

            <div className="patch-msgs">
              {messages.length === 0 && (
                <p className="muted small" style={{ lineHeight: 1.6 }}>
                  {help
                    ? 'Stuck on this step? Pick a question below or type your own — I’ll answer for the step you’re on.'
                    : 'Ask me anything about this course — nodes, items, expressions, why things broke. I only know Nebula’s world, so keep it in scope.'}
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.who}`}>
                  <span className="chat-who">{m.who === 'you' ? 'you' : 'patch'}</span>
                  <span className="chat-text">{m.text}</span>
                </div>
              ))}
              {thinking && (
                <div className="chat-msg patch">
                  <span className="chat-who">patch</span>
                  <TypingDots />
                </div>
              )}
            </div>

            <div className="row wrap" style={{ gap: 5, margin: '10px 0' }}>
              {(help ? help.prompts.map((p) => p.q) : SUGGESTIONS).map((s) => (
                <button key={s} className="chip" style={{ cursor: 'pointer', fontSize: 12.5 }} onClick={() => ask(s)}>{s}</button>
              ))}
            </div>

            <div className="row" style={{ gap: 6 }}>
              <input
                ref={inputRef}
                className="input"
                style={{ padding: '8px 11px', fontSize: 15 }}
                value={input}
                placeholder="Ask about this module…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
              />
              <button className="btn sm primary" onClick={() => ask()}><Send size={13} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="patch-av"
        style={{ position: 'relative' }}
        onClick={() => { setOpen(!open); if (current) dismiss() }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Bot size={22} color="var(--accent-ink)" />
        {(current || queue.length > 0) && <span className="patch-dot" />}
      </motion.div>
    </div>
  )
}
