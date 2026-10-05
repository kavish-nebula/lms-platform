import { ArrowRight } from 'lucide-react'
import { QUESTIONS, answerLabel } from '../content/profile.js'
import { explainAdaptations } from '../engine/adaptive.js'

/*
  "How this course adapts to you" — each answer next to the change it causes.
  With `onEdit`, every row's answer can be changed in place (Profile).
*/
export default function AdaptationList({ profile, onEdit }) {
  const rows = explainAdaptations(profile, QUESTIONS)
  return (
    <div className="adapt-list">
      {rows.map((r) => {
        const q = QUESTIONS.find((x) => x.id === r.id)
        const picked = (v) => (q.type === 'multi' ? r.value?.includes(v) : r.value === v)
        const pick = (v) => {
          if (q.type !== 'multi') return onEdit({ [q.id]: r.value === v ? null : v })
          const cur = r.value || []
          onEdit({ [q.id]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] })
        }
        return (
          <div key={r.id} className={`adapt-row ${r.answered ? '' : 'unset'}`}>
            <div className="adapt-q">
              <div className="kicker">{r.label}</div>
              {onEdit ? (
                <>
                  <div className="seg mt8" role="group" aria-label={q.q}>
                    {q.options.map((o) => (
                      <button key={String(o.v)} type="button" className="chip" aria-pressed={!!picked(o.v)} onClick={() => pick(o.v)}>{o.label}</button>
                    ))}
                  </div>
                  {/* “Something else” needs to be typed before it changes anything */}
                  {q.options.some((o) => o.free && o.v === r.value) && (
                    <input
                      className="input mt8" style={{ maxWidth: 320 }} maxLength={40} aria-label={`${q.label} — type yours`}
                      placeholder={q.options.find((o) => o.free).free} value={profile?.[`${q.id}Other`] || ''}
                      onChange={(e) => onEdit({ [`${q.id}Other`]: e.target.value })}
                    />
                  )}
                </>
              ) : (
                <b>{answerLabel(q, r.value, profile) || (q.type === 'multi' ? q.noneLabel : 'Skipped')}</b>
              )}
            </div>
            <ArrowRight size={16} className="adapt-arrow" aria-hidden="true" />
            <p className="adapt-change">{r.change}</p>
          </div>
        )
      })}
    </div>
  )
}
