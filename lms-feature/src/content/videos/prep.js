import { splitSentences } from '../../canvas/useNarration.js'

/*
  A video is written with its narration as `lines` — one sentence per line — so a
  `cue` on a slide element is simply the line it appears on. This turns the lines
  into the narration text the player and the audio generator use.
*/
export function video(v) {
  return { ...v, slides: v.slides.map((s) => (s.lines ? { ...s, narration: s.lines.join(' ') } : s)) }
}

/* Authoring check: every line is exactly one sentence, and every cue points at a line that exists. */
export function problems(v) {
  const out = []
  v.slides.forEach((s, i) => {
    const n = splitSentences(s.narration).length
    if (s.lines && n !== s.lines.length) out.push(`${v.id} slide ${i}: ${s.lines.length} lines read as ${n} sentences`)
    const cues = JSON.stringify(s).match(/"cue":(\d+)/g)?.map((c) => Number(c.slice(6))) || []
    if (cues.some((c) => c >= n)) out.push(`${v.id} slide ${i}: cue ${Math.max(...cues)} but only ${n} sentences`)
  })
  return out
}
