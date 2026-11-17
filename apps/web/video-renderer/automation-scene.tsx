import React from 'react';
import type { Chapter } from './types';
import { Label, PathFlow, reveal } from './visual-primitives';
import { T } from './theme';

const Words = ({x,y,children,color=T.text}:{x:number;y:number;children:React.ReactNode;color?:string}) => <Label x={x} y={y} color={color}>{children}</Label>;
const Document = ({x,y}:{x:number;y:number}) => <g transform={`translate(${x} ${y})`}><rect width="110" height="140" rx="10" fill={T.paper}/><path d="M22 35h65M22 60h65M22 85h45M22 110h55" stroke={T.ink} strokeWidth="5" strokeLinecap="round"/></g>;
const Network = ({x,y}:{x:number;y:number}) => <g transform={`translate(${x} ${y})`}>{[0,1,2].flatMap(i=>[0,1,2].map(j=><path key={`${i}-${j}`} d={`M0 ${i*55}L100 ${j*55}L200 ${i*55}`} stroke={T.blue} strokeWidth="2" opacity=".6"/>))}{[0,1,2].flatMap(i=>[0,1,2].map(j=><circle key={`${i}-${j}`} cx={i*100} cy={j*55} r="12" fill={i===2?T.mint:T.blue}/>))}</g>;
const Person = ({x,y}:{x:number;y:number}) => <g transform={`translate(${x} ${y})`}><circle cy="-30" r="28" fill={T.amber}/><path d="M-52 60v-20a52 52 0 0 1 104 0v20" stroke={T.amber} fill="none" strokeWidth="13"/></g>;
const Bubble = ({x,y,w=330,text}:{x:number;y:number;w?:number;text:string}) => <g><path d={`M${x} ${y}h${w}q18 0 18 18v60q0 18-18 18h-${w-35}l-28 22v-22h-7q-18 0-18-18v-60q0-18 18-18Z`} fill={T.panel} stroke={T.blue}/><Words x={x+w/2} y={y+53}>{text}</Words></g>;

