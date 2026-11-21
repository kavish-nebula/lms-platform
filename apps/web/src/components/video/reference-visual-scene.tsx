import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VisualTimedScene } from '@/lib/visual-lesson';

const color = { ink:'#fcf5f5', muted:'#c1b2b6', rose:'#eda3b7', mint:'#80d9bf', amber:'#f1cc8d', panel:'#191318', line:'#5a3945' };
type Beat = VisualTimedScene['beats'][number];
function Glyph({icon}: {icon: string}) {
  const paths: Record<string,string> = {
    document:'M7 3h10l4 4v20H7z M17 3v6h5 M10 14h8 M10 19h8 M10 24h5',
    message:'M3 5h26v18H13l-7 5v-5H3z M8 11h16 M8 16h12',
    check:'M5 17l7 7L28 7', question:'M10 9a6 6 0 0 1 12 0c0 6-6 5-6 11 M16 25v2',
    person:'M10 9a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M4 29v-3c0-12 24-12 24 0v3',
    model:'M5 6h22v21H5z M10 12h1 M21 12h1 M10 21h12 M11 1v5 M21 1v5',
    shield:'M16 2l12 5v10c0 8-12 13-12 13S4 25 4 17V7z M10 16l4 4 8-9',
    table:'M3 4h26v24H3z M3 12h26 M3 20h26 M12 4v24',
  };
  return <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={paths[icon]??paths.document}/></svg>;
}
function Artifact({beat,active,visible=true}: {beat:Beat;active:boolean;visible?:boolean}) {
  const visual = beat.visual ?? {heading:beat.label,detail:beat.label,icon:'document',status:'neutral'};
  const highlight = visual.status==='warning'?color.amber:visual.status==='success'?color.mint:color.rose;
  return <div data-artifact={beat.id} style={{opacity:visible?1:.16,border:`1px solid ${active?highlight:color.line}`,borderRadius:16,padding:24,background:color.panel,boxShadow:active?`0 0 32px ${highlight}16`:undefined,minHeight:145,color:highlight}}>
    <div style={{display:'flex',gap:16,alignItems:'center'}}><Glyph icon={visual.icon}/><strong style={{fontSize:25,lineHeight:1.2,color:color.ink}}>{visual.heading}</strong></div>
    <div style={{marginTop:18,fontSize:23,lineHeight:1.4,color:active?color.ink:color.muted}}>{visual.detail}</div>
  </div>;
}
/** The reference's visual vocabulary, filled with this lesson's evidence rather
 * than unrelated medical screenshots or the same fixed automation diagram. */
