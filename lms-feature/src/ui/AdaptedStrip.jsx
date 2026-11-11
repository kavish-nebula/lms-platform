import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

/*
  "Adapted for you" — what was changed on this step for this learner, and why.
  Each chip carries its reason (shown underneath, and as a tooltip) and where
  it came from: the profile answers or the measured pre-check.
*/
export default function AdaptedStrip({ chips, hasProfile, fixed = false }) {
  if (fixed) {
    return (
      <div className="adapted-strip plain">
        <Sparkles size={14} />
        <span className="small muted">The quiz is the same for every learner — it is the one step that never adapts.</span>
      </div>
    )
  }
  if (!chips.length) {
    return (
      <div className="adapted-strip plain">
        <Sparkles size={14} />
        <span className="small muted">
          {hasProfile ? 'This step is running as authored — nothing in your profile changes it.' : 'This step is running as authored.'}
        </span>
        <Link to={hasProfile ? '/profile' : '/onboarding'} className="link-btn">{hasProfile ? 'Change my settings' : 'Tell us how you learn'}</Link>
      </div>
    )
  }
  return (
    <div className="adapted-strip" aria-label="Adapted for you">
      <span className="adapted-title"><Sparkles size={14} /> Adapted for you</span>
      <div className="adapted-chips">
        {chips.map((c) => (
          <span key={c.text} className="adapted-chip" title={`${c.why} (from your ${c.from})`}>
            <b>{c.text}</b>
            <span className="tag-mono">from your {c.from}</span>
          </span>
        ))}
      </div>
      <Link to="/profile" className="link-btn">Change</Link>
    </div>
  )
}
