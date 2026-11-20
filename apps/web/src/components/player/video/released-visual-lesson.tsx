'use client';
import useSWR from 'swr';
import type {ConceptVideo} from '@/data/types';
import type {ConceptScene} from '@/lib/personalized-concept';
import type {ContinuousPlayback} from '@/lib/continuous-concept';
import {ContinuousConceptPlayer} from './continuous-concept-player';
type Video=Pick<ConceptVideo,'id'|'module'|'lesson'|'midQuiz'|'endQuiz'>;
export function ReleasedVisualLesson({endpoint,video,onComplete,onNext,nextLabel}:{endpoint:string;video:Video;onComplete?:()=>void;onNext?:()=>void;nextLabel?:string}){
 const {data,error}=useSWR<{revisionId:string;scenes:ConceptScene[];playback:ContinuousPlayback}>(endpoint,async (url:string)=>{const response=await fetch(url,{cache:'no-store'}),body=await response.json();if(!response.ok)throw Error(body.error?.message??'Could not load this released video.');return body;});
 if(error)return <p role="alert">{error.message}</p>;
 if(!data)return <p role="status">Loading the reviewed lesson video…</p>;
 return <ContinuousConceptPlayer key={data.revisionId} authored video={video} scenes={data.scenes} revisionId={data.revisionId} playback={data.playback} onComplete={onComplete} onNext={onNext} nextLabel={nextLabel}/>;
}
