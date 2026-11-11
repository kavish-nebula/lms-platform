import { useState } from 'react'
import { PageHeader } from '../ui/bits.jsx'
import CredentialCard from '../ui/CredentialCard.jsx'
import { useCourse } from '../stores/course.js'
import { useLearner } from '../stores/learner.js'
import { MODULES } from '../content/course.js'
import { COURSES } from '../content/catalog.js'
import { courseProgress, isEnrolled } from '../engine/progress.js'

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced']

/*
  Courses — Coursera-style credential cards: course info + skills on the left,
  the modules as a horizontal, arrow-driven rail on the right. Nothing inside
  a rail can be reordered — the rails move, the modules don't.
*/
export default function Catalog() {
  const progress = useCourse((s) => s.progress)
  const final = useCourse((s) => s.final)
  const precheck = useLearner((s) => s.precheck)
  const [level, setLevel] = useState('All')
  const enrolled = isEnrolled(precheck, progress)
  const overall = courseProgress(progress)
  const status = !enrolled ? null : final?.passed ? 'completed' : `in progress · ${Math.round(overall.value * 100)}%`
  const shown = level === 'All' ? COURSES : COURSES.filter((c) => c.level === level)

  return (
    <div>
      <PageHeader kicker="Courses" title="Recommended credentials" sub="Every course on the platform, Coursera-style: what you'll learn, what you'll gain, and the modules inside — one card per course." />

      <div className="level-pills" role="group" aria-label="Filter courses by level">
        {LEVELS.map((l) => (
          <button key={l} type="button" className="level-pill" aria-pressed={level === l} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
      </div>

      <div className="cert-list">
        {shown.map((c) => (
          <CredentialCard key={c.id} course={c} enrolled={enrolled} status={c.open ? status : null} />
        ))}
      </div>
    </div>
  )
}
