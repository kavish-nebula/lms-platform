import { Link } from 'react-router-dom'

/* Nebula KnowLab — the orbital mark: teal ring, purple + silver ellipses, one red-orange sweep. */
export function NebulaMark({ size = 28, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nk-orbit" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#A62F2F" />
          <stop offset="1" stopColor="#F07038" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="43" stroke="#3E7C8C" strokeWidth="5" />
      <ellipse cx="50" cy="50" rx="41" ry="25" stroke="#6B3FA0" strokeWidth="5" transform="rotate(-20 50 50)" />
      <ellipse cx="50" cy="50" rx="40" ry="23" stroke="#C7CBD1" strokeWidth="4.5" transform="rotate(30 50 50)" />
      <ellipse cx="50" cy="50" rx="40" ry="24" stroke="url(#nk-orbit)" strokeWidth="5.5" strokeLinecap="round"
        transform="rotate(-55 50 50)" strokeDasharray="138 66" />
    </svg>
  )
}

export function Btn({ to, children, variant = '', size = '', className = '', ...rest }) {
  const cls = `btn ${variant} ${size} ${className}`
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  )
}

/* Top of a page — the one h1. */
export function PageHeader({ kicker, title, sub, right }) {
  return (
    <header className="page-head row between wrap">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </header>
  )
}

export function SectionTitle({ kicker, title, sub, right }) {
  return (
    <div className="section-title row between wrap">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function StatTile({ icon: Icon, value, unit, label, tone = 'accent' }) {
  return (
    <div className={`glass stat-tile tone-${tone}`}>
      {Icon && <span className="stat-ic"><Icon size={19} /></span>}
      <div>
        <div className="stat-value">{value}{unit && <span className="stat-unit">{unit}</span>}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export function ProgressBar({ value = 0, label = 'Progress' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyNote({ children }) {
  return <div className="empty-note">{children}</div>
}
