'use client';

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import { FileText, MessageSquareWarning, CircleHelp, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Captions } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StageShell } from '../stage-shell';
import { hookSceneAt, hookScenes, type VideoHook } from '@/lib/video-first-hook';

type Props = { hook: VideoHook; audio?: string; fallbackAudioUrl: string; personalized?: boolean; preparing?: boolean; onInteract?: () => void; onPrev?: () => void; onComplete?: () => void; done?: boolean };
const clock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

/** HTML/CSS scenes share one continuous narration clock and pause for reflection. */
export function VideoFirstHook({ hook, audio, fallbackAudioUrl, personalized, preparing, onInteract, onPrev, onComplete, done }: Props) {
  const scenes = useMemo(() => hookScenes(hook), [hook]);
  const media = useRef<HTMLAudioElement>(null);
  const reducedMotion = useReducedMotionConfig();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [preparingAudio, setPreparingAudio] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [captions, setCaptions] = useState(true);
  const [hunch, setHunch] = useState('');
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const scene = scenes[index]!;
  const Icon = scene.kind === 'source' ? FileText : scene.kind === 'question' ? CircleHelp : MessageSquareWarning;
  const show = (next: number) => { setIndex(next); setSeen(s => new Set([...s, next])); };
  const seek = (next: number) => {
    onInteract?.();
    if (media.current && duration) media.current.currentTime = scenes[next].start * duration;
    show(next);
  };
  const play = async () => {
    onInteract?.(); setError('');
    if (playing) { media.current?.pause(); return; }
    if (!audio && !prepared) {
      setPreparingAudio(true);
      try {
        const response = await fetch(fallbackAudioUrl, { method: 'POST' });
        if (!response.ok) throw new Error();
        setPrepared(true);
      } catch { setError('Narration is unavailable. Retry, or use the scene arrows and transcript to continue.'); return; }
      finally { setPreparingAudio(false); }
    }
    const a = media.current;
    if (a) {
      if (a.error) a.load();
      if (a.ended) { a.currentTime = 0; show(0); }
      try { await a.play(); } catch { setError('Playback could not start. Try again or read the scenes.'); }
    }
  };
  return <StageShell stage="hook" title={hook.title} bloom="understand" onPrev={onPrev} onComplete={onComplete} done={done} canComplete={done || (seen.size === scenes.length && !!hunch.trim())} completeHint="Explore the scenes and write your initial thinking to continue.">
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">{personalized ? 'A problem shaped around your course profile.' : preparing ? 'Your personalised version is preparing. You can watch the original case now.' : 'Watch the case unfold, then decide what you would check.'}</p>
      <section aria-label="Problem hook video" className="overflow-hidden rounded-2xl border border-brand-line bg-panel shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-xs text-ink-muted"><span className="font-semibold uppercase tracking-widest text-brand-ink">The problem</span><span>Scene {index + 1} of {scenes.length}</span></div>
        <div className="relative flex min-h-80 items-center bg-gradient-to-br from-brand-soft via-panel to-panel-2 p-6 sm:min-h-96 sm:p-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={scene.id} initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reducedMotion ? 0 : .25 }} className="w-full space-y-5">
              <div className="flex items-center gap-3"><span className="rounded-xl border border-brand-line bg-brand-soft p-3 text-brand-ink"><Icon className="size-6" aria-hidden /></span><h2 className="text-lg font-semibold sm:text-xl">{scene.title}</h2></div>
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-ink sm:text-2xl sm:leading-relaxed">{scene.text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex gap-1 px-5 pt-4" aria-label="Scene navigation">{scenes.map((s, i) => <button key={s.id} onClick={() => seek(i)} aria-label={`Go to scene ${i + 1}: ${s.title}`} aria-current={index === i ? 'step' : undefined} className={`h-2 min-w-4 flex-1 rounded-full border border-brand-line focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${index === i ? 'bg-brand' : seen.has(i) ? 'bg-brand-soft' : 'bg-panel-2'}`} />)}</div>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Button onClick={() => void play()} disabled={preparingAudio} aria-label={playing ? 'Pause problem hook' : 'Play problem hook'}>{playing ? <Pause aria-hidden /> : <Play aria-hidden />}{preparingAudio ? 'Preparing narration…' : playing ? 'Pause' : 'Play'}</Button>
          <Button variant="ghost" size="icon" aria-label="Restart problem hook" onClick={() => { media.current?.pause(); seek(0); }}><RotateCcw /></Button>
          <span className="mr-auto text-xs tabular-nums text-ink-muted">{clock(elapsed)} / {duration ? clock(duration) : '—'}</span>
          <Button variant="ghost" size="icon" aria-label="Previous hook scene" disabled={index === 0} onClick={() => seek(index - 1)}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" aria-label="Next hook scene" disabled={index === scenes.length - 1} onClick={() => seek(index + 1)}><ChevronRight /></Button>
          <Button variant="ghost" size="icon" aria-label="Show narration captions" aria-pressed={captions} onClick={() => setCaptions(c => !c)}><Captions /></Button>
        </div>
        {captions && <p aria-label="Narration captions" className="border-t border-line bg-panel-2 px-5 py-3 text-sm leading-relaxed">{scene.text}</p>}
        <audio ref={media} src={audio ?? fallbackAudioUrl} preload="none" aria-label="Problem hook narration" onLoadedMetadata={e => setDuration(e.currentTarget.duration)} onPlay={() => { onInteract?.(); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); show(scenes.length - 1); }} onTimeUpdate={e => { const a = e.currentTarget; setElapsed(a.currentTime); if (a.duration) show(hookSceneAt(scenes, a.currentTime / a.duration)); }} onError={() => setError('Narration could not load. Retry playback or read the scenes.')} />
      </section>
      {error && <p role="alert" className="text-sm text-ink-muted">{error}</p>}
      <details><summary className="cursor-pointer text-sm font-medium">Read the full hook transcript</summary><div className="mt-3 space-y-3 text-sm leading-relaxed">{scenes.map(s => <p key={s.id}>{s.text}</p>)}</div></details>
      {index === scenes.length - 1 && <div className="space-y-3 rounded-xl border border-line bg-panel-2 p-5"><label htmlFor="hook-first-thought" className="block font-medium">Your initial thinking</label><p className="text-sm text-ink-muted">{hook.question}</p><Textarea id="hook-first-thought" value={hunch} onChange={e => { onInteract?.(); setHunch(e.target.value); }} rows={3} maxLength={6000} /><p className="text-xs text-ink-muted">This is a prediction, not a graded answer. Explore the concepts next.</p></div>}
    </div>
  </StageShell>;
}
