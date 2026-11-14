/** Fictional administration only: no patient data, care recommendations or clinical thresholds. */
export function HealthcareAutomationVisual({ phase, seconds }: { phase: 'before' | 'after'; seconds: number }) {
  const active = Math.floor(seconds / 3) % 3;
  const labels = phase === 'before' ? ['Appointment request', 'Check fixed rule', 'Reception queue'] : ['Queue history', 'Find patterns', 'Staff review'];
  return <svg viewBox="0 0 760 440" role="img" aria-label={`Fictional clinic administration: ${labels.join(' → ')}. People review exceptions; no clinical decisions are automated.`} className="w-full">
    <rect x="255" y="25" width="250" height="150" rx="20" fill="var(--panel)" stroke="var(--ok)" strokeWidth="3" />
    <path d="M355 45 h50 v25 h25 v40 h-25 v25 h-50 v-25 h-25 v-40 h25z" fill="var(--ok)" />
    <text x="380" y="160" textAnchor="middle" fill="var(--text)" fontSize="19">Fictional clinic reception</text>
    <path d="M130 185 v35 M380 185 v35 M630 185 v35 M130 205 h500" fill="none" stroke="var(--ok)" strokeWidth="3" />
    {labels.map((label, i) => <g key={label}>
      <rect x={25+i*250} y="230" width="210" height="140" rx="18" fill="var(--panel)" stroke={i===active?'var(--ok)':'var(--muted)'} strokeWidth={i===active?4:2} />
      {i===0 ? <g stroke="var(--ok)" strokeWidth="4" fill="none"><rect x={95+i*250} y="250" width="65" height="65" rx="5"/><path d={`M${108+i*250} 268 h38 M${108+i*250} 283 h38 M${108+i*250} 298 h25`}/></g> : i===1 ? <g stroke="var(--ok)" strokeWidth="4" fill="none"><path d={phase==='before'?'M350 285 l20 20 40 -45':'M345 305 l20 -20 20 8 25 -35'}/><circle cx="380" cy="282" r="42"/></g> : <g stroke="var(--ok)" strokeWidth="4" fill="none"><circle cx="630" cy="267" r="17"/><path d="M595 315 q0 -35 35 -35 q35 0 35 35"/></g>}
      <text x={130+i*250} y="345" textAnchor="middle" fill="var(--text)" fontSize="17">{label}</text>
    </g>)}
    <text x="380" y="408" textAnchor="middle" fill="var(--muted)" fontSize="17">Administrative illustration · people set goals and review</text>
  </svg>;
}
