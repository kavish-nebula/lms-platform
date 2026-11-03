/** Reuses the factory geometry from the Automation vs AI concept composition.
 * It is an illustrative motif, not a representation of operating equipment. */
export function ConceptFactoryVisual({ stopped, seconds = 0 }: { stopped: boolean; seconds?: number }) {
  const t = stopped ? 2 : seconds;
  return <svg viewBox="0 0 1080 440" role="img" aria-label="Illustrated production line and robotic arm" className="hook-film-factory">
    <rect x={35} y={310} width={1020} height={55} rx={26} fill="var(--text)" />
    {Array.from({ length: 17 }, (_, i) => <circle key={i} cx={65 + i * 59} cy={339} r={12} fill="var(--muted)" />)}
    {[0, 1, 2, 3].map(i => { const x = 40 + ((i * 260 + t * 78) % 900); return <g key={i}><rect x={x} y={240} width={150} height={70} rx={9} fill="var(--teal)" stroke="var(--ok)" strokeWidth={3} /><path d={`M${x + 45} 252 V300`} stroke="var(--ok)" strokeWidth={2} /></g>; })}
    <path d="M800 300 L780 175 L650 115 L700 55" fill="none" stroke="var(--ok)" strokeWidth={40} strokeLinejoin="round" />
    <circle cx={780} cy={175} r={28} fill="var(--text)" /><circle cx={650} cy={115} r={24} fill="var(--coral)" />
    <path d="M700 55 l30 -10 M700 55 l-30 -10" stroke="var(--text)" strokeWidth={10} />
  </svg>;
}
