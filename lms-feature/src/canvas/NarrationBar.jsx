import { Play, Pause, RotateCcw, Volume2, VolumeX, Rewind, FastForward, SkipForward } from 'lucide-react'

/*
  Audio-player bar for a narration clip (real mp3 playback).
  `ctrl` = what useAudioBeat returns. When the clip's file is missing the bar
  still drives the animation and says so, instead of pretending there is sound.
*/
export default function NarrationBar({ ctrl, segCount = 0, onRestart }) {
  if (!ctrl) return null
  const segs = Math.max(segCount, 1)
  const doneSegs = Math.round(ctrl.progress * segs)
  const untouched = !ctrl.playing && !ctrl.ended && ctrl.progress === 0 // nothing plays until the learner presses play

  return (
    <div className="narr-bar" role="group" aria-label="Narration controls">
      <button type="button" className="narr-btn" onClick={ctrl.back} aria-label="Back 10 seconds"><Rewind size={14} /> 10s</button>
      <button type="button" className="narr-btn narr-play" onClick={ctrl.toggle} aria-label={ctrl.playing ? 'Pause narration' : 'Play narration'}>
        {ctrl.playing ? <Pause size={15} /> : <Play size={15} />}{untouched && ' Play narration'}
      </button>
      <button type="button" className="narr-btn" onClick={ctrl.fwd} aria-label="Forward 10 seconds"><FastForward size={14} /> 10s</button>
      <button type="button" className="narr-btn" onClick={() => { ctrl.restart(); onRestart && onRestart() }} aria-label="Restart from the beginning"><RotateCcw size={13} /></button>

      <div className="narr-track" aria-hidden="true">
        {Array.from({ length: segs }, (_, i) => (
          <div key={i} className={`narr-seg ${i < doneSegs ? 'done' : ''}`} />
        ))}
      </div>

      {ctrl.rate !== 1 && <span className="narr-time">{ctrl.rate}×</span>}
      {ctrl.canSkip && !ctrl.ended && (
        <button type="button" className="narr-btn" onClick={ctrl.skipToEnd} aria-label="Skip narration"><SkipForward size={14} /> Skip</button>
      )}
      {ctrl.exists ? (
        <button type="button" className="narr-btn" onClick={ctrl.toggleMute} aria-label={ctrl.muted ? 'Unmute narration' : 'Mute narration'} aria-pressed={ctrl.muted}>
          {ctrl.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      ) : (
        <span className="chip warn" title="This clip has no audio file yet — the captions carry it">no audio · captions only</span>
      )}
    </div>
  )
}
