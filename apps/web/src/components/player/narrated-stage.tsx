"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type Scene = { id: string; title: string; body: string[]; narration: string; audio: string };
/** Released scenes retain their original text and narration; navigation marks the existing stage complete. */
export function NarratedStage({ title, courseHref, slides, onComplete, onPrev }: { title: string; courseHref: string; slides: Scene[]; onComplete: () => void; onPrev?: () => void }) {
  const [index, setIndex] = useState(0);
  const scene = slides[index]!;
  return <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 page-pad py-8">
    <Link href={courseHref} className="text-sm text-brand-ink underline">Back to course</Link>
    <header><p className="text-sm text-ink-muted">{title} · Scene {index + 1} of {slides.length}</p><h1 className="mt-2 text-3xl font-semibold">{scene.title}</h1></header>
    <section className="space-y-4 rounded-xl border border-line bg-panel p-6" aria-label="Scene content"><ul className="list-disc space-y-3 pl-5">{scene.body.map((line,i)=><li key={i}>{line}</li>)}</ul>
      <audio key={scene.id} controls preload="metadata" className="w-full" src={scene.audio} aria-label={`Narration for ${scene.title}`} />
      <details><summary className="cursor-pointer font-medium">Read narration</summary><p className="mt-3 whitespace-pre-wrap">{scene.narration}</p></details>
    </section>
    <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={index===0 && !onPrev} onClick={()=>index ? setIndex(index-1) : onPrev?.()}>Previous</Button>{index < slides.length-1 ? <Button onClick={()=>setIndex(index+1)}>Next scene</Button> : <Button onClick={onComplete}>Complete and continue</Button>}</div>
  </main>;
}
