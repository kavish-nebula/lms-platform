import { Component } from 'react'

/* Catches render crashes: shows the error on screen (instead of a white page)
   and stores it so it can be reported. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    try {
      localStorage.setItem('pc-lastError', JSON.stringify({
        message: error?.message,
        stack: (error?.stack || '').split('\n').slice(0, 6).join('\n'),
        at: new Date().toISOString(),
      }))
    } catch { /* private mode */ }
    console.error('[Proofcraft crash]', error)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 720, margin: '80px auto', padding: 28 }} className="glass">
          <div className="kicker mb8" style={{ color: 'var(--err)' }}>Something broke — and we caught it</div>
          <h2 style={{ fontSize: 23, marginBottom: 10 }}>This screen crashed. Everything else is safe.</h2>
          <p className="muted small" style={{ lineHeight: 1.6 }}>
            Your progress is saved. Reload to continue, or head back to the dashboard.
          </p>
          <pre className="mono mt14" style={{ background: 'var(--panel2)', padding: 12, borderRadius: 10, overflow: 'auto', fontSize: 13 }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <div className="row mt14" style={{ gap: 10 }}>
            <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
            <button className="btn" onClick={() => this.setState({ error: null })}>Try to continue</button>
            <button className="btn ghost" onClick={() => { window.location.href = '/dashboard'; window.location.reload() }}>Dashboard</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