export function ReferenceVisualScene({scene,captions,reducedMotion}:{scene:VisualTimedScene;captions:boolean;reducedMotion:boolean}) {
  const local=useCurrentFrame(),{fps}=useVideoConfig(),frame=local+scene.from;
  let index=scene.beats.findIndex(b=>frame<b.from+b.durationInFrames);
  if(index<0)index=scene.beats.length-1;
  const beat=scene.beats[index];
  const enter=reducedMotion?1:interpolate(frame-beat.from,[0,2.4*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const list=scene.beats;
  const document=scene.kind==='document'||scene.kind==='exception';
  const workspace=scene.kind==='workspace'||scene.kind==='hybrid';
  const journey=scene.kind==='journey'||scene.kind==='rule-flow';
  const network=scene.kind==='network'||scene.kind==='pattern-model';
  return <AbsoluteFill data-reference-scene={scene.id} style={{background:'#0c090b',fontFamily:'Arial, sans-serif',color:color.ink}}>
    <Img src={staticFile('video-style/reference-ambient.jpg')} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:.5}}/>
    <AbsoluteFill style={{background:'radial-gradient(ellipse at 65% 40%, #802f4c45, transparent 75%)'}}/>
    <div style={{position:'absolute',top:30,left:60,fontSize:14,letterSpacing:3,color:color.rose}}>LEARNING IN FOCUS</div>
    <h1 style={{position:'absolute',top:56,left:60,right:60,fontSize:43,lineHeight:1.15,margin:0,letterSpacing:-1}}>{scene.title}</h1>
    <div style={{position:'absolute',top:156,left:60,right:60,bottom:154,opacity:Math.min(1,.6+enter*.4)}}>
      {document ? <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:36,height:'100%',alignItems:'center'}}>
        <div style={{background:'#f4eff0',color:'#24191e',borderRadius:12,padding:32,boxShadow:'0 24px 70px #0008',transform:`translateY(${(1-enter)*9}px)`}}>
          <div style={{fontSize:14,letterSpacing:3,borderBottom:'1px solid #bba8af',paddingBottom:15}}>SOURCE DOCUMENT · TRAINING EXAMPLE</div>
          {list.map((b,i)=><div key={b.id} style={{padding:'18px 10px',borderBottom:'1px solid #d5c7cd',borderLeft:i===index?'4px solid #a43d60':'4px solid transparent',background:i===index?'#e8ccd5':'transparent',fontSize:24,opacity:i<=index?1:.35}}>{b.visual?.detail??b.label}</div>)}
        </div>
        <div><div style={{color:color.rose,fontSize:15,letterSpacing:2,marginBottom:20}}>FOLLOW THE EVIDENCE</div><Artifact beat={beat} active/><div style={{marginTop:20,color:color.muted,fontSize:20}}>Read the highlighted line. Compare it with the explanation.</div></div>
      </div> : workspace ? <div style={{display:'grid',gridTemplateColumns:'155px 1fr 1fr',gap:24,height:'100%',border:`1px solid ${color.line}`,borderRadius:18,padding:24,background:'#100d11'}}>
        <div style={{borderRight:`1px solid ${color.line}`,fontSize:18,color:color.muted,paddingRight:18}}><strong style={{color:color.rose}}>Review workspace</strong>{['Source notes','Draft only','Review'].map((label,i)=><div key={label} style={{marginTop:36,color:i===Math.min(index,2)?color.ink:color.muted}}>{label}</div>)}</div>
        <div style={{display:'flex',flexDirection:'column',gap:14,justifyContent:'center'}}>{list.slice(0,2).map((b,i)=><Artifact key={b.id} beat={b} active={index===i} visible={i<=index}/>)}</div>
        <div style={{display:'flex',alignItems:'center',transform:`translateY(${(1-enter)*12}px)`}}><Artifact beat={beat} active/></div>
      </div> : journey ? <div style={{height:'100%',position:'relative'}}>
        <svg viewBox="0 0 1160 355" style={{position:'absolute',inset:0,width:'100%',height:'100%'}} aria-hidden><path d="M90 170 Q320 40 570 170 T1080 170" fill="none" stroke={color.line} strokeWidth="3"/><path d="M90 170 Q320 40 570 170 T1080 170" pathLength="1" fill="none" stroke={color.rose} strokeWidth="3" strokeDasharray="1" strokeDashoffset={1-(index+enter)/list.length}/></svg>
        <div style={{position:'absolute',inset:0,display:'flex',gap:22,alignItems:'center'}}>{list.map((b,i)=><div key={b.id} style={{flex:1,transform:`translateY(${i%2===0?-25:30}px)`}}><div style={{fontSize:14,letterSpacing:3,color:color.rose,marginBottom:12}}>0{i+1}</div><Artifact beat={b} active={index===i} visible={i<=index}/></div>)}</div>
      </div> : network ? <div style={{height:'100%',display:'grid',gridTemplateColumns:'1fr 220px 1fr',gap:30,alignItems:'center'}}>
        <div style={{display:'grid',gap:20}}>{list.slice(0,2).map((b,i)=><Artifact key={b.id} beat={b} active={index===i} visible={i<=index}/>)}</div>
        <div style={{textAlign:'center',border:`1px solid ${color.rose}`,borderRadius:'50%',height:210,display:'grid',placeContent:'center',boxShadow:`0 0 ${30+enter*25}px #c3628b40`}}><span style={{fontSize:50,color:color.rose}}>✦</span><span style={{fontSize:20,marginTop:12}}>Connect the evidence</span></div>
        <Artifact beat={beat} active/>
      </div> : <div style={{display:'grid',gridTemplateColumns:scene.kind==='comparison'?'1fr 1fr':`repeat(${Math.min(list.length,3)},1fr)`,gap:26,alignItems:'center',height:'100%'}}>
        {(scene.kind==='comparison'?[list[0],list[Math.max(1,index)]??list[0]]:list.slice(0,3)).map((b,i)=><div key={`${b.id}-${i}`} style={{transform:`translateY(${i===index?(1-enter)*12:0}px)`}}><div style={{fontSize:14,letterSpacing:2,color:color.rose,marginBottom:16}}>{scene.kind==='comparison'?(i===0?'SOURCE / BEFORE':'DRAFT / AFTER'):`STEP ${i+1}`}</div><Artifact beat={b} active={scene.kind==='comparison'?i===1:index===i} visible={scene.kind==='comparison'||i<=index}/></div>)}
      </div>}
    </div>
    {captions&&<div data-caption={beat.id} style={{position:'absolute',left:80,right:80,bottom:35,textAlign:'center',fontSize:24,lineHeight:1.38,background:'#0b080bd9',borderRadius:12,padding:'12px 20px'}}>{beat.narration}</div>}
    <div style={{position:'absolute',bottom:14,right:60,fontSize:11,color:color.muted}}>Fictional example · source-linked creator draft</div>
  </AbsoluteFill>;
}
