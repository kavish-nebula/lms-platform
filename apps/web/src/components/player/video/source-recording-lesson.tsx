"use client";
import { useRef, useState } from 'react';
import type { ConceptVideo } from '@/data/types';
import { QuizOverlay } from './video-lesson';
import { useSignal } from '@/lib/signals';
/** Source media stays separate from personalised narration; it is never paired with rewritten text. */
export function SourceRecordingLesson({video,onComplete}:{video:ConceptVideo;onComplete?:()=>void}){
 const [endChecking,setEndChecking]=useState(false);const [checking,setChecking]=useState(false),[checked,setChecked]=useState(!video.midQuiz.length);const media=useRef<HTMLMediaElement|null>(null);const completed=useRef(false);const signal=useSignal();
 const source=video.sourceMedia;
 if(!source)return <p>This lesson has no source recording.</p>;
 const finish=()=>{if(!completed.current){completed.current=true;onComplete?.();}};
 const finishSource=()=>{if(video.endQuiz.length)setEndChecking(true);else finish();};
 const props={controls:true,preload:'metadata',onTimeUpdate:(e:React.SyntheticEvent<HTMLMediaElement>)=>{const a=e.currentTarget;if(!source.referenceOnly&&!checked&&Number.isFinite(a.duration)&&a.currentTime>=a.duration/2){a.pause();a.currentTime=a.duration/2;setChecking(true);}},onEnded:()=>{if(source.referenceOnly)return;if(checked&&!completed.current){finishSource();}else if(!checked)setChecking(true);}};
 return <section className="space-y-4" aria-label="Original source lesson"><SourceReviewNotes video={video}/><p className="text-sm text-ink-muted">Original source {source.video?'video':'narration'}. {source.referenceOnly&&'This is the full source reference; complete the personalised part for its knowledge check and progress.'} Personalised explanations are available in the other view.</p>
 {source.video?<video {...props} ref={a=>{media.current=a;}} src={source.video} className="w-full rounded-xl bg-panel-2" aria-label={video.title}/>:<><div className="rounded-xl border border-line bg-panel-2 p-6"><h2 className="text-xl font-semibold">{video.title}</h2>{source.image&&<img src={source.image} alt={`Source illustration for ${video.title}`} className="mx-auto max-h-80"/>}</div><audio {...props} ref={a=>{media.current=a;}} src={source.audio} className="w-full" aria-label="Original source narration"/></>}
 {checking&&<QuizOverlay questions={video.midQuiz} doneLabel="Continue source lesson" onDone={()=>{setChecked(true);setChecking(false);if(media.current?.ended){finishSource();}else void media.current?.play();}} onAnswer={(question,response)=>signal({kind:'video_check',moduleId:video.module,lesson:video.lesson,payload:{videoId:video.id,section:'mid',question,response}})}/>}
 {endChecking&&<QuizOverlay questions={video.endQuiz} doneLabel="Complete source lesson" onDone={()=>{setEndChecking(false);finish();}} onAnswer={(question,response)=>signal({kind:'video_check',moduleId:video.module,lesson:video.lesson,payload:{videoId:video.id,section:'end',question,response}})}/>}
 <details><summary>Read source transcript</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed">{checked?source.transcript:video.slides.slice(0,Math.ceil(video.slides.length/2)).map(s=>s.narration).join(' ')}</p></details></section>;
}

export function SourceReviewNotes({video}:{video:ConceptVideo}){return video.sourceMedia?.reviewNotes?.length?<aside aria-label="Course review guidance" className="rounded-xl border border-line bg-panel-2 p-4 text-sm leading-relaxed"><p className="font-semibold">Before you use this source lesson</p>{video.sourceMedia.reviewNotes.map((note,i)=><p key={i} className="mt-2">{note}</p>)}</aside>:null;}
