import { Lock, ArrowRight } from 'lucide-react'
import { Btn, PageHeader } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { useCourse } from '../stores/course.js'
import { useLearner } from '../stores/learner.js'
import { MODULES } from '../content/course.js'
import { COURSES } from '../content/catalog.js'
import { courseProgress, isEnrolled, moduleMinutes } from '../engine/progress.js'

/*
  Courses — the catalogue: every course on the platform, once each, with the
  learner's status on it. Continuing a course is the Dashboard's job; this page
  is for finding one and opening its page.
*/
export default function Catalog() {
  const progress = useCourse((s) => s.progress)
  const final = useCourse((s) => s.final)
  const precheck = useLearner((s) => s.precheck)
  const enrolled = isEnrolled(precheck, progress)
  const overall = courseProgress(progress)
  const live = MODULES.filter((m) => m.built).length
  const hours = Math.round(MODULES.filter((m) => m.built).reduce((n, m) => n + moduleMinutes(m), 0) / 30) / 2
  const status = !enrolled ? null : final?.passed ? 'completed' : `in progress · ${Math.round(overall.value * 100)}%`

  return (
    <div>
      <PageHeader kicker="Courses" title="All courses" sub="Everything on the platform. Open a course to see what it covers and to start it. One course is open today; more follow." />

      <div className="grid c3">
        {COURSES.map((c) => (
          <GlassCard key={c.id} hover={c.open} className={c.open ? 'course-card' : 'course-card locked-card'}>
            <div className="row wrap" style={{ gap: 6 }}>
              <span className={`chip ${c.open ? 'acc' : ''}`}>{c.open ? `open · ${live} of ${MODULES.length} modules available` : <><Lock size={11} /> coming soon</>}</span>
              {c.open && status && <span className="chip ok">{status}</span>}
            </div>
            <h3 style={{ margin: '12px 0 8px' }}>{c.title}</h3>
            <p className="muted small">{c.problem}</p>
            {c.open && (
              <div className="row wrap mt14" style={{ gap: 12 }}>
                <Btn to={`/course/${c.id}`} variant="primary" size="sm">{enrolled ? 'Open course' : 'View course'} <ArrowRight size={13} /></Btn>
                <span className="tag-mono">about {hours} hrs available now</span>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
