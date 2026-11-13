'use client';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'motion/react';
import { Captions, Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { ConceptVideo } from '@/data/types';
import type { ConceptScene } from '@/lib/personalized-concept';
import { conceptNarration } from '@/lib/personalized-concept';
import { addPlayedRange, allConceptSectionsPlayed, allowedConceptTime, conceptClock, continuousSection, restoreContinuousResume, type ContinuousPlayback, type ContinuousResume, type PlayedRange } from '@/lib/continuous-concept';
import { useHydrated, useLocalJson, writeLocal } from '@/lib/local-store';
import { useLearningContext } from '@/components/learning/course-companion';
import { useSignal } from '@/lib/signals';
import { Button } from '@/components/ui/button';
import { PersonalizedConceptStory } from './personalized-concept-story';
import { QuizOverlay } from './video-lesson';

type Props = { video:ConceptVideo; scenes:ConceptScene[]; revisionId:string; playback:ContinuousPlayback; onComplete?:()=>void; onNext?:()=>void; nextLabel?:string };
export function ContinuousConceptPlayer({video,scenes,revisionId,playback,onComplete,onNext,nextLabel}:Props) {
  const context=useLearningContext(), signal=useSignal(), hydrated=useHydrated();
  const key=`lms-personalized-concept:v2:${context?.courseId}:${video.id}:${revisionId}`;
  const saved=useLocalJson<ContinuousResume|null>(key,null);
  const legacy=useLocalJson<unknown>(`lms-personalized-concept:v1:${context?.courseId}:${video.id}:${revisionId}`,null);
  const hasCheckpoint=!!video.midQuiz.length && playback.checkpointSeconds!==null;
  const [restored,setRestored]=useState(false), [seconds,setSeconds]=useState(0), [playing,setPlaying]=useState(false);
  const [checkpointDone,setCheckpointDone]=useState(!hasCheckpoint),[checking,setChecking]=useState(false),[endChecking,setEndChecking]=useState(false);
  const [ranges,setRanges]=useState<PlayedRange[]>([]),[done,setDone]=useState(false),[muted,setMuted]=useState(false),[captions,setCaptions]=useState(true),[rate,setRate]=useState(1),[message,setMessage]=useState('');
  const media=useRef<HTMLAudioElement>(null),screen=useRef<HTMLDivElement>(null),quiz=useRef<HTMLDivElement>(null);
  const position=useRef(0),coverage=useRef<PlayedRange[]>([]),lastTime=useRef<number|null>(null),completed=useRef(false),checkpoint=useRef(!hasCheckpoint);
  const reducedMotion=!!useReducedMotionConfig();
  if(hydrated&&!restored){
    const state=restoreContinuousResume(saved,legacy,playback,hasCheckpoint);
    setSeconds(state.seconds);setCheckpointDone(state.checkpointDone);
    setRanges(state.ranges);setDone(state.endCheckDone);setRestored(true);
  }
  useEffect(()=>{position.current=seconds;coverage.current=ranges;checkpoint.current=checkpointDone;completed.current=done;},[seconds,ranges,checkpointDone,done]);
  useEffect(()=>{if(restored)writeLocal(key,JSON.stringify({version:2,seconds,checkpointDone,ranges,endCheckDone:done} satisfies ContinuousResume));},[restored,key,seconds,checkpointDone,ranges,done]);
  useEffect(()=>{if(checking||endChecking)quiz.current?.querySelector<HTMLElement>('input, button')?.focus();},[checking,endChecking]);
  // Every section shares this audio element and clock; visual changes never
  // reload audio or reset playback. Seeking is not counted as listening.
  const updatePosition=(time:number)=>{position.current=time;setSeconds(time);};
  const pause=()=>{if(media.current)recordPlayed(media.current);media.current?.pause();setPlaying(false);lastTime.current=null;};
  const persist=()=>{if(restored)writeLocal(key,JSON.stringify({version:2,seconds:position.current,checkpointDone:checkpoint.current,ranges:coverage.current,endCheckDone:completed.current}));};
  useEffect(()=>{
    const save=()=>{if(restored)writeLocal(key,JSON.stringify({version:2,seconds:position.current,checkpointDone:checkpoint.current,ranges:coverage.current,endCheckDone:completed.current}));};
    window.addEventListener('pagehide',save);return()=>{save();window.removeEventListener('pagehide',save);};
  },[key,restored]);
  const openCheckpoint=()=>{pause();setChecking(true);};
  const seek=(requested:number)=>{
    const target=allowedConceptTime(playback,requested,checkpoint.current);
    lastTime.current=null;setMessage('');if(media.current)media.current.currentTime=target;updatePosition(target);
    if(hasCheckpoint&&!checkpoint.current&&target>=playback.checkpointSeconds!)openCheckpoint();
  };
  const play=async()=>{
    const audio=media.current;if(!audio||checking||endChecking)return;setMessage('');
    if(hasCheckpoint&&!checkpoint.current&&audio.currentTime>=playback.checkpointSeconds!){openCheckpoint();return;}
    if(audio.error)audio.load();if(audio.ended)seek(0);
    try{await audio.play();lastTime.current=audio.currentTime;setPlaying(true);}catch{setPlaying(false);setMessage('Press play to retry narration, or choose the original lesson.');}
  };
  const recordPlayed=(audio:HTMLAudioElement)=>{
    const target=allowedConceptTime(playback,audio.currentTime,checkpoint.current),previous=lastTime.current;
    if(!audio.seeking&&previous!==null&&target>previous&&target-previous<=2.5*audio.playbackRate){coverage.current=addPlayedRange(coverage.current,previous,target);setRanges(coverage.current);}
    lastTime.current=audio.seeking?null:target;updatePosition(target);
  };
  const track=(audio:HTMLAudioElement)=>{
    recordPlayed(audio);
    if(hasCheckpoint&&!checkpoint.current&&audio.currentTime>=playback.checkpointSeconds!){audio.currentTime=playback.checkpointSeconds!;openCheckpoint();}
  };
  const complete=()=>{if(!completed.current){completed.current=true;setDone(true);onComplete?.();}};
  const ended=()=>{
    pause();updatePosition(playback.durationSeconds);
    if(!checkpoint.current||!allConceptSectionsPlayed(playback,coverage.current)){setMessage('Some teaching was skipped. Replay the lesson to complete it.');return;}
    if(video.endQuiz.length&&!completed.current)setEndChecking(true);else complete();
  };
  const index=continuousSection(playback,Math.max(0,checking?seconds-.001:seconds)),scene=scenes[index];
  const localSeconds=Math.max(0,seconds-playback.segments[index].startSeconds);
  return <div className="space-y-4">
    <p className="text-sm text-ink-muted">One continuous personalised lesson. Visuals follow the narration; playback pauses for the knowledge check.</p>
    <div ref={screen} className="hook-film relative" aria-label="Continuous personalised lesson">
      <PersonalizedConceptStory scene={scene} seconds={localSeconds} reducedMotion={reducedMotion}/>
      <div className="hook-film-controls">
        <Button size="sm" variant="ghost" aria-label={playing?'Pause personalised lesson':'Play personalised lesson'} disabled={!restored||checking||endChecking} onClick={()=>playing?pause():void play()}>{playing?<Pause aria-hidden/>:<Play aria-hidden/>}{playing?'Pause':'Play'}</Button>
        <Button size="icon" variant="ghost" aria-label="Restart personalised lesson" disabled={checking||endChecking} onClick={()=>{pause();seek(0);}}><RotateCcw/></Button>
        <span className="mr-auto text-xs tabular-nums text-ink-muted" aria-label="Lesson playback time">{conceptClock(seconds)} / {conceptClock(playback.durationSeconds)}</span>
        <label><span className="sr-only">Lesson playback speed</span><select aria-label="Lesson playback speed" value={rate} onChange={e=>{const value=Number(e.target.value);setRate(value);if(media.current)media.current.playbackRate=value;}}>{[.75,1,1.25,1.5].map(r=><option key={r} value={r}>{r}×</option>)}</select></label>
        <Button size="icon" variant="ghost" aria-label="Mute lesson narration" aria-pressed={muted} onClick={()=>setMuted(v=>!v)}>{muted?<VolumeX/>:<Volume2/>}</Button>
        <Button size="icon" variant="ghost" aria-label="Show lesson captions" aria-pressed={captions} onClick={()=>setCaptions(v=>!v)}><Captions/></Button>
        <Button size="icon" variant="ghost" aria-label="Lesson fullscreen" onClick={()=>{const action=document.fullscreenElement?document.exitFullscreen():screen.current?.requestFullscreen();void action?.catch(()=>setMessage('Fullscreen is unavailable in this browser.'));}}><Maximize/></Button>
      </div>
      <label className="sr-only" htmlFor={`continuous-seek-${video.id}`}>Seek within personalised lesson</label>
      <input id={`continuous-seek-${video.id}`} className="block w-full accent-[var(--ok)]" type="range" min={0} max={playback.durationSeconds} step={.01} value={seconds} disabled={!restored||checking||endChecking} onChange={e=>seek(Number(e.target.value))}/>
      {captions&&<p className="hook-film-captions" aria-label="Lesson narration captions">{conceptNarration(scene)}</p>}
      <audio ref={media} src={playback.audio} preload="metadata" muted={muted} aria-label="Continuous personalised narration"
        onLoadedMetadata={e=>{e.currentTarget.playbackRate=rate;e.currentTarget.currentTime=seconds;}}
        onPlay={()=>{lastTime.current=media.current?.currentTime??null;setPlaying(true);}}
        onPause={e=>{recordPlayed(e.currentTarget);lastTime.current=null;setPlaying(false);persist();}}
        onSeeking={()=>{lastTime.current=null;}}
        onSeeked={e=>{const allowed=allowedConceptTime(playback,e.currentTarget.currentTime,checkpoint.current);if(e.currentTarget.currentTime>allowed+.001){e.currentTarget.currentTime=allowed;openCheckpoint();}else if(!e.currentTarget.paused)lastTime.current=allowed;updatePosition(allowed);}}
        onTimeUpdate={e=>track(e.currentTarget)} onEnded={ended}
        onError={()=>{pause();setMessage('Narration could not load. Retry playback or choose the original lesson.');}}/>
      {checking&&<div ref={quiz}><QuizOverlay questions={video.midQuiz} doneLabel="Continue personalised lesson" onDone={()=>{checkpoint.current=true;setCheckpointDone(true);setChecking(false);if(media.current){media.current.currentTime=playback.checkpointSeconds!;lastTime.current=playback.checkpointSeconds!;void media.current.play().catch(()=>setMessage('Press play to continue narration.'));}}} onAnswer={(question,response)=>signal({kind:'video_check',moduleId:video.module,lesson:video.lesson,payload:{videoId:video.id,section:'mid',question,response}})}/></div>}
      {endChecking&&<div ref={quiz}><QuizOverlay questions={video.endQuiz} doneLabel="Complete source check" onDone={()=>{setEndChecking(false);complete();}} onAnswer={(question,response)=>signal({kind:'video_check',moduleId:video.module,lesson:video.lesson,payload:{videoId:video.id,section:'end',question,response}})}/></div>}
    </div>
    {message&&<p role="status" className="text-sm text-ink-muted">{message}</p>}
    <details><summary className="cursor-pointer text-sm font-medium">Read personalised transcript</summary><div className="mt-3 space-y-3 text-sm leading-relaxed">{scenes.filter(s=>checkpointDone||s.phase==='before').map(s=><p key={s.id}>{conceptNarration(s)}</p>)}</div></details>
    {done&&<div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-4"><p role="status">Personalised lesson complete.</p>{onNext&&<Button onClick={onNext}>{nextLabel??'Continue learning'}</Button>}</div>}
  </div>;
}