/** Source-aligned reveals take 1.2 seconds, then hold for the explanation. */
export function AutomationScene({chapter,time}:{chapter:Chapter;time:number}) {
  const a=reveal(chapter,time,'primary'), b=reveal(chapter,time,'secondary'), l=chapter.labels;
  let scene: React.ReactNode;
  if(chapter.kind==='method-comparison') scene=<>
    <g opacity={a}><rect x="70" y="195" width="530" height="410" rx="24" fill={T.panel}/><Words x={335} y={245} color={T.mint}>{l[0]}</Words><Document x={145} y={300}/><PathFlow d="M275 365H335" progress={a}/><path d="M400 305l70 60-70 60-70-60Z" fill={T.bg} stroke={T.mint} strokeWidth="3"/><path d="M400 425v55h100" fill="none" stroke={T.mint} strokeWidth="4"/><path d="M470 365h55" stroke={T.mint} strokeWidth="4"/><Words x={335} y={560}>{l[1]}</Words></g>
    <g opacity={b}><rect x="650" y="195" width="560" height="410" rx="24" fill={T.panel}/><Words x={930} y={245} color={T.blue}>{l[2]}</Words><Network x={825} y={325}/><Words x={930} y={560}>{l[3]}</Words></g>
  </>;
  else if(chapter.kind==='rule-router') scene=<>
    <g opacity={a}><Document x={120} y={280}/><Words x={175} y={235}>{l[0]}</Words><PathFlow d="M245 350H420" progress={a}/><path d="M610 225l200 125-200 125-200-125Z" fill={T.panel} stroke={T.mint} strokeWidth="3"/><Words x={610} y={325}>Contains phrase?</Words><Words x={610} y={385} color={T.mint}>{l[1]}</Words><PathFlow d="M815 350H980" progress={a}/><Words x={1090} y={300}>{l[2]}</Words>{[0,1,2].map(i=><rect key={i} x={1000+i*14} y={340+i*18} width="130" height="70" rx="8" fill={T.panel} stroke={T.mint}/> )}</g>
    <g opacity={b}><PathFlow d="M610 480V550H900" progress={b}/><Words x={1010} y={560} color={T.amber}>{l[4]}</Words><Words x={610} y={635}>No match → manual review</Words></g>
  </>;
  else if(chapter.kind==='intent-model') scene=<>
    <g opacity={a}><Bubble x={85} y={240} text={l[0]}/><Bubble x={85} y={430} text={l[1]}/><PathFlow d="M445 295C500 295 490 365 530 365M445 485C500 485 490 365 530 365" progress={a}/><Network x={550} y={315}/><Words x={650} y={520}>{l[3]}</Words><PathFlow d="M780 370H890" progress={a}/><rect x="910" y="280" width="300" height="170" rx="24" fill={T.panel} stroke={T.blue}/><Words x={1060} y={335}>Suggested intent</Words><Words x={1060} y={395} color={T.mint}>{l[2]}</Words></g>
    <g opacity={b}><Person x={1060} y={555}/><Words x={780} y={630} color={T.amber}>{l[4]}</Words></g>
  </>;
  else if(chapter.kind==='stopped-line') scene=<>
    <g opacity={a}><rect x="120" y="370" width="1020" height="110" rx="55" fill={T.panel} stroke={T.mint} strokeWidth="5"/>{[0,1,2,3,4,5,6].map(i=><circle key={i} cx={185+i*145} cy="425" r="30" fill="none" stroke={T.line} strokeWidth="4"/>)}<rect x="280" y="280" width="130" height="90" rx="8" fill={T.mint}/><Words x={345} y={240}>{l[0]}</Words><rect x="850" y="230" width="230" height="100" rx="16" fill={T.panel}/><Words x={965} y={290}>{l[2]}</Words></g>
    <g opacity={b}><rect x="540" y="190" width="245" height="180" rx="10" fill={T.amber}/><Words x={663} y={160} color={T.amber}>{l[1]}</Words><path d="M595 280h135" stroke={T.ink} strokeWidth="12"/><Words x={640} y={565} color={T.amber}>{l[3]}</Words><Words x={640} y={625}>No instruction for this input</Words></g>
  </>;
  else if(chapter.kind==='threshold-prediction') scene=<>
    <g opacity={a}><rect x="70" y="220" width="530" height="390" rx="24" fill={T.panel}/><path d="M185 420h300M335 420V300M235 300h200" stroke={T.mint} strokeWidth="8"/><path d="M245 300l-55 85h110Z M425 300l-55 85h110Z" stroke={T.mint} fill={T.bg} strokeWidth="3"/><Words x={335} y={265}>{l[0]}</Words><Words x={335} y={525}>{l[1]}</Words></g>
    <g opacity={b}><rect x="650" y="220" width="560" height="390" rx="24" fill={T.panel}/><Network x={825} y={315}/><Words x={930} y={265}>{l[2]}</Words><Words x={930} y={490} color={T.blue}>{l[3]}</Words><Words x={930} y={555} color={T.amber}>{l[4]}</Words></g>
  </>;
  else if(chapter.kind==='fixed-cooler') scene=<>
    <g opacity={a}><rect x="150" y="220" width="90" height="270" rx="45" fill={T.panel} stroke={T.mint} strokeWidth="3"/><circle cx="195" cy="485" r="55" fill={T.mint}/><path d="M195 280V480" stroke={T.mint} strokeWidth="22"/><Words x={195} y={600}>{l[0]}</Words><PathFlow d="M270 370H440" progress={a}/><rect x="460" y="285" width="355" height="155" rx="20" fill={T.panel} stroke={T.mint}/><Words x={637} y={345}>{l[1]}</Words><Words x={637} y={400}>Switch cooling on</Words><PathFlow d="M835 370H950" progress={a}/><circle cx="1070" cy="365" r="90" fill={T.panel} stroke={T.blue} strokeWidth="4"/>{[0,120,240].map(angle=><path key={angle} d="M1070 365q-65-65-10-75q55-10 10 75" fill={T.blue} transform={`rotate(${angle} 1070 365)`}/>)}<circle cx="1070" cy="365" r="14" fill={T.mint}/><Words x={1070} y={515}>{l[2]}</Words></g>
    <g opacity={b}><rect x="460" y="480" width="355" height="105" rx="18" fill={T.bg} stroke={T.amber}/><Words x={637} y={520} color={T.amber}>Coolant ages</Words><Words x={637} y={560}>{l[3]}</Words></g>
  </>;
  else if(chapter.kind==='request-comparison') scene=<>
    <g opacity={a}><Bubble x={110} y={330} w={300} text={l[0]}/><PathFlow d="M445 380C510 380 490 265 570 265" progress={a}/><rect x="590" y="200" width="330" height="125" rx="18" fill={T.panel} stroke={T.mint}/><Words x={755} y={250}>Fixed rule</Words><Words x={755} y={295} color={T.amber}>{l[1]}</Words><PathFlow d="M940 265H1020" progress={a}/><Words x={1110} y={270}>{l[2]}</Words></g>
    <g opacity={b}><PathFlow d="M445 395C510 395 490 510 570 510" progress={b}/><Network x={600} y={450}/><Words x={700} y={625}>{l[3]}</Words><PathFlow d="M840 510H920" progress={b}/><Words x={1070} y={495} color={T.blue}>{l[4]}</Words><Words x={1070} y={555} color={T.amber}>{l[5]}</Words></g>
  </>;
  else if(chapter.kind==='reviewed-workflow') scene=<>
    <g opacity={a}><Document x={100} y={300}/><Words x={160} y={520}>{l[0]}</Words><PathFlow d="M230 370H350" progress={a}/><Network x={375} y={315}/><Words x={475} y={520}>{l[1]}</Words><PathFlow d="M600 370H720" progress={a}/><Person x={780} y={365}/><Words x={780} y={520} color={T.amber}>{l[2]}</Words></g>
    <g opacity={b}><PathFlow d="M845 370H995" progress={b}/><rect x="1010" y="290" width="190" height="165" rx="20" fill={T.panel} stroke={T.mint}/><path d="M1045 370l35 35 80-85" fill="none" stroke={T.mint} strokeWidth="10"/><Words x={1100} y={520}>{l[3]}</Words><Words x={640} y={635} color={T.amber}>A suggestion is not permission to act</Words></g>
  </>;
  else scene=<>
    <g opacity={a}><rect x="70" y="200" width="1140" height="175" rx="24" fill={T.panel}/><Document x={125} y={215}/><Words x={395} y={290}>{l[0]}</Words><PathFlow d="M550 285H680" progress={a}/><Words x={820} y={290}>{l[1]}</Words><Words x={1070} y={290} color={T.mint}>{l[2]}</Words></g>
    <g opacity={b}><rect x="70" y="425" width="1140" height="180" rx="24" fill={T.panel}/><Network x={120} y={460}/><Words x={450} y={515}>{l[3]}</Words><PathFlow d="M600 515H680" progress={b}/><Words x={820} y={515}>{l[4]}</Words><Words x={1070} y={515} color={T.blue}>{l[5]}</Words></g>
  </>;
  return <svg viewBox="0 0 1280 720" width="1280" height="720">{scene}</svg>;
}
