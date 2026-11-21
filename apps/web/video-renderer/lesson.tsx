import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import { DocumentScene } from './document-scene';
import { LanguageScene } from './language-scene';
import { RetrievalScene } from './retrieval-scene';
import { T } from './theme';
import type { LessonProps } from './types';
import contract from './contract.json';
import { AutomationScene } from './automation-scene';
import { MessageDemonstration } from './message-demonstration';
import { EvidenceDemonstration } from './evidence-demonstration';

export function Lesson({chapters,manim,title}: LessonProps) {
  const frame=useCurrentFrame(), {fps}=useVideoConfig(), time=frame/fps;
  const chapter = chapters.find((c,i)=>time<(chapters[i+1]?.cues[0]?.seconds ?? Infinity)) ?? chapters.at(-1);
  if(!chapter) return <AbsoluteFill style={{background:T.bg,color:T.text,justifyContent:'center',alignItems:'center',fontFamily:'Arial',fontSize:40}}>{title}</AbsoluteFill>;
  if(!contract.remotionKinds.includes(chapter.kind)) return <AbsoluteFill><OffthreadVideo src={manim} muted style={{width:'100%',height:'100%'}}/></AbsoluteFill>;
  const language=['token-stream','parameter-network','prompt-workspace'].includes(chapter.kind);
  const retrieval=['retrieval-map','knowledge-hub','data-boundary'].includes(chapter.kind);
  return <AbsoluteFill style={{background:`radial-gradient(ellipse at 55% 40%, ${T.spotlight} 0%, ${T.bg} 70%)`,color:T.text,fontFamily:'Arial'}}>
    <div style={{position:'absolute',inset:'40px 64px auto',fontSize:15,letterSpacing:3,color:T.mint}}>VISUAL EXPLAINER</div>
    <div data-video-label="true" style={{position:'absolute',left:64,right:64,top:88,fontSize:chapter.title.length>60?30:36,fontWeight:600,lineHeight:1.25}}>{chapter.title}</div>
    {['rule-router','intent-model','request-comparison','reviewed-workflow'].includes(chapter.kind) ? <MessageDemonstration chapter={chapter} time={time}/> : ['source-inspection','spreadsheet'].includes(chapter.kind)?<EvidenceDemonstration chapter={chapter} time={time}/>: ['method-comparison','rule-router','intent-model','request-comparison','reviewed-workflow','mechanism-recap','fixed-cooler','stopped-line','threshold-prediction'].includes(chapter.kind) ? <AutomationScene chapter={chapter} time={time}/> : chapter.kind==='decision' ? <div style={{position:'absolute',left:180,right:180,top:260,textAlign:'center',fontSize:34,lineHeight:1.5}}>{chapter.question ?? chapter.labels[0]}<div style={{marginTop:50,borderBottom:`2px dashed ${T.line}`,height:60}}/></div> : language ? <LanguageScene chapter={chapter} time={time}/> : retrieval ? <RetrievalScene chapter={chapter} time={time}/> : <DocumentScene chapter={chapter} time={time}/>}
    <div style={{position:'absolute',bottom:22,left:64,fontSize:14,color:T.muted}}>Conceptual illustration · follow the narrated evidence</div>
  </AbsoluteFill>;
}
