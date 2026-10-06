/*
  Illustrated empty state — a small inline-SVG scene instead of a bare note.
  Used where a learner first arrives and nothing exists yet.
*/
export default function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <svg className="empty-illus" viewBox="0 0 120 88" aria-hidden="true">
        {/* open crate */}
        <path d="M28 46 L60 34 L92 46 L60 58 Z" fill="var(--accent-soft)" stroke="var(--accent-line)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M28 46 L28 68 L60 80 L60 58 Z" fill="var(--panel2)" stroke="var(--accent-line)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M92 46 L92 68 L60 80 L60 58 Z" fill="var(--panel)" stroke="var(--accent-line)" strokeWidth="2" strokeLinejoin="round" />
        {/* sparkles rising from the crate */}
        <path d="M60 18 l2.6 5.4 5.4 2.6 -5.4 2.6 -2.6 5.4 -2.6 -5.4 -5.4 -2.6 5.4 -2.6 Z" fill="var(--amber)" opacity="0.9" />
        <circle cx="38" cy="24" r="2.4" fill="var(--accent)" opacity="0.7" />
        <circle cx="84" cy="20" r="3" fill="var(--ok)" opacity="0.6" />
        <circle cx="97" cy="34" r="1.8" fill="var(--accent)" opacity="0.5" />
        {/* dotted drift line */}
        <path d="M46 12 C 54 4, 70 4, 78 10" fill="none" stroke="var(--accent-line)" strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" />
      </svg>
      {title && <b className="empty-title">{title}</b>}
      <p className="muted small">{children}</p>
      {action && <div className="mt14">{action}</div>}
    </div>
  )
}
