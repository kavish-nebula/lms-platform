import { Download } from 'lucide-react'
import { Btn } from './bits.jsx'
import { LEARNER } from '../content/session.js'

/*
  The Proof Card — a shareable, canvas-rendered certificate of what was built.
  Rendered at 1200×675 and downloaded as a PNG. This is the "proof, not badges"
  answer to a badge shelf: it carries numbers, not icons.
*/
export function downloadProofCard({ name = LEARNER.name, modulesDone = 0, modulesTotal = 5, hours = 0, notes = 0, notesTotal = 10, quizzes = 0, finalScore = '' } = {}) {
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 675
  const x = c.getContext('2d')

  // backdrop — the deep end of the Frosted Aura palette
  const bg = x.createLinearGradient(0, 0, 1200, 675)
  bg.addColorStop(0, '#1d2f39')
  bg.addColorStop(0.6, '#2b414c')
  bg.addColorStop(1, '#24343e')
  x.fillStyle = bg
  x.fillRect(0, 0, 1200, 675)

  // faint rings, like the canvas grid of the course
  x.strokeStyle = 'rgba(127, 162, 180, 0.14)'
  x.lineWidth = 1.5
  for (let r = 90; r < 700; r += 90) {
    x.beginPath()
    x.arc(1120, 640, r, 0, Math.PI * 2)
    x.stroke()
  }
  const glow = x.createRadialGradient(140, 80, 10, 140, 80, 420)
  glow.addColorStop(0, 'rgba(92, 126, 143, 0.35)')
  glow.addColorStop(1, 'rgba(92, 126, 143, 0)')
  x.fillStyle = glow
  x.fillRect(0, 0, 640, 420)

  // header
  x.fillStyle = '#e6b15c'
  x.font = '700 22px Inter, system-ui, sans-serif'
  x.fillText('P R O O F C R A F T', 72, 92)
  x.fillStyle = 'rgba(220, 231, 238, 0.75)'
  x.font = '500 19px Inter, system-ui, sans-serif'
  x.fillText('PROOF OF WORK — learning you can prove', 72, 124)

  // name
  x.fillStyle = '#f2f7fa'
  x.font = '800 64px Inter, system-ui, sans-serif'
  x.fillText(`${name}'s automation portfolio`, 72, 218)

  // divider
  x.strokeStyle = 'rgba(230, 177, 92, 0.65)'
  x.lineWidth = 3
  x.beginPath()
  x.moveTo(72, 252)
  x.lineTo(560, 252)
  x.stroke()

  // stats — a 2×2 evidence grid
  const stats = [
    ['Modules shipped', `${modulesDone} of ${modulesTotal}`],
    ['Manual work automated', `${hours} hrs / week`],
    ['Field notes survived', `${notes} of ${notesTotal}`],
    ['Module quizzes passed', `${quizzes}${finalScore ? ` · final: ${finalScore}` : ''}`],
  ]
  stats.forEach(([label, value], i) => {
    const cx = 72 + (i % 2) * 560
    const cy = 330 + Math.floor(i / 2) * 130
    x.fillStyle = 'rgba(220, 231, 238, 0.6)'
    x.font = '600 17px Inter, system-ui, sans-serif'
    x.fillText(label.toUpperCase(), cx, cy)
    x.fillStyle = '#ffffff'
    x.font = '800 44px Inter, system-ui, sans-serif'
    x.fillText(value, cx, cy + 56)
  })

  // seal
  x.strokeStyle = '#e6b15c'
  x.lineWidth = 4
  x.beginPath()
  x.arc(1060, 160, 62, 0, Math.PI * 2)
  x.stroke()
  x.fillStyle = '#e6b15c'
  x.beginPath()
  x.arc(1060, 160, 52, 0, Math.PI * 2)
  x.fill()
  x.strokeStyle = '#1d2f39'
  x.lineWidth = 8
  x.beginPath()
  x.moveTo(1034, 162)
  x.lineTo(1052, 180)
  x.lineTo(1088, 140)
  x.stroke()

  // footer
  x.fillStyle = 'rgba(220, 231, 238, 0.55)'
  x.font = '500 17px Inter, system-ui, sans-serif'
  x.fillText(`Issued ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} · every number above is backed by a real artifact`, 72, 616)

  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proofcraft-proof-card-${name.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(url)
  })
}

/* The button that goes on Complete and Portfolio. */
export function ProofCardBtn({ data, ...rest }) {
  return (
    <Btn onClick={() => downloadProofCard(data)} {...rest}>
      <Download size={14} /> Download your Proof Card
    </Btn>
  )
}
