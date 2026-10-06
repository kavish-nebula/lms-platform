/* Generates real narration audio (MP3) for all course content via edge-tts.
   Run: npm run audio   (needs internet; python3 -m edge_tts)
   A clip is regenerated when its text changed (hash in public/audio/manifest.json),
   when the file is missing, or when it is too short for its text (a cut-off download).
   Pass file names to force specific clips: npm run audio -- m1-reveal.mp3 */
import m1 from '../src/content/modules/m1.js'
import m2 from '../src/content/modules/m2.js'
import m3 from '../src/content/modules/m3.js'
import m4 from '../src/content/modules/m4.js'
import m5 from '../src/content/modules/m5.js'
import { CAPSTONE } from '../src/content/capstone.js'
import { audioItems, capstoneAudio } from '../src/content/audio.js'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('public/audio')
const MANIFEST = path.join(OUT, 'manifest.json')
const VOICE = 'en-US-AndrewMultilingualNeural'
const MIN_BYTES_PER_CHAR = 250 // 48 kbps speech runs ~400 bytes per character of script
mkdirSync(OUT, { recursive: true })

const force = new Set(process.argv.slice(2))
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
const hash = (text) => createHash('sha1').update(`${VOICE}\n${text}`).digest('hex').slice(0, 12)
const complete = (dest, text) => existsSync(dest) && statSync(dest).size > Math.max(1000, text.length * MIN_BYTES_PER_CHAR)

const items = [...[m1, m2, m3, m4, m5].flatMap(audioItems), ...capstoneAudio(CAPSTONE)].map((it) => ({ file: path.basename(it.src), text: it.text }))

let made = 0
let kept = 0
const failed = []
for (const it of items) {
  const dest = path.join(OUT, it.file)
  const h = hash(it.text)
  // a clip from before the manifest existed is taken as current unless it looks cut off
  const current = complete(dest, it.text) && (manifest[it.file] ? manifest[it.file] === h : true)
  if (current && !force.has(it.file)) { manifest[it.file] = h; kept++; continue }
  let done = false
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    const r = spawnSync('python3', ['-m', 'edge_tts', '--voice', VOICE, '--text', it.text, '--write-media', dest], { encoding: 'utf8', timeout: 90000 })
    if (r.status === 0 && complete(dest, it.text)) { done = true; made++; manifest[it.file] = h; console.log('✓', it.file, statSync(dest).size) }
    else if (attempt === 3) { failed.push(it.file); delete manifest[it.file]; console.error('✗', it.file, (r.stderr || r.error?.message || 'too short').trim().split('\n').pop().slice(0, 160)) }
  }
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`\n${items.length} clips: ${made} generated, ${kept} kept, ${failed.length} failed${failed.length ? ' → ' + failed.join(', ') : ''}`)
process.exit(failed.length ? 1 : 0)
