import React from 'react';
import { AbsoluteFill, Html5Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VisualPlaybackProps, VisualTimedScene } from '@/lib/visual-lesson';
import { ReferenceVisualScene } from './reference-visual-scene';

const ink = '#f6f2ff', muted = '#b9b5d1', accent = '#9a85ff', mint = '#64d6b3', amber = '#ffd082';
function Node({ x, y, label, type, active }: { x: number; y: number; label: string; type: 'rule'|'model'|'human'|'input'; active: boolean }) {
  return <g opacity={active ? 1 : .3}>
    <rect x={x-112} y={y-70} width="224" height="140" rx="22" fill="#211d36" stroke={active ? mint : '#524b69'} strokeWidth="3" />
    {type === 'model' ? <g stroke={mint} strokeWidth="3">{[[x-40,y-25,x,y],[x-40,y+25,x,y],[x,y,x+40,y-25],[x,y,x+40,y+25]].map((p,i)=><line key={i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]}/>)}{[[x-40,y-25],[x-40,y+25],[x,y],[x+40,y-25],[x+40,y+25]].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="9" fill="#211d36"/>)}</g> : type === 'human' ? <g fill="none" stroke={mint} strokeWidth="4"><circle cx={x} cy={y-18} r="19"/><path d={`M${x-38} ${y+40} Q${x-38} ${y+8} ${x} ${y+8} Q${x+38} ${y+8} ${x+38} ${y+40}`}/></g> : type === 'rule' ? <g stroke={amber} strokeWidth="5" fill="none"><path d={`M${x-40} ${y-25} h35 v50 h45 M${x-40} ${y+25} h20 v-50 h60`}/><circle cx={x-40} cy={y-25} r="6"/><circle cx={x+40} cy={y+25} r="6"/></g> : <g fill="none" stroke={accent} strokeWidth="4"><rect x={x-35} y={y-37} width="70" height="74" rx="7"/><path d={`M${x-21} ${y-13} h42 M${x-21} ${y+2} h42 M${x-21} ${y+17} h24`}/></g>}
    <text x={x} y={y+59} textAnchor="middle" fill={ink} fontSize="20">{label}</text>
  </g>;
}
function Scene({ scene, captions, reducedMotion }: { scene: VisualTimedScene; captions: boolean; reducedMotion: boolean }) {
  const local = useCurrentFrame(), { fps } = useVideoConfig(), frame = local + scene.from;
  let index = scene.beats.findIndex(b => frame < b.from + b.durationInFrames);
  if (index < 0) index = scene.beats.length - 1;
  const beat = scene.beats[index];
  const progress = reducedMotion ? 1 : interpolate(frame - beat.from, [0, fps * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const compare = scene.kind === 'comparison';
  return <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 75% 15%, #28203f, #100e1b 70%)', fontFamily: 'Arial, sans-serif', color: ink }}>
    <div style={{ position:'absolute', left:64, top:38, fontSize:16, letterSpacing:3, color:mint }}>LEARNING IN FOCUS · VISUAL LESSON</div>
    <div data-scene-id={scene.id} style={{ position:'absolute', left:64, right:64, top:78, fontSize:42, fontWeight:700, lineHeight:1.15 }}>{scene.title}</div>
    <svg viewBox="0 0 1280 720" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} role="img" aria-label={`${scene.title}. ${beat.label}`}>
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill={mint}/></marker></defs>
      {scene.kind === 'recap' ? <>
        <rect x="130" y="200" width="440" height="280" rx="30" fill="#201b30" stroke={index!==1?amber:'#514968'} strokeWidth="3"/>
        <rect x="710" y="200" width="440" height="280" rx="30" fill="#182d2a" stroke={index>=1?mint:'#514968'} strokeWidth="3"/>
        <text x="350" y="245" textAnchor="middle" fill={amber} fontSize="32">Automation</text><text x="930" y="245" textAnchor="middle" fill={mint} fontSize="32">Artificial intelligence</text>
        <Node x={350} y={355} label="Rules written in advance" type="rule" active={index!==1}/><Node x={930} y={355} label="Patterns learned from data" type="model" active={index>=1}/>
      </> : compare ? <>
        <path d="M270 290 H950 M270 420 H950" stroke="#514968" strokeWidth="3" markerEnd="url(#arrow)"/>
        <Node x={210} y={345} label="Input" type="input" active />
        <Node x={590} y={265} label="Programmed rule" type="rule" active={index>=0}/>
        <Node x={590} y={425} label="Trained model" type="model" active={index>=1}/>
        <Node x={1050} y={345} label="Review the result" type="human" active={index>=2}/>
        <circle cx={280+progress*210} cy={index===0?290:420} r="10" fill={index===0?amber:mint}/>
      </> : scene.kind === 'pattern-model' ? <>
        {[0,1,2,3].map(n=><g key={n} opacity={index===0?1:.45}><rect x={130+n%2*100} y={215+Math.floor(n/2)*100} width="76" height="74" rx="10" fill="#27213a" stroke={accent}/><path d={`M${141+n%2*100} ${264+Math.floor(n/2)*100} l15 -16 l15 7 l15 -25`} fill="none" stroke={mint} strokeWidth="3"/></g>)}
        <path d="M340 320 H510 M730 320 H950" stroke={mint} strokeWidth="4" markerEnd="url(#arrow)"/>
        <Node x={620} y={320} label="Learned relationships" type="model" active={index>=1}/><Node x={1050} y={320} label="Estimate, not certainty" type="human" active={index>=2}/>
        <circle cx={350+progress*140} cy={320} r="10" fill={accent}/>
      </> : <>
        <path d="M300 335 H500 M730 335 H940" stroke={scene.kind==='exception'?amber:mint} strokeWidth="4" strokeDasharray={scene.kind==='exception'?'12 10':undefined} markerEnd="url(#arrow)"/>
        <Node x={200} y={335} label={scene.kind==='hybrid'?'Model suggestion':scene.kind==='exception'?'Changed input':'Sensor reading'} type={scene.kind==='hybrid'?'model':'input'} active/>
        <Node x={620} y={335} label={scene.kind==='exception'?'Exception handling':'Explicit rule'} type="rule" active={index>=1}/>
        <Node x={1050} y={335} label={scene.kind==='rule-flow'?'Configured action':'Human oversight'} type={scene.kind==='rule-flow'?'input':'human'} active={index>=2}/>
        {scene.kind==='exception' && index>=1 ? <g><path d="M600 200 L640 265 H560 Z" fill="none" stroke={amber} strokeWidth="4"/><text x="600" y="251" fill={amber} fontSize="30" textAnchor="middle">!</text></g> : <circle cx={index===0?310+progress*160:745+progress*160} cy={335} r="11" fill={mint}/>}
      </>}
    </svg>
    <div style={{ position:'absolute', top:505, left:80, right:80, display:'flex', justifyContent:'center', gap:14 }}>{scene.beats.map((b,i)=><span key={b.id} style={{ padding:'10px 17px', borderRadius:12, fontSize:21, border:`1px solid ${i===index?mint:'#49415c'}`, background:i===index?'#223b35':'#1b1729', opacity:i<=index?1:.45 }}>{b.label}</span>)}</div>
    {captions && <div data-caption={beat.id} style={{ position:'absolute', bottom:66, left:64, right:64, padding:'14px 20px', borderRadius:14, background:'#08070dda', color:ink, fontSize:25, lineHeight:1.35 }}>{beat.narration}</div>}
    <div style={{ position:'absolute', right:64, top:40, fontSize:15, color:muted }}>Source-linked creator preview</div>
  </AbsoluteFill>;
}
export function VisualLessonComposition({ scenes, style, captions, reducedMotion }: VisualPlaybackProps) {
  const { fps } = useVideoConfig();
  return <AbsoluteFill>
    {scenes.map(scene=><Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames} premountFor={fps} name={scene.title}>{style==='reference-cinema'?<ReferenceVisualScene scene={scene} captions={captions} reducedMotion={reducedMotion}/>:<Scene scene={scene} captions={captions} reducedMotion={reducedMotion}/>}</Sequence>)}
    {scenes.flatMap(s=>s.beats).filter(b=>b.audio).map(beat=><Sequence key={beat.id} from={beat.from} durationInFrames={beat.durationInFrames} premountFor={fps} name={`Narration: ${beat.label}`}><Html5Audio src={beat.audio!}/></Sequence>)}
  </AbsoluteFill>;
}
