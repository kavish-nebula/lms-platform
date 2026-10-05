import { Link } from 'react-router-dom'

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
