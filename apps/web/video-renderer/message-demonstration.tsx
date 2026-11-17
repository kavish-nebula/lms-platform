import React from 'react';
import type {Chapter} from './types';
import {T} from './theme';
import {reveal,Label} from './visual-primitives';

const Caption=({x,y,text,color=T.text,size=24}:{x:number;y:number;text:string;color?:string;size?:number})=><Label x={x} y={y} color={color} size={size}>{text}</Label>;
const Window=({x,y,w,h,title,children}:{x:number;y:number;w:number;h:number;title:string;children:React.ReactNode})=><g><rect x={x} y={y} width={w} height={h} rx="18" fill={T.panel} stroke={T.line}/><path d={`M${x} ${y+48}h${w}`} stroke={T.line}/>{[T.rose,T.amber,T.mint].map((c,i)=><circle key={c} cx={x+22+i*18} cy={y+24} r="4" fill={c}/>)}<text data-video-label="true" x={x+88} y={y+30} fill={T.muted} fontSize="17">{title}</text>{children}</g>;
const Field=({x,y,w,text,accent=T.rose}:{x:number;y:number;w:number;text:string;accent?:string})=><g><rect x={x} y={y} width={w} height="64" rx="8" fill={T.bg} stroke={accent}/><Caption x={x+w/2} y={y+40} text={text} color={accent}/></g>;

/** A consistent fictional workspace changes state while the voice explains it.
 * The actual input, condition, exception and review are the visual subjects. */
export function MessageDemonstration({chapter,time}:{chapter:Chapter;time:number}) {
  const a=reveal(chapter,time,'primary'), b=reveal(chapter,time,'secondary'), c=reveal(chapter,time,'detail'), d=reveal(chapter,time,'result'),l=chapter.labels;
  const rule=chapter.kind==='rule-router', intent=chapter.kind==='intent-model', compare=chapter.kind==='request-comparison';
  const message=rule?l[1]:intent?(chapter.example?.message??l[1]):compare?(chapter.example?.message??l[0]):'Incoming message';
  return <svg viewBox="0 0 1280 720" width="1280" height="720">
    <g opacity={a} transform={`translate(${24*(1-a)} 0)`}>
      <Window x={85} y={205} w={460} h={380} title="FICTIONAL WORKSPACE · INBOX">
        <text x="115" y="302" fill={T.muted} fontSize="20">{rule?l[0]:'Message to review'}</text>
        <rect x="112" y="330" width="405" height="155" rx="12" fill={T.paper}/>
        <path d="M137 350h18l12 10 12-10h18v30h-60Z" fill="none" stroke={T.ink} strokeWidth="2"/>
        <Caption x={315} y={425} text={message} color={T.ink} size={27}/>
        <text x="115" y="550" fill={T.muted} fontSize="19">One incoming request</text>
      </Window>
    </g>
    {rule?<>
      <g opacity={b}><Window x={620} y={205} w={575} h={205} title="RULE EDITOR · DEFINED BY PEOPLE"><text x="650" y="292" fill={T.muted} fontSize="20">IF MESSAGE CONTAINS</text><Field x={650} y={310} w={515} text={l[1]}/></Window></g>
      <g opacity={c}><path d="M545 405C580 405 575 337 620 337" fill="none" stroke={T.mint} strokeWidth="4"/><Field x={650} y={445} w={515} text="Match → route to review queue" accent={T.mint}/></g>
      <g opacity={d}><path d="M547 480C590 480 590 545 650 545" fill="none" stroke={T.amber} strokeWidth="3" strokeDasharray="6 6"/><Field x={650} y={520} w={515} text="Other wording → manual review" accent={T.amber}/></g>
    </>:intent?<>
      <g opacity={b}><Window x={620} y={205} w={575} h={400} title="AI ASSISTANT · SUGGESTION"><Caption x={907} y={300} text="Learned language patterns" color={T.rose}/>{[0,1,2].map(i=><path key={i} d={`M${680+i*50} 350q90 ${-40+i*35} 180 0t190 0`} stroke={T.blue} fill="none" strokeWidth="2"/>)}<Field x={650} y={410} w={515} text={l[2]} accent={T.mint}/></Window></g>
      <g opacity={c}><Caption x={907} y={510} text="AI can be wrong" color={T.amber}/></g>
      <g opacity={d}><Field x={650} y={530} w={515} text="Staff review before relying on it" accent={T.amber}/></g>
    </>:compare?<>
      <g opacity={b}><Window x={620} y={205} w={575} h={170} title="PATH A · WRITTEN RULE"><Caption x={907} y={290} text={l[1]} color={T.amber}/><Caption x={907} y={337} text={l[2]}/></Window></g>
      <g opacity={c}><Window x={620} y={405} w={575} h={180} title="PATH B · LEARNED PATTERNS"><Caption x={907} y={495} text={l[4]} color={T.mint}/><Caption x={907} y={550} text={l[5]} color={T.amber}/></Window></g>
      <g opacity={d}><Caption x={640} y={635} text="Neither path guarantees a correct outcome" color={T.amber}/></g>
    </>:<>
      <g opacity={b}><Window x={620} y={205} w={575} h={165} title="AI DRAFT · FOR REVIEW"><Caption x={907} y={300} text="Proposed category + draft reply" color={T.rose}/></Window></g>
      <g opacity={c}><Window x={620} y={395} w={575} h={190} title="REVIEWER · CHECK BEFORE ACTION"><Caption x={907} y={480} text="Interpretation · policy · wording" color={T.amber}/><Field x={650} y={510} w={515} text="Reviewed item" accent={T.mint}/></Window></g>
      <g opacity={d}><path d="M545 485C580 485 575 620 650 620" fill="none" stroke={T.mint} strokeWidth="4"/><Field x={650} y={605} w={515} text="Automation routes approved item" accent={T.mint}/></g>
    </>}
  </svg>;
}
