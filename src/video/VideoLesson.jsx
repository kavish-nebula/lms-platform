import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX, CheckCircle2, ArrowRight, Rewind,
} from 'lucide-react'
import Slide from './Slide.jsx'
import { Btn } from '../ui/bits.jsx'
import { splitSentences } from '../canvas/useNarration.js'
import { AUDIO } from '../content/audio.js'
import { popIn } from '../motion.js'

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const estimate = (text) => Math.max(4, text.split(/\s+/).length * 0.4) // seconds, until the clip's real length is known

/*
  A concept video made of narrated slides. It plays like a video — one play
  button, slides advance by themselves, and everything on a slide appears in time
  with the voice — but it is live in the page, so it can pause for a short check
  half way and at the end. The check is a small popup over the slide: a wrong
  answer gets a hint, and the learner decides whether to try again or carry on.
  Nothing plays until the learner presses play.
*/
export default function VideoLesson({ video, onDone, doneLabel = 'Continue' }) {
  const slides = video.slides
  const last = slides.length - 1
  const srcs = useMemo(() => slides.map((_, i) => AUDIO.slide(video, i)), [video])

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [frac, setFrac] = useState(0) // how far through the current slide's narration
  const [seen, setSeen] = useState(() => new Set()) // slides heard to the end
  const [phase, setPhase] = useState('play') // play | mid | end | done
  const [midPassed, setMidPassed] = useState(!video.midQuiz?.length)
  const [endPassed, setEndPassed] = useState(!video.endQuiz?.length)
  const [muted, setMuted] = useState(false)
  const [lengths, setLengths] = useState(() => slides.map((s) => estimate(s.narration)))
  const audioRef = useRef(null)
  const silent = useRef({}) // slides whose clip is missing run on a timer instead
  const live = useRef({}) // latest state, for the audio callbacks
  live.current = { idx, playing, midPassed, endPassed }

  // every clip's real length, for the clock
  useEffect(() => {
    const probes = srcs.map((src, i) => {
      const a = new Audio()
      a.preload = 'metadata'
      a.onloadedmetadata = () => setLengths((l) => l.map((v, k) => (k === i && a.duration ? a.duration : v)))
      a.src = src
      return a
    })
    return () => probes.forEach((a) => { a.onloadedmetadata = null; a.src = '' })
  }, [srcs])

  const slideEnded = () => {
    const { idx: i, midPassed: mid, endPassed: end } = live.current
    setSeen((s) => new Set(s).add(i))
    setFrac(1)
    if (i === video.quizAfter && !mid) { setPlaying(false); return setPhase('mid') }
    if (i === last) { setPlaying(false); return setPhase(end ? 'done' : 'end') }
    setIdx(i + 1)
  }
  const endedRef = useRef(slideEnded)
  endedRef.current = slideEnded

  // one audio element for the whole lesson
  useEffect(() => {
    const a = new Audio()
    a.preload = 'auto'
    audioRef.current = a
    const onEnd = () => endedRef.current()
    const onErr = () => { silent.current[live.current.idx] = true }
    a.addEventListener('ended', onEnd)
    a.addEventListener('error', onErr)
    return () => { a.removeEventListener('ended', onEnd); a.removeEventListener('error', onErr); a.pause(); a.src = '' }
  }, [])

  // a new slide: load its clip, and keep playing if the lesson was playing
  useEffect(() => {
    const a = audioRef.current
    a.src = srcs[idx]
    a.muted = muted
    setFrac(0)
    if (live.current.playing) a.play().catch(() => { if (!silent.current[idx]) setPlaying(false) })
  }, [idx, srcs])

  // while playing, the voice is the clock (or a timer, when a clip is missing)
  useEffect(() => {
    if (!playing || phase !== 'play') return
    let raf = 0
    let prev = 0
    let elapsed = frac * lengths[idx]
    const tick = (ts) => {
      const a = audioRef.current
      if (silent.current[idx]) {
        elapsed += prev ? (ts - prev) / 1000 : 0
        prev = ts
        if (elapsed >= lengths[idx]) return endedRef.current()
        setFrac(elapsed / lengths[idx])
      } else if (a.duration) setFrac(Math.min(1, a.currentTime / a.duration))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, phase, idx])

  const play = () => {
    setPlaying(true)
    if (!silent.current[idx]) audioRef.current.play().catch(() => { if (!silent.current[idx]) setPlaying(false) })
  }
  const pause = () => { audioRef.current.pause(); setPlaying(false) }
  // show slide `to` from its start; `andPlay` also starts it
  const jump = (to, andPlay = false) => {
    if (to === idx) { audioRef.current.currentTime = 0; setFrac(0); if (andPlay) play() } else { if (andPlay) setPlaying(true); setIdx(to) }
  }
  const goTo = (i) => {
    const to = Math.max(0, Math.min(last, i))
    // moving past the half-way point brings up its check first
    if (to > video.quizAfter && !midPassed && phase === 'play') { pause(); return setPhase('mid') }
    setPhase('play')
    jump(to)
  }
  const next = () => {
    if (idx === last) { pause(); return setPhase(endPassed ? 'done' : 'end') }
    setSeen((s) => new Set(s).add(idx))
    goTo(idx + 1)
  }
  const restart = () => { setSeen(new Set()); setPhase('play'); jump(0, true) }
  const toggleMute = () => setMuted((m) => { audioRef.current.muted = !m; return !m })

  const slide = slides[idx]
  const sentences = useMemo(() => splitSentences(slide.narration), [slide])
  // the point in the narration (0–1) at which each sentence begins
  const starts = useMemo(() => {
    const total = sentences.reduce((n, s) => n + s.length, 0) || 1
    let acc = 0
    return sentences.map((s) => { const at = acc / total; acc += s.length; return at })
  }, [sentences])
  const all = seen.has(idx) // a slide already heard through is shown complete
  const shown = (cue = 0) => all || frac >= (starts[Math.min(cue, starts.length - 1)] ?? 0) - 0.005 && (cue === 0 || frac > 0)
  const sentenceNow = Math.max(0, starts.findLastIndex((at) => frac >= at))

  const total = lengths.reduce((a, b) => a + b, 0)
  const elapsed = lengths.slice(0, idx).reduce((a, b) => a + b, 0) + frac * lengths[idx]
  const untouched = !playing && idx === 0 && frac === 0 && seen.size === 0

  return (
    <div className="vl">
      <div className="vl-stage">
        {phase !== 'done' && <Slide key={idx} slide={slide} shown={shown} />}
        {phase === 'mid' && (
          <Check
            key="mid" kicker="Quick check" questions={video.midQuiz} doneLabel="Continue the video"
            onDone={() => { setMidPassed(true); setPhase('play'); setPlaying(true); setIdx(video.quizAfter + 1) }}
          />
        )}
        {phase === 'end' && (
          <Check key="end" kicker="Quick check" questions={video.endQuiz} doneLabel="Finish" onDone={() => { setEndPassed(true); setPhase('done') }} />
        )}
        {phase === 'done' && (
          <motion.div className="vl-check" {...popIn}>
            <CheckCircle2 size={34} color="var(--ok)" />
            <h3 className="vl-h">Video complete</h3>
            <p className="vl-p">{video.title} — watched to the end.</p>
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              <Btn onClick={restart}><RotateCcw size={14} /> Watch again</Btn>
              <Btn variant="primary" onClick={onDone}>{doneLabel} <ArrowRight size={14} /></Btn>
            </div>
          </motion.div>
        )}
        {untouched && phase === 'play' && (
          <button type="button" className="vl-bigplay" onClick={play} aria-label="Play the video"><Play size={30} /></button>
        )}
      </div>

      {phase === 'play' && (
        <p className="vl-caption" aria-live="off">{untouched ? 'Press play to start — the slides follow the narration.' : sentences[all && !playing ? sentences.length - 1 : sentenceNow]}</p>
      )}

      <div className="vl-bar" role="group" aria-label="Video controls">
        <button type="button" className="narr-btn" onClick={() => goTo(idx - 1)} disabled={idx === 0 || phase !== 'play'} aria-label="Previous slide"><SkipBack size={14} /></button>
        <button type="button" className="narr-btn narr-play" onClick={playing ? pause : play} disabled={phase !== 'play'} aria-label={playing ? 'Pause the video' : 'Play the video'}>
          {playing ? <Pause size={15} /> : <Play size={15} />}{untouched && ' Play'}
        </button>
        <button type="button" className="narr-btn" onClick={next} disabled={phase !== 'play'} aria-label="Next slide"><SkipForward size={14} /></button>
        <button type="button" className="narr-btn" onClick={() => goTo(idx)} disabled={phase !== 'play'} aria-label="Replay this slide"><Rewind size={14} /></button>

        <div className="vl-track">
          {slides.map((s, i) => (
            <button
              key={i} type="button" className={`vl-seg ${i === idx ? 'on' : ''}`} style={{ flexGrow: lengths[i] }}
              title={`Slide ${i + 1}: ${s.title}`} aria-label={`Go to slide ${i + 1}: ${s.title}`} onClick={() => goTo(i)}
            >
              <span style={{ width: `${(i < idx || seen.has(i) ? 1 : i === idx ? frac : 0) * 100}%` }} />
              {i === video.quizAfter && <i className={`vl-mark ${midPassed ? 'ok' : ''}`} title="Quick check" />}
            </button>
          ))}
        </div>

        <span className="narr-time vl-time">{fmt(elapsed)} / {fmt(total)}</span>
        <span className="chip">{idx + 1} / {slides.length}</span>
        <button type="button" className="narr-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
      </div>
    </div>
  )
}

/*
  A short check inside the video — a small popup over the slide. A right answer
  moves on. A wrong one gets a hint, not the answer; the learner decides whether
  to try again or carry on (they can also go back to any slide from the bar).
*/
function Check({ kicker, questions, onDone, doneLabel }) {
  const [qi, setQi] = useState(0)
  const [choice, setChoice] = useState(null)
  const q = questions[qi]
  const right = choice === q.correct
  const lastQ = qi === questions.length - 1
  const move = () => (lastQ ? onDone() : (setQi(qi + 1), setChoice(null)))

  return (
    <div className="vl-pop-wrap">
      <motion.div className="vl-pop" role="dialog" aria-label={kicker} {...popIn} key={qi}>
        <div className="row between">
          <div className="kicker">{kicker} · {qi + 1} of {questions.length}</div>
          <button type="button" className="link-btn" onClick={move}>Skip</button>
        </div>
        <p className="vl-pop-q">{q.q}</p>
        {q.options.map((o, i) => (
          <button key={i} type="button" disabled={right} className={`opt ${choice === i ? (right ? 'right' : 'wrong') : ''}`} onClick={() => setChoice(i)}>{o}</button>
        ))}
        <div aria-live="polite">
          {choice !== null && right && <p className="small mt8"><b style={{ color: 'var(--ok-ink)' }}>Right. </b>{q.explain}</p>}
          {choice !== null && !right && <p className="small mt8"><b style={{ color: 'var(--warn-ink)' }}>Hint: </b>{q.hint}</p>}
        </div>
        {choice !== null && (
          <div className="row between mt14">
            <span className="tag-mono">{right ? '' : 'pick another answer, or carry on'}</span>
            <Btn variant={right ? 'primary' : ''} size="sm" onClick={move}>{lastQ ? doneLabel : 'Next question'} <ArrowRight size={13} /></Btn>
          </div>
        )}
      </motion.div>
    </div>
  )
}
