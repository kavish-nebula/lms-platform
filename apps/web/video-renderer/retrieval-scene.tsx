import React from 'react';
import type { Chapter } from './types';
import { Label, Paper, PathFlow, reveal } from './visual-primitives';
import { T } from './theme';

export function RetrievalScene({chapter,time}: {chapter:Chapter;time:number}) {
  const a=reveal(chapter,time,'primary'), b=reveal(chapter,time,'secondary'), c=reveal(chapter,time,'detail'), d=reveal(chapter,time,'result');
  const boundary=chapter.kind==='data-boundary';
  if(boundary) return <svg viewBox="0 0 1280 720"><g opacity={a}><rect x="100" y="200" width="440" height="350" rx="26" stroke={T.mint} strokeDasharray="8 8" fill={T.panel}/><rect x="230" y="300" width="180" height="110" rx="10" fill="none" stroke={T.mint} strokeWidth="5"/><path d="M320 410v35m-45 0h90" stroke={T.mint} strokeWidth="5"/><Label x={320} y={260}>{chapter.labels[0]}</Label></g><g opacity={b}><path d="M835 370C765 365 765 285 820 280C820 200 945 190 970 265C1060 245 1115 365 1035 370Z" fill={T.panel} stroke={T.blue} strokeWidth="5"/><Label x={930} y={455}>{chapter.labels[1]}</Label></g><g opacity={c}><path d="M640 240V465" stroke={T.amber} strokeWidth="5" strokeDasharray="8 10"/><rect x="619" y="330" width="42" height="38" rx="8" fill={T.panel} stroke={T.amber}/><path d="M628 330v-12a12 12 0 0 1 24 0v12" fill="none" stroke={T.amber} strokeWidth="4"/><Label x={640} y={525}>{chapter.labels[2]}</Label></g><g opacity={d}><Label x={640} y={625} color={T.amber}>{chapter.labels[3]}</Label></g></svg>;
  return <svg viewBox="0 0 1280 720"><g opacity={a}><rect x="85" y="290" width="285" height="105" rx="20" fill={T.panel} stroke={T.blue}/><Label x={227} y={350} size={23}>{chapter.labels[0]}</Label></g>
    <g opacity={b}><PathFlow d="M370 342H480" progress={b}/>{[0,1,2].map(i=><Paper key={i} x={490+i*60} y={250+i*25} scale={.72} highlight={i===2?c:0}/>)}<Label x={620} y={210}>{chapter.labels[1]}</Label></g>
    <g opacity={c}><PathFlow d="M760 370Q850 370 870 300" progress={c}/><rect x="870" y="250" width="320" height="150" rx="18" fill={T.panel} stroke={T.mint}/><Label x={1030} y={335} size={23}>{chapter.labels[2] || 'Source passage'}</Label></g>
    <g opacity={d}><path d="M1030 400v75H225v-60" fill="none" stroke={T.amber} strokeWidth="3"/><Label x={640} y={550} color={T.amber}>{chapter.labels[3] || 'Review the source-linked draft'}</Label></g>
  </svg>;
}
