import { Lock, ArrowRight, Star } from 'lucide-react'
import GlassCard from './GlassCard.jsx'
import ModuleRail from './ModuleRail.jsx'
import { Btn, NebulaMark } from './bits.jsx'
import { MODULES } from '../content/course.js'
import { moduleMinutes, fmtMinutes } from '../engine/progress.js'

const TONES = ['', 'tone-1', 'tone-2', 'tone-3', 'tone-4']

function ModuleTile({ n, m }) {
  return (
    <div className="rail-card cat-mod" aria-hidden="true">
      <div className={`cat-mod-art ${TONES[n] || ''}`}><span>{n}</span></div>
      <h3>{m.title}</h3>
      <p className="cat-mod-cap">Module {n} of {MODULES.length}</p>
    </div>
  )
}

function ComingSoonTile() {
  return (
    <div className="rail-card cat-mod locked" aria-hidden="true">
      <div className="cat-mod-art soon"><Lock size={18} /></div>
      <h3>New module</h3>
      <p className="cat-mod-cap">Coming soon</p>
    </div>
  )
}

/*
  The Coursera-style credential card — course info + "Skills you'll gain" on the
  left, the modules as a horizontal arrow-driven rail on the right. The modules
  move with the arrows; nothing inside a rail can be reordered.
*/
export default function CredentialCard({ course, enrolled = false, status = null, featuredLabel = 'Top recommendation' }) {
  const hours = Math.round(MODULES.filter((m) => m.built).reduce((n, m) => n + moduleMinutes(m), 0) / 30) / 2
  return (
    <GlassCard className="cert-card" hover={course.open}>
      <div className="cert-flag">
        {course.open
          ? <span className="chip acc">{enrolled ? 'Your course' : featuredLabel}</span>
          : <span className="chip"><Lock size={11} /> coming soon</span>}
        {status && <span className="chip ok">{status}</span>}
      </div>

      <div className="cert-grid">
        <div className="cert-info">
          <span className="cert-logo" aria-hidden="true">
            {course.open ? <NebulaMark size={26} /> : course.title.charAt(0)}
          </span>
          <h2>{course.title}</h2>
          <p className="cert-skills"><b>Skills you&rsquo;ll gain:</b> {course.skills.join(', ')}</p>
          <p className="cert-rating"><Star size={14} fill="#D97706" stroke="none" aria-hidden="true" /> <b>{course.rating}</b> <span className="muted small">({course.reviews.toLocaleString()} reviews)</span></p>
          <p className="cert-meta">{course.level} &middot; {course.open ? `about ${fmtMinutes(MODULES.filter((m) => m.built).reduce((n, m) => n + moduleMinutes(m), 0))} now` : 'in the works'} &middot; {course.open ? `${MODULES.length} modules + capstone` : `${course.planned} modules planned`}</p>
          <div className="cert-ctas">
            {course.open ? (
              <>
                <Btn to={`/course/${course.id}`} variant="primary" size="sm">{enrolled ? 'Open course' : 'Enroll for free'} <ArrowRight size={13} /></Btn>
                <Btn to={`/course/${course.id}`} size="sm" variant="ghost">View details</Btn>
              </>
            ) : (
              <span className="chip">Coming soon</span>
            )}
          </div>
        </div>

        <div className="cert-rail">
          <ModuleRail label={`${course.title} modules`}>
            {course.open
              ? MODULES.map((m, i) => <ModuleTile key={m.n} n={i + 1} m={m} />)
              : Array.from({ length: course.planned + 1 }, (_, i) => <ComingSoonTile key={i} />)}
          </ModuleRail>
        </div>
      </div>
    </GlassCard>
  )
}
