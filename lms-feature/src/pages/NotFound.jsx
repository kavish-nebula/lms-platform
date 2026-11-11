import { Btn } from '../ui/bits.jsx'
import GlassCard from '../ui/GlassCard.jsx'
import { useLearner } from '../stores/learner.js'

export default function NotFound() {
  const hasProfile = useLearner((s) => !!s.profile)
  return (
    <div className="mt30">
      <GlassCard className="pad-lg center" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="kicker mb8">Page not found</div>
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>There’s nothing at this address</h1>
        <p className="muted mt8">The link may be old, or the page may have moved.</p>
        <div className="mt20"><Btn variant="primary" to={hasProfile ? '/dashboard' : '/'}>{hasProfile ? 'Go to your dashboard' : 'Go to the start'}</Btn></div>
      </GlassCard>
    </div>
  )
}
