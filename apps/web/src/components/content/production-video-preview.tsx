"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { VideoSlideView } from '@/components/player/video/video-slide';
import { productionPreview, type ModulePackage } from '@/lib/module-production';
import { narrationDurationValid, crossesVideoCheckpoint } from '@/lib/longform-production';
import type { ProductionAudioClip } from '@/lib/production-audio';
import { VideoMidpointCheck } from './video-midpoint-check';
import '@/components/player/video/video.css';

/** Creator-only playback; it never records learner progress or publishes assets. */
export function ProductionVideoPreview({ content, clips, audioUrl, ready, disabled }: { content: ModulePackage; clips: ProductionAudioClip[]; audioUrl: string; ready: boolean; disabled: boolean }) {
  const [index, setIndex] = useState(0); const [continuous, setContinuous] = useState(false); const [error, setError] = useState('');
  const [quizOpen, setQuizOpen] = useState(false); const [quizDone, setQuizDone] = useState(false);
  const checkpoint = content.checkpoint;
  const boundary = checkpoint ? content.slides.findIndex(s => s.id === checkpoint.afterSlideId) : -1;
  const audio = useRef<HTMLAudioElement>(null); const action = useRef(0);
  const slide = content.slides[index]; const clip = clips.find(c => c.slideId === slide.id);
  const src = `${audioUrl}&slideId=${encodeURIComponent(slide.id)}`;
  useEffect(() => { const current = audio.current; return () => { current?.pause(); }; }, [index, clip?.key]);
  function stop() { action.current++; setContinuous(false); audio.current?.pause(); }
  function openQuiz() { stop(); setQuizOpen(true); }
  function select(next: number) { stop(); setError(''); if (crossesVideoCheckpoint(index, next, boundary, quizDone)) { setIndex(boundary); setQuizOpen(true); } else setIndex(next); }
  function ended() { if (crossesVideoCheckpoint(index, index + 1, boundary, quizDone)) openQuiz(); else if (continuous && index < content.slides.length - 1) setIndex(index + 1); else setContinuous(false); }
  function play() {
    if (!audio.current || quizOpen || disabled || !ready || !clips.every(c => narrationDurationValid(c.seconds))) return;
    const request = ++action.current; setError(''); setContinuous(true);
    void audio.current.play().catch(() => { if (request === action.current) { setContinuous(false); setError('Playback could not start. Use the audio controls to retry.'); } });
  }
  return <section className="space-y-4 border-t border-line pt-5" aria-label="Narrated video preview">
    <h3 className="text-lg font-semibold">{content.title}</h3>
    <p className="text-sm text-ink-muted">Creator preview · Slide {index + 1} of {content.slides.length}. Play video continues through the matching saved clips. Reviewing here does not award progress or publish the course.</p>
    <div className="vl-stage w-full" aria-label={`Narrated slide preview: ${slide.title}`}><VideoSlideView slide={productionPreview(slide)} shown={() => true} /></div>
    <div className="flex flex-wrap gap-3"><Button disabled={quizOpen || disabled || !ready || !clip || !clips.every(c => narrationDurationValid(c.seconds))} onClick={play}>Play video</Button><Button variant="outline" disabled={!continuous} onClick={stop}>Pause video</Button><Button variant="outline" disabled={quizOpen || index === 0} onClick={() => select(index - 1)}>Previous narrated slide</Button><Button variant="outline" disabled={quizOpen || index === content.slides.length - 1} onClick={() => select(index + 1)}>Next narrated slide</Button></div>
    {checkpoint && <div className="space-y-2 text-sm"><p>Two-question checkpoint after slide {boundary + 1}. Formative creator preview; no learner grade is recorded.</p><Button variant="outline" disabled={disabled || quizOpen} onClick={openQuiz}>Preview mid-video quiz</Button></div>}
    {quizOpen && checkpoint && <VideoMidpointCheck questions={checkpoint.questions} onContinue={() => { setQuizDone(true); setQuizOpen(false); setIndex(boundary + 1); setContinuous(ready && !disabled); }} />}
    {!ready && <p className="text-sm text-ink-muted">Continuous playback requires the complete current approved video audio. Individual completed clips remain available below.</p>}
    <label className="block text-sm font-medium" htmlFor="narrated-video-slide">Narration slide</label><select id="narrated-video-slide" disabled={quizOpen} className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={index} onChange={e => select(Number(e.target.value))}>{content.slides.map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.title}</option>)}</select>
    <p role="status" className="text-sm">{slide.title} · {clip ? `${Math.floor(Math.round(clip.seconds) / 60)}:${String(Math.round(clip.seconds) % 60).padStart(2, '0')} measured narration${narrationDurationValid(clip.seconds) ? ' · Meets 5–7 minute range' : ' · Outside 5–7 minute range'}` : 'Awaiting audio'}</p>
    {clip && !disabled && !quizOpen ? <><audio ref={audio} key={clip.key} className="w-full" controls preload="none" autoPlay={continuous} aria-label={`Narration for ${slide.title}`} src={src} onEnded={ended} onError={() => { setContinuous(false); setError('This clip could not be loaded. Refresh audio status and retry.'); }} /><a className="text-sm text-brand-ink underline" download={`slide-${slide.id}.wav`} href={src}>Download this narration clip</a></> : <p className="text-sm text-ink-muted">{quizOpen ? 'Narration paused for the knowledge check.' : disabled ? 'Save your changes before previewing audio.' : 'This slide’s narration is not ready yet.'}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <details><summary className="cursor-pointer text-sm font-medium">Matching narration script</summary><p className="mt-3 whitespace-pre-wrap text-sm">{slide.narration}</p></details>
  </section>;
}
