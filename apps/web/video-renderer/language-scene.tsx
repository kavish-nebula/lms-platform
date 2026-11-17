import React from 'react';
import type { Chapter } from './types';
import { Label, Paper, PathFlow, reveal } from './visual-primitives';
import { T } from './theme';

export function LanguageScene({chapter,time}: {chapter:Chapter;time:number}) {
  const a=reveal(chapter,time,'primary'), b=reveal(chapter,time,'secondary'), c=reveal(chapter,time,'detail'), d=reveal(chapter,time,'result');
  const network=chapter.kind==='parameter-network', prompt=chapter.kind==='prompt-workspace';
  if(prompt) return <svg viewBox="0 0 1280 720"><g opacity={a}><rect x="145" y="180" width="990" height="400" rx="24" fill={T.panel}/><circle cx="183" cy="208" r="6" fill={T.mint}/><path d="M220 208h860" stroke={T.line}/><rect x="210" y="260" width="860" height="85" rx="12" fill={T.bg}/><Label x={640} y={310}>{chapter.labels[0]}</Label></g><g opacity={b}><rect x="210" y="380" width="860" height="56" rx="8" stroke={T.amber} fill="none"/><Label x={640} y={416} color={T.amber}>{chapter.labels[1]}</Label></g><g opacity={c}><Label x={640} y={500}>{chapter.labels[2]}</Label></g><g opacity={d}><Label x={640} y={636} color={T.mint}>{chapter.labels[3]}</Label></g></svg>;
  return <svg viewBox="0 0 1280 720">
    <g opacity={a}><Paper x={105} y={280} scale={.8}/><Label x={190} y={230}>{network ? "Source text" : chapter.labels[0]}</Label></g>
    <g opacity={b}><PathFlow d="M285 380H430" progress={b}/><rect x="435" y="245" width="410" height="285" rx="30" fill={T.panel}/><Label x={640} y={210}>{network ? 'Learned parameters' : chapter.labels[1] || 'Language model'}</Label>
      {network ? <g>{[0,1,2].flatMap(i=>[0,1,2].map(j=><g key={`${i}-${j}`}>{i<2 && [0,1,2].map(k=><path key={k} d={`M${510+i*125} ${300+j*85}L${635+i*125} ${300+k*85}`} stroke={T.line} strokeWidth="2"/>)}<circle cx={510+i*125} cy={300+j*85} r={12} fill={T.mint}/></g>))}</g> : <g>{[0,1,2,3].map(i=><rect key={i} x={465+i*90} y={340} width="66" height="60" rx="10" fill={T.blue} opacity={.35+i*.18}/>)}</g>}
    </g>
    <g opacity={c}><PathFlow d="M845 385H990" progress={c}/><rect x={990-20*(1-c)} y="310" width="195" height="150" rx="18" stroke={T.amber} strokeWidth="3" fill={T.panel}/><path d="M1020 350h130m-130 30h105m-105 30h125" stroke={T.amber} strokeWidth="5"/><Label x={1080} y={510} size={22}>{network ? 'Generated text' : chapter.labels[2] || 'Continuation'}</Label></g>
    <g opacity={network ? a : d}>{network ? chapter.labels.slice(0,4).map((label,i)=><g key={i}><rect x={100+i*285} y="590" width="250" height="55" rx="12" fill={T.panel} stroke={T.line}/><Label x={225+i*285} y={623} size={20}>{label}</Label></g>) : <Label x={640} y={625} color={T.amber}>{chapter.labels[3] || 'Review the generated result'}</Label>}</g>
  </svg>;
}
