"use client";
import * as React from 'react';
import Link from 'next/link';
import {ArrowRight,Check,Settings2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Surface} from '@/components/kit/surface';
import {profileLines,questionById,type SetupAnswers} from '@/lib/setup';
import type {ProfileDerived} from '@/lib/profiling/derived';
import {QUICK_EXPERIENCE,quickEnrollmentAnswers} from '@/lib/quick-enrollment';

type Props={title:string;answers:SetupAnswers;derived?:ProfileDerived|null;editProfileHref:string;onStart:(answers:SetupAnswers)=>void;onOptions:(answers:SetupAnswers)=>void};
export function QuickEnrollment({title,answers,derived,editProfileHref,onStart,onOptions}:Props){
  const savedGoal=answers.courseInterview?.find(t=>t.slot==='goal')?.a??'';
  const savedExperience=answers.courseInterview?.find(t=>t.slot==='experience')?.a??'';
  const [goal,setGoal]=React.useState(answers.goal??(savedGoal?'custom':''));
  const [ownGoal,setOwnGoal]=React.useState(answers.goal?'':savedGoal);
  const [experience,setExperience]=React.useState(answers.experience==='regularly'?'sometimes':answers.experience??(savedExperience?'custom':''));
  const [ownExperience,setOwnExperience]=React.useState(answers.experience?'':savedExperience);
  const [starting,setStarting]=React.useState(false);
  const summary=profileLines(answers,derived).filter(line=>['domain','role','studyField','coding','style'].includes(line.id)&&line.answer);
  const goals=questionById('goal',answers,derived).options;
  const draft=()=>quickEnrollmentAnswers(answers,goal,ownGoal,experience,ownExperience);
  function start(skip=false){if(starting)return;setStarting(true);onStart(skip?quickEnrollmentAnswers(answers,'','','',''):draft());}
  return <div className="mx-auto grid max-w-3xl gap-6">
    <div><p className="text-sm font-medium text-brand-ink">A quick starting point</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 text-ink-muted">Two optional questions. Answer either, both, or skip straight to the course.</p></div>
    <Surface tone="accent" className="grid gap-3">
      <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">Using your saved profile</h2><Link className="text-sm text-brand-ink underline underline-offset-4" href={editProfileHref}>Edit profile</Link></div>
      {summary.length?<ul className="grid gap-2 text-sm sm:grid-cols-2">{summary.map(line=><li key={line.id} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden/><span><span className="text-ink-muted">{line.label}: </span>{line.answer}</span></li>)}</ul>:<p className="text-sm text-ink-muted">No extra profile details needed. We’ll use general examples to begin.</p>}
      <p className="text-sm text-ink-muted">Lessons use your field and learning preferences. Support adjusts as you practise. “Read the course” always keeps the original concepts and narration.</p>
    </Surface>
    <form className="grid gap-6" onSubmit={event=>{event.preventDefault();start();}}>
      <fieldset disabled={starting} className="grid gap-3"><legend className="mb-3 font-semibold">1. What do you want to achieve with this course? <span className="text-sm font-normal text-ink-muted">Optional</span></legend>
        <div className="grid gap-2 sm:grid-cols-2">{[...goals.map(o=>({value:o.v,label:o.label})),{value:'custom',label:'Write my own answer'},{value:'',label:'Skip this question'}].map(o=><label key={o.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft"><input type="radio" name="enrollment-goal" value={o.value} checked={goal===o.value} onChange={()=>setGoal(o.value)}/>{o.label}</label>)}</div>
        {goal==='custom'?<label className="grid gap-2 text-sm">Your course goal<textarea className="min-h-24 rounded-xl border border-line bg-panel p-3" maxLength={200} value={ownGoal} onChange={e=>setOwnGoal(e.target.value)} placeholder="For example, build an assistant for engineering document reviews"/></label>:null}
      </fieldset>
      <fieldset disabled={starting} className="grid gap-3"><legend className="mb-3 font-semibold">2. How familiar are you with AI agents? <span className="text-sm font-normal text-ink-muted">Optional</span></legend>
        <div className="grid gap-2 sm:grid-cols-2">{[...QUICK_EXPERIENCE,{value:'custom',label:'Write my own answer'},{value:'',label:'Skip this question'}].map(o=><label key={o.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft"><input type="radio" name="enrollment-experience" value={o.value} checked={experience===o.value} onChange={()=>setExperience(o.value)}/>{o.label}</label>)}</div>
        {experience==='custom'?<label className="grid gap-2 text-sm">Your experience with AI agents<textarea className="min-h-24 rounded-xl border border-line bg-panel p-3" maxLength={200} value={ownExperience} onChange={e=>setOwnExperience(e.target.value)} placeholder="Describe your experience in your own words"/></label>:null}
      </fieldset>
      <div className="flex flex-wrap gap-3"><Button type="submit" variant="brand" disabled={starting}>{starting?'Starting…':'Start learning'}<ArrowRight className="size-4"/></Button><Button type="button" variant="outline" disabled={starting} onClick={()=>start(true)}>Start with the standard course</Button></div>
      <p className="text-xs text-ink-muted">Skipping uses your saved profile with no extra course preferences. Your answers here won’t change your profile.</p>
      <Button type="button" variant="ghost" className="justify-self-start" disabled={starting} onClick={()=>onOptions(draft())}><Settings2 className="size-4"/>More setup options</Button>
    </form>
  </div>;
}
