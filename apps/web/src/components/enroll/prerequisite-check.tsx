'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/kit/surface';
import { PREREQUISITE_TOPICS, prerequisiteSelectionComplete, reviewPrerequisites, type PrerequisiteTopic, type PrerequisiteSelections, type PrerequisiteSuggestion } from '@/lib/course-prerequisites';

export function PrerequisiteCheck({ title, topics, suggestions, value, onChange, onContinue, alreadyEnrolled = false }: {
  title: string; topics: PrerequisiteTopic[]; suggestions: PrerequisiteSuggestion[];
  value: PrerequisiteSelections; onChange: (value: PrerequisiteSelections) => void; onContinue: () => void;
  alreadyEnrolled?: boolean;
}) {
  const [reviewed, setReviewed] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const results = reviewPrerequisites(topics, value);
  const needed = results.filter(r => r.needsIntroduction).map(r => r.topic);
  const relevant = suggestions.filter(s => s.topics.some(t => needed.includes(t)));
  const missing = needed.filter(t => !relevant.some(s => s.topics.includes(t)));
  function update(topic: PrerequisiteTopic, change: Partial<NonNullable<PrerequisiteSelections[PrerequisiteTopic]>>) {
    onChange({ ...value, [topic]: { ...value[topic], ...change } }); setReviewed(false);
  }
  return <div className="mx-auto grid max-w-3xl gap-6">
    <header><p className="text-sm font-medium text-brand-ink">{alreadyEnrolled?'Review your starting point':'Before you enroll'}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">A good starting point for {title}</h1><p className="mt-3 leading-relaxed text-ink-muted">A little familiarity with these ideas will help. Tell us what you have learned, then try a short concept check if you know the topic. This is guidance, not a graded test.</p>{alreadyEnrolled&&<p className="mt-3 text-sm text-brand-ink">You’re already enrolled. This review does not save answers or change your enrollment, profile or progress.</p>}</header>
    <form className="grid gap-5" onSubmit={e => { e.preventDefault(); setReviewed(true); requestAnimationFrame(() => resultHeading.current?.focus()); }}>
      {topics.map(topic => { const item = PREREQUISITE_TOPICS[topic], selection = value[topic]; return <Surface key={topic} className="grid gap-4">
        <div><h2 className="text-lg font-semibold">{item.title}</h2><p className="mt-1 text-sm text-ink-muted">{item.why}</p></div>
        <fieldset className="grid gap-2"><legend className="mb-2 font-medium">Have you learned about {item.title}?</legend>
          {([{ value:'familiar', label:'Yes, I know the basics' },{ value:'new', label:'No, I need an introduction' },{ value:'unsure', label:'I’m not sure yet' }] as const).map(option => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft"><input type="radio" name={`prerequisite-${topic}`} value={option.value} checked={selection?.familiarity===option.value} onChange={()=>update(topic,{familiarity:option.value,response:undefined})}/>{option.label}</label>)}
        </fieldset>
        {selection?.familiarity==='familiar' && <fieldset className="grid gap-2 border-t border-line pt-4"><legend className="mb-2 pt-4 font-medium">Quick concept check: {item.question}</legend>{item.choices.map(option => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft"><input type="radio" name={`prerequisite-check-${topic}`} value={option.id} checked={selection.response===option.id} onChange={()=>update(topic,{response:option.id})}/>{option.text}</label>)}</fieldset>}
      </Surface>; })}
      <Button type="submit" variant="brand" className="justify-self-start" disabled={!prerequisiteSelectionComplete(topics,value)}>Check my starting point<ArrowRight className="size-4"/></Button>
    </form>
    {reviewed && <section className="grid gap-5" aria-labelledby="prerequisite-result">
      <Surface tone="accent" className="grid gap-3"><h2 ref={resultHeading} tabIndex={-1} id="prerequisite-result" className="text-xl font-semibold">{needed.length?'Build these foundations first':'You have a useful starting point'}</h2>
        <p className="text-sm leading-relaxed">{needed.length?'These introductions can make the course easier to follow.':'Your responses support familiarity with these introductory ideas. This short check does not certify mastery.'} {alreadyEnrolled?'Your existing enrollment and progress are unchanged.':'You have not been enrolled yet.'}</p>
        <ul className="grid gap-3 text-sm">{results.map(result => <li key={result.topic}><span className="font-semibold">{PREREQUISITE_TOPICS[result.topic].title}: </span>{result.needsIntroduction?'Introduction recommended.':'Concept check supported.'} {result.observed!=='not-taken' && PREREQUISITE_TOPICS[result.topic].explanation}</li>)}</ul>
      </Surface>
      {relevant.length>0 && <div className="grid gap-3"><h3 className="font-semibold">Suggested learning before this course</h3>{relevant.map(s => <Surface key={`${s.courseId}:${s.moduleTitle??''}`} className="grid gap-2"><div className="flex items-center gap-2 font-semibold"><BookOpen className="size-5 shrink-0" aria-hidden/>{s.moduleTitle ? `${s.moduleTitle} · ${s.title}` : s.title}</div><p className="text-sm text-ink-muted">Introduces {s.topics.filter(t=>needed.includes(t)).map(t=>PREREQUISITE_TOPICS[t].title).join(' and ')}. Review this foundation, then return here to check your starting point.</p><Link href={s.href} className="justify-self-start text-sm font-medium text-brand-ink underline underline-offset-4">{s.moduleTitle?'Read the introductory module':'View foundation course'}<span className="sr-only">: {s.title}</span></Link></Surface>)}</div>}
      {missing.length>0 && <p className="text-sm text-ink-muted">No matching published introduction is currently listed for {missing.map(t=>PREREQUISITE_TOPICS[t].title).join(' and ')}. You can read the short introductions below.</p>}
      {needed.map(topic=><details key={topic} className="rounded-xl border border-line bg-panel p-4"><summary className="cursor-pointer font-medium">A short introduction to {PREREQUISITE_TOPICS[topic].title}</summary><p className="mt-3 text-sm leading-relaxed">{PREREQUISITE_TOPICS[topic].introduction}</p></details>)}
      <div className="flex flex-wrap items-center gap-3"><Button variant={needed.length?'outline':'brand'} onClick={onContinue}>{alreadyEnrolled?'Back to course':needed.length?'Continue with this course anyway':'Continue to course setup'}{needed.length?<ArrowRight className="size-4"/>:<CheckCircle2 className="size-4"/>}</Button><p className="text-xs text-ink-muted">{alreadyEnrolled?'Your answers here are for this review only.':'This continues setup. Enrollment happens when you choose Start learning.'}</p></div>
    </section>}
  </div>;
}
