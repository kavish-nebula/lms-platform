import React from 'react';
import type { Chapter } from './types';
import { Label, Paper, PathFlow, reveal, emphasis } from './visual-primitives';
import { T } from './theme';

export function DocumentScene({chapter, time}: {chapter: Chapter; time: number}) {
  const a = reveal(chapter,time,'primary'), b = reveal(chapter,time,'secondary'), c = reveal(chapter,time,'detail'), d = reveal(chapter,time,'result');
  const inspect = chapter.kind === 'source-inspection' || chapter.kind === 'spreadsheet';
  if(chapter.kind==='spreadsheet') return <svg viewBox="0 0 1280 720">
    <g opacity={a}><rect x="90" y="190" width="720" height="400" rx="20" fill={T.paper}/><rect x="90" y="190" width="720" height="65" rx="20" fill={T.mint}/><Label x={450} y={232} color={T.ink}>{chapter.labels[0]}</Label>
      {[0,1,2,3].map(row=><g key={row}><path d={`M110 ${285+row*75}H790`} stroke={T.muted}/>{[0,1,2].map(col=><path key={col} d={`M${130+col*225} ${315+row*75}h${col===1?125:85}`} stroke={T.line} strokeWidth="6" opacity=".5"/>)}</g>)}<path d="M330 255V580M555 255V580" stroke={T.muted}/>
      <rect x="340" y="275" width="205" height="65" rx="8" stroke={T.ink} fill={T.amber} opacity={b*.5}/>
    </g><g opacity={b}><PathFlow d="M555 310C740 310 760 245 875 245" progress={b}/><Label x={1010} y={250} color={T.mint}>{chapter.labels[1]}</Label><path d="M900 285h210" stroke={T.mint}/></g>
    <g opacity={c}>{[0,1,2].map(i=><g key={i} transform={`translate(${20*(1-c)} 0)`}><rect x={890+i*24} y={355+i*25} width="190" height="110" rx="12" fill={T.panel} stroke={T.blue}/><path d={`M${915+i*24} ${390+i*25}h125`} stroke={T.blue} strokeWidth="5"/></g>)}<Label x={1010} y={545}>{chapter.labels[2]}</Label></g><g opacity={d}><Label x={640} y={640} color={T.amber}>{chapter.labels[3]}</Label></g>
  </svg>;
  if(chapter.kind==='claim-evidence') return <svg viewBox="0 0 1280 720">
    <g opacity={a}><rect x="90" y="220" width="580" height="320" rx="24" fill={T.panel}/><circle cx="140" cy="270" r="20" fill={T.blue}/><path d="M130 270h20m-10-10v20" stroke={T.bg} strokeWidth="3"/><Label x={385} y={270}>{chapter.labels[0]}</Label>
      <g opacity={b}><path d="M180 320h400q20 0 20 20v110q0 20-20 20H240l-45 30v-30h-15q-20 0-20-20V340q0-20 20-20Z" fill={T.bg} stroke={T.blue}/><Label x={380} y={395}>{chapter.labels[1]}</Label></g>
    </g><g opacity={Math.max(c,d)}><Paper x={900} y={230} scale={1.05} highlight={c}/><Label x={1005} y={535}>{chapter.labels[2] || 'Source record'}</Label></g>
    <g opacity={d}><path d="M675 375H865" stroke={T.amber} strokeWidth="3" strokeDasharray="8 12"/><circle cx="770" cy="375" r="30" fill={T.bg} stroke={T.amber}/><Label x={770} y={385} color={T.amber}>?</Label><Label x={640} y={625} color={T.amber}>{chapter.labels[3] || 'Check the claim'}</Label></g>
  </svg>;
  return <svg viewBox="0 0 1280 720" width="1280" height="720">
    <g opacity={a}><rect x="64" y="170" width="1152" height="430" rx="24" fill={T.panel}/>
      <Paper x={inspect ? 185 : 155} y={245} scale={1.1} highlight={b}/><Label x={inspect ? 295 : 265} y={215}>{chapter.labels[0]}</Label>
      {inspect && <g opacity={b} transform={`translate(${35*b} 0)`}><circle cx="365" cy="380" r="70" stroke={T.mint} fill="none" strokeWidth="9"/><path d="M412 430l55 55" stroke={T.mint} strokeWidth="14" strokeLinecap="round"/></g>}
    </g>
    <g opacity={b}><PathFlow d="M430 360 C530 360 505 300 610 300" progress={b}/><rect x="630" y="240" width="495" height="125" rx="18" stroke={T.mint} strokeWidth={2+emphasis(chapter,time,'secondary')*3} fill={T.bg}/><Label x={875} y={310}>{chapter.labels[1] || 'Inspect the source'}</Label></g>
    <g opacity={c}><PathFlow d={b>0?'M875 365V425':'M430 380C540 380 520 480 620 480'} progress={c}/><rect x="630" y="430" width="495" height="100" rx="18" stroke={T.amber} fill={T.bg}/><Label x={875} y={488} color={T.amber}>{chapter.labels[2] || 'Check the evidence'}</Label></g>
    <g opacity={d}><circle cx="105" cy="638" r="5" fill={T.amber}/><Label x={640} y={645} color={T.amber}>{chapter.labels[3] || 'Keep the source boundary'}</Label></g>
  </svg>;
}
