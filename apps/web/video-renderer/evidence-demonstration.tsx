import React from 'react';
import type {Chapter} from './types';
import {reveal,Label} from './visual-primitives';
import {T} from './theme';

/** A document is the actual subject, with annotations appearing against it.
 * Labels come from the validated storyboard, not fabricated record data. */
export function EvidenceDemonstration({chapter,time}:{chapter:Chapter;time:number}) {
  const a=reveal(chapter,time,'primary'),b=reveal(chapter,time,'secondary'),c=reveal(chapter,time,'detail'),d=reveal(chapter,time,'result'),l=chapter.labels;
  const table=chapter.kind==='spreadsheet',claim=chapter.kind==='claim-evidence';
  return <svg width="1280" height="720" viewBox="0 0 1280 720">
    <g opacity={a} transform={`translate(0 ${18*(1-a)})`}>
      <rect x="345" y="190" width="590" height="435" rx="10" fill={T.paper}/><path d="M380 270h520" stroke={T.ink} strokeWidth="2"/>
      <Label x={640} y={240} color={T.ink} size={27}>{l[0]}</Label>
      {[0,1,2,3,4].map(i=><g key={i}><path d={`M380 ${320+i*57}h${table?520:390-i*27}`} stroke={T.ink} strokeOpacity=".24" strokeWidth={table?2:5}/>{table&&<path d={`M540 ${285+i*57}v57m180-57v57`} stroke={T.ink} strokeOpacity=".3"/>}</g>)}
      <text x="380" y="603" fontSize="15" fill={T.ink}>ILLUSTRATION · NO LIVE RECORDS</text>
    </g>
    <g opacity={b}><rect x="372" y="287" width="535" height="55" rx="6" stroke={T.rose} strokeWidth="3" fill={T.rose} fillOpacity=".12"/><path d="M372 314H275" stroke={T.rose} strokeWidth="2"/><rect x="65" y="267" width="210" height="100" rx="12" fill={T.panel} stroke={T.rose}/><Label x={170} y={322} color={T.rose} size={23}>{l[1]||'Inspect the source'}</Label></g>
    <g opacity={c}><rect x="372" y="402" width="535" height="55" rx="6" stroke={T.mint} strokeWidth="3" fill={T.mint} fillOpacity=".1"/><path d="M907 428H1000" stroke={T.mint} strokeWidth="2"/><rect x="1000" y="380" width="210" height="100" rx="12" fill={T.panel} stroke={T.mint}/><Label x={1105} y={435} color={T.mint} size={23}>{l[2]||'Supporting evidence'}</Label></g>
    <g opacity={d}><rect x="375" y="545" width="530" height="45" rx="8" fill={T.ink}/><Label x={640} y={574} color={T.paper} size={22}>{l[3]||(claim?'Check the claim':'Review before acting')}</Label></g>
  </svg>;
}
