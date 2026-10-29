import type {SetupAnswers} from '@/lib/setup';

export const QUICK_EXPERIENCE = [
  {value:'never',label:'New to it'},
  {value:'little',label:'Know the basics'},
  {value:'sometimes',label:'Have built one'},
] as const;

/** Omitted answers stay unknown; enrollment must never invent experience or mastery. */
export function quickEnrollmentAnswers(existing:SetupAnswers, goal:string, ownGoal:string, experience:string, ownExperience:string, topic='AI agents'):SetupAnswers{
  const next:SetupAnswers={...existing,goal:goal&&goal!=='custom'?goal:null,experience:experience&&experience!=='custom'?experience:null};
  if(!existing.goal&&existing.courseInterview?.some(t=>t.slot==='goal'&&t.a===existing.expect))delete next.expect;
  const goalText=ownGoal.trim().slice(0,200), experienceText=ownExperience.trim().slice(0,200);
  const transcript=(existing.courseInterview??[]).filter(t=>t.slot!=='goal'&&t.slot!=='experience');
  if(goal==='custom'&&goalText){
    next.expect=goalText;
    transcript.push({slot:'goal',q:'What do you want to achieve with this course?',a:goalText});
  }else if(goal&&goal!=='custom'){transcript.push({slot:'goal',q:'What do you want to achieve with this course?',a:goal});}
  if(experience==='custom'&&experienceText)transcript.push({slot:'experience',q:`How familiar are you with ${topic}?`,a:experienceText});
  else if(experience&&experience!=='custom')transcript.push({slot:'experience',q:`How familiar are you with ${topic}?`,a:topic!=='AI agents'&&experience==='sometimes'?'Use it regularly':QUICK_EXPERIENCE.find(o=>o.value===experience)?.label??experience});
  next.courseInterview=transcript;
  return next;
}
