'use client';
import './hook-storyboard.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'motion/react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Captions, Maximize, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StageShell } from '../stage-shell';
import { hookSceneAt, hookScenes, type VideoHook } from '@/lib/video-first-hook';
import { HookStoryboard } from './hook-storyboard';

type Props = { hook: VideoHook; audio?: string; sceneAudio?: string[]; fallbackAudioUrl: string; personalized?: boolean; preparing?: boolean; onInteract?: () => void; onPrev?: () => void; onComplete?: () => void; done?: boolean };
const clock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

/** Scene clips are the clock: the next illustration starts at actual audio end. */
export function VideoFirstHook({ hook, audio, sceneAudio, fallbackAudioUrl, personalized, preparing, onInteract, onPrev, onComplete, done }: Props) {
  const scenes = useMemo(() => hookScenes(hook), [hook]);
  const media = useRef<HTMLAudioElement>(null);
  const screen = useRef<HTMLElement>(null);
  const reducedMotion = !!useReducedMotionConfig();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [preparingAudio, setPreparingAudio] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [captions, setCaptions] = useState(true);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [hunch, setHunch] = useState('');
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const segmented = sceneAudio?.length === scenes.length || !audio;
  const src = segmented ? sceneAudio?.[index] ?? `${fallbackAudioUrl}?scene=${index}` : audio;
  const scene = scenes[index]!;
  const show = (next: number) => { setIndex(next); setSeen(s => new Set([...s, next])); };

  // Resume a changed clip only after the learner has started playback.
  useEffect(() => {
    const a = media.current;
    if (playing && a) void a.play().catch(() => { setPlaying(false); setError('Press play to continue narration, or read the scene.'); });
  }, [src, playing]);

  const seekScene = (next: number) => {
    onInteract?.(); setPlaying(false); media.current?.pause();
    if (!segmented && media.current && duration) media.current.currentTime = scenes[next].start * duration;
    else { setElapsed(0); setDuration(0); if (media.current) media.current.currentTime = 0; }
    show(next);
  };
  const play = async () => {
    onInteract?.(); setError('');
    if (playing) { setPlaying(false); media.current?.pause(); return; }
    if (!audio && !prepared) {
      setPreparingAudio(true);
      try {
        if (!(await fetch(fallbackAudioUrl, { method: 'POST' })).ok) throw new Error();
        setPrepared(true);
      } catch { setError('Narration is unavailable. Retry, or explore the scenes and transcript.'); return; }
      finally { setPreparingAudio(false); }
    }
    const a = media.current;
    if (!a) return;
    if (a.error) a.load();
    if (a.ended) a.currentTime = 0;
    try { await a.play(); setPlaying(true); } catch { setError('Playback could not start. Try again or read the scenes.'); }
  };

  return <StageShell stage="hook" title={hook.title} bloom="understand" onPrev={onPrev} onComplete={onComplete} done={done} canComplete={done || (seen.size === scenes.length && !!hunch.trim())} completeHint="Watch the case and write your initial thinking to continue.">
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">{personalized ? 'Your personalised case study' : preparing ? 'Your personalised case is preparing. You can watch the original now.' : 'Watch the case, inspect the evidence, then make your prediction.'}</p>
      <section ref={screen} aria-label="Problem hook video" className="hook-film">
        <HookStoryboard scenes={scenes} index={index} seconds={elapsed} reducedMotion={reducedMotion} />
        <div className="hook-film-progress" aria-label="Scene navigation">{scenes.map((s, i) => <button key={s.id} onClick={() => seekScene(i)} aria-label={`Go to scene ${i + 1}: ${s.title}`} aria-current={index === i ? 'step' : undefined} data-seen={i !== index && seen.has(i) ? 'true' : undefined} />)}</div>
        <div className="hook-film-controls">
          <Button size="sm" variant="ghost" onClick={() => void play()} disabled={preparingAudio} aria-label={playing ? 'Pause problem hook' : 'Play problem hook'}>{playing ? <Pause aria-hidden /> : <Play aria-hidden />}{preparingAudio ? 'Preparing voice…' : playing ? 'Pause' : 'Play'}</Button>
          <Button size="icon" variant="ghost" aria-label="Restart problem hook" onClick={() => seekScene(0)}><RotateCcw /></Button>
          <span className="mr-auto text-xs tabular-nums text-ink-muted">Scene {index + 1}/{scenes.length} · {clock(elapsed)} / {duration ? clock(duration) : '—'}</span>
          <label><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={rate} onChange={e => { const value = Number(e.target.value); setRate(value); if (media.current) media.current.playbackRate = value; }}>{[.75, 1, 1.25, 1.5].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
          <Button variant="ghost" size="icon" aria-label="Previous hook scene" disabled={index === 0} onClick={() => seekScene(index - 1)}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" aria-label="Next hook scene" disabled={index === scenes.length - 1} onClick={() => seekScene(index + 1)}><ChevronRight /></Button>
          <Button variant="ghost" size="icon" aria-label={muted ? 'Unmute hook' : 'Mute hook'} aria-pressed={muted} onClick={() => setMuted(m => !m)}>{muted ? <VolumeX /> : <Volume2 />}</Button>
          <Button variant="ghost" size="icon" aria-label="Show narration captions" aria-pressed={captions} onClick={() => setCaptions(c => !c)}><Captions /></Button>
          <Button variant="ghost" size="icon" aria-label="Toggle hook fullscreen" onClick={() => { const task = document.fullscreenElement ? document.exitFullscreen() : screen.current?.requestFullscreen(); void task?.catch(() => setError('Fullscreen is unavailable in this browser.')); }}><Maximize /></Button>
        </div>
        <label className="sr-only" htmlFor="hook-playback-position">Seek within current scene</label><input id="hook-playback-position" className="block w-full accent-[var(--ok)]" type="range" min={0} max={duration || 1} step={.1} value={Math.min(elapsed, duration || 1)} disabled={!duration} onChange={e => { onInteract?.(); if (media.current) media.current.currentTime = Number(e.target.value); }} />
        {captions && <p aria-label="Narration captions" className="hook-film-captions">{scene.text}</p>}
        <audio ref={media} src={src} preload="none" muted={muted} aria-label="Problem hook narration" onLoadedMetadata={e => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = rate; }} onEnded={() => {
          if (segmented && index < scenes.length - 1) { setElapsed(0); setDuration(0); show(index + 1); }
          else { setPlaying(false); show(scenes.length - 1); }
        }} onTimeUpdate={e => { const a = e.currentTarget; setElapsed(a.currentTime); if (!segmented && a.duration) show(hookSceneAt(scenes, a.currentTime / a.duration)); }} onError={() => { setPlaying(false); setError('Narration could not load. Retry or read the scene.'); }} />
      </section>
      {error && <p role="alert" className="text-sm text-ink-muted">{error}</p>}
      <details><summary className="cursor-pointer text-sm font-medium">Read the full hook transcript</summary><div className="mt-3 space-y-3 text-sm leading-relaxed">{scenes.map(s => <p key={s.id}>{s.text}</p>)}</div></details>
      {index === scenes.length - 1 && <div className="space-y-3 rounded-xl border border-line bg-panel-2 p-5"><label htmlFor="hook-first-thought" className="block font-medium">Your initial thinking</label><p className="text-sm text-ink-muted">{hook.question}</p><Textarea id="hook-first-thought" value={hunch} onChange={e => { onInteract?.(); setHunch(e.target.value); }} rows={3} maxLength={6000} /><p className="text-xs text-ink-muted">This prediction is ungraded. Explore the concepts next.</p></div>}
    </div>
  </StageShell>;
}
