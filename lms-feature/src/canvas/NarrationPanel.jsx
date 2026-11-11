import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Headphones, Pause } from 'lucide-react'
import NarrationBar from './NarrationBar.jsx'
import { useAudioBeat } from './useAudioBeat.js'
import { splitSentences } from './useNarration.js'

const DEFAULT_NARRATION = { rate: 1, muted: false }

/* Rough speaking time, used only when a clip's file is missing. */
const speakMs = (text = '') => Math.max(3000, text.split(/\s+/).length * 380)

/*
  One narration clip for a stage: wires the learner's narration settings
  (speed, or muted when they chose to read) into useAudioBeat.
*/
export function useStageAudio({ src, text, tl, autoStart = false, narration = DEFAULT_NARRATION }) {
  const audio = useAudioBeat({ src, tl, autoStart, rate: narration.rate, muted: narration.muted, fallbackMs: tl ? 0 : speakMs(text) })
  return { ...audio, canSkip: !!narration.canSkip }
}

/*
  Player bar + what is being said. With narration on, the subtitle follows the
  voice sentence by sentence; when the learner reads instead, the whole script is shown.
*/
export default function NarrationPanel({ audio, text, subtitle = true, onRestart }) {
  const sentences = useMemo(() => splitSentences(text || ''), [text])
  // sentences get screen time in proportion to their length, not an equal share
  const ends = useMemo(() => {
    const total = sentences.reduce((n, s) => n + s.length, 0) || 1
    let acc = 0
    return sentences.map((s) => (acc += s.length) / total)
  }, [sentences])
  const idx = Math.max(0, ends.findIndex((e) => audio.progress < e))
  const shown = audio.ended ? sentences.length - 1 : idx
  const readAll = audio.muted || !audio.exists

  return (
    <div>
      <NarrationBar ctrl={audio} segCount={sentences.length} onRestart={onRestart} />
      {subtitle && sentences.length > 0 && (
        readAll ? (
          <div className="narr-subtitle">
            {sentences.map((s, i) => <span key={i} className={i === shown ? 'narr-now' : ''}>{s} </span>)}
          </div>
        ) : (
          <motion.div className="narr-subtitle" key={shown} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} aria-live="polite">
            {sentences[shown]}
          </motion.div>
        )
      )}
    </div>
  )
}

/* Compact play/pause for a short clip with no canvas (a question read aloud). */
export function ListenButton({ src, text, narration = DEFAULT_NARRATION, label = 'Listen' }) {
  const audio = useStageAudio({ src, text, narration, autoStart: !narration.muted })
  if (!audio.exists) return null
  return (
    <button
      type="button"
      className={`narr-btn ${audio.playing ? 'narr-play' : ''}`}
      onClick={() => {
        if (audio.playing) return audio.pause()
        if (audio.muted) audio.toggleMute() // asking to listen overrides "I'll read" for this clip
        audio.restart()
      }}
    >
      {audio.playing ? <><Pause size={13} /> Pause</> : <><Headphones size={13} /> {label}</>}
    </button>
  )
}
