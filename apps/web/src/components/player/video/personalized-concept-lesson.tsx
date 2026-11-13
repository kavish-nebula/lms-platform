'use client';
import '../hook/hook-storyboard.css';
import './personalized-concept.css';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useReducedMotionConfig } from 'motion/react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Captions, Volume2, VolumeX, Maximize, Sparkles } from 'lucide-react';
import type { ConceptVideo } from '@/data/types';
import { api } from '@/lib/api';
import { useAdaptedModule } from '@/lib/adapted';
import { useSignal, useSignalScope } from '@/lib/signals';
import { useLearningContext } from '@/components/learning/course-companion';
import { useLocalJson, useHydrated, writeLocal } from '@/lib/local-store';
import { Button } from '@/components/ui/button';
import { conceptCanSeek, conceptNarration, type ConceptScene } from '@/lib/personalized-concept';
import { SourceRecordingLesson, SourceReviewNotes } from './source-recording-lesson';
import { UploadedVideoLesson } from './uploaded-video-lesson';
import { QuizOverlay } from './video-lesson';
import { PersonalizedConceptStory } from './personalized-concept-story';
import { ContinuousConceptPlayer } from './continuous-concept-player';
import { continuousConceptEnabled, type ContinuousPlayback } from '@/lib/continuous-concept';

type ReadyScene = ConceptScene & { audio: string };
type View = { id: string; status: string; scenes?: ReadyScene[]; playback?:ContinuousPlayback };
type Props = { video: ConceptVideo; onComplete?: () => void; onNext?: () => void; nextLabel?: string };
const fetcher = (url: string) => api<{ concept: View }>(url).then(r => r.concept);

export function PersonalizedConceptLesson(props: Props) {
  const { video } = props;
  const context = useLearningContext();
  const scope = useSignalScope();
  const capability = useAdaptedModule(context?.courseId ?? '', context?.moduleId ?? '', !!scope?.enabled);
  const hydrated = useHydrated();
  const enabled = hydrated && !!scope?.enabled && !!capability?.live;
  const [mode, setMode] = useState<'personalized' | 'original'>('personalized');
  const [retryError, setRetryError] = useState('');
  const url = `/api/v1/enrollments/${context?.courseId}/modules/${context?.moduleId}/concepts/${video.id}`;
  const { data, error, mutate } = useSWR(enabled && mode === 'personalized' ? url : null, fetcher, { refreshInterval: data => data?.status === 'ready' || data?.status === 'failed' ? 0 : 4000, revalidateOnFocus: true });
  // Hold a complete text/audio pair steady once it is ready. A new profile or
  // release takes effect when the learner next opens this topic.
  const [held, setHeld] = useState<View | undefined>();
  const playable = data?.status === 'ready' && (!continuousConceptEnabled(context?.courseId??'') || !!data.playback) ? data : undefined;
  if (!held && playable) setHeld(playable);
  const Original = video.uploadedVideo ? UploadedVideoLesson : SourceRecordingLesson;
  if (!enabled) return <Original {...props} />;
  const ready = held ?? playable;
  const failed = !!error || data?.status === 'failed';
  return <section className="space-y-4" aria-label={`Concept video: ${video.title}`}>
    {mode==='personalized'&&<SourceReviewNotes video={video}/>}
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Concept video version"><Button variant={mode === 'personalized' ? 'brand' : 'outline'} size="sm" aria-pressed={mode === 'personalized'} onClick={() => setMode('personalized')}><Sparkles aria-hidden />Personalised video</Button><Button variant={mode === 'original' ? 'brand' : 'outline'} size="sm" aria-pressed={mode === 'original'} onClick={() => setMode('original')}>{video.uploadedVideo || video.sourceMedia?.video ? 'Original recording' : 'Original lesson'}</Button></div>
    {mode === 'original' ? <Original {...props} /> : ready?.scenes ? (ready.playback ? <ContinuousConceptPlayer key={ready.id} {...props} revisionId={ready.id} scenes={ready.scenes} playback={ready.playback} /> : <PersonalizedConceptPlayer key={ready.id} {...props} revisionId={ready.id} scenes={ready.scenes} />) : <div className="space-y-4 rounded-xl border border-line bg-panel-2 p-6"><p role="status" className="font-medium">{failed ? 'Your personalised video could not be prepared.' : 'Preparing your personalised concept video and narration…'}</p><p className="text-sm leading-relaxed text-ink-muted">{failed ? 'You can retry or watch the source recording.' : 'The lesson keeps the reviewed concepts and knowledge check, with examples and explanations shaped around your profile. You can watch the original while it prepares.'}</p><div className="flex flex-wrap gap-2">{failed && <Button size="sm" onClick={async () => { setRetryError(''); try { await api(url, { method: 'POST' }); await mutate(); } catch { setRetryError('Retry could not start. Please try again.'); } }}>Retry personalised video</Button>}<Button size="sm" variant="outline" onClick={() => setMode('original')}>Watch original recording</Button></div></div>}
    {retryError && <p role="alert" className="text-sm text-ink-muted">{retryError}</p>}
  </section>;
}

type Resume = { version: 1; scene: number; checkpointDone: boolean; seen: number[] };
function PersonalizedConceptPlayer({ video, scenes, revisionId, onComplete, onNext, nextLabel }: Props & { scenes: ReadyScene[]; revisionId: string }) {
  const context = useLearningContext(); const signal = useSignal();
  const key = `lms-personalized-concept:v1:${context?.courseId}:${video.id}:${revisionId}`;
  const saved = useLocalJson<Resume | null>(key, null), hydrated = useHydrated();
  const [restored, setRestored] = useState(false);
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [elapsed, setElapsed] = useState(0), [duration, setDuration] = useState(0);
  const [checkpointDone, setCheckpointDone] = useState(!video.midQuiz.length), [checking, setChecking] = useState(false), [seen, setSeen] = useState<number[]>([]), [done, setDone] = useState(false);
  const [endChecking, setEndChecking] = useState(false);
  const [muted, setMuted] = useState(false), [captions, setCaptions] = useState(true), [rate, setRate] = useState(1), [message, setMessage] = useState('');
  const media = useRef<HTMLAudioElement>(null), screen = useRef<HTMLDivElement>(null), completed = useRef(false), quiz = useRef<HTMLDivElement>(null);
  const reducedMotion = !!useReducedMotionConfig();
  if (hydrated && !restored) {
    if (saved?.version === 1) { const passed = saved.checkpointDone || !video.midQuiz.length; setCheckpointDone(passed); setIndex(conceptCanSeek(scenes, saved.scene, passed) ? saved.scene : 0); setSeen(saved.seen.filter(i => Number.isInteger(i) && i >= 0 && i < scenes.length)); }
    setRestored(true);
  }
  useEffect(() => { if (restored) writeLocal(key, JSON.stringify({ version: 1, scene: index, checkpointDone, seen })); }, [restored, key, index, checkpointDone, seen]);
  const scene = scenes[index];
  useEffect(() => { if (playing && !checking) void media.current?.play().catch(() => { setPlaying(false); setMessage('Press play to continue narration.'); }); }, [scene.audio, playing, checking]);
  useEffect(() => { if (checking) quiz.current?.querySelector<HTMLElement>('input, button')?.focus(); }, [checking]);
  const select = (next: number) => { if (!conceptCanSeek(scenes, next, checkpointDone)) { setMessage('Complete the first half and its knowledge check before continuing.'); return; } setMessage(''); setPlaying(false); media.current?.pause(); setIndex(next); setElapsed(0); setDuration(0); };
  const ended = () => {
    const watched = [...new Set([...seen, index])]; setSeen(watched);
    if (watched.length === scenes.length && checkpointDone && !completed.current) { setPlaying(false); if(video.endQuiz.length){setEndChecking(true);return;} completed.current = true; setDone(true); onComplete?.(); return; }
    if (index === scenes.length - 1) { setPlaying(false); setMessage('Review any remaining scenes to complete this lesson.'); return; }
    if (!checkpointDone && scenes[index + 1].phase === 'after') { setPlaying(false); setChecking(true); return; }
    setElapsed(0); setDuration(0); setIndex(index + 1);
  };
  return <div className="space-y-4">
    <p className="text-sm text-ink-muted">Personalised teaching and narration from the reviewed concept video. The knowledge-check questions keep the course standard.</p>
    <div ref={screen} className="hook-film relative">
      <PersonalizedConceptStory scene={scene} seconds={elapsed} reducedMotion={reducedMotion} />
      <div className="hook-film-controls"><Button size="sm" variant="ghost" aria-label={playing ? 'Pause personalised concept' : 'Play personalised concept'} onClick={() => { setMessage(''); if (checking) return; if (playing) { setPlaying(false); media.current?.pause(); } else { if (media.current?.ended) media.current.currentTime = 0; setPlaying(true); } }}>{playing ? <Pause aria-hidden /> : <Play aria-hidden />}{playing ? 'Pause' : 'Play'}</Button><Button size="icon" variant="ghost" aria-label="Restart personalised concept" onClick={() => select(0)}><RotateCcw /></Button><span className="mr-auto text-xs tabular-nums text-ink-muted">Scene {index + 1}/{scenes.length} · {Math.floor(elapsed)}s / {duration ? `${Math.ceil(duration)}s` : '—'}</span><label><span className="sr-only">Concept playback speed</span><select aria-label="Concept playback speed" value={rate} onChange={e => { setRate(Number(e.target.value)); if (media.current) media.current.playbackRate = Number(e.target.value); }}>{[.75, 1, 1.25, 1.5].map(r => <option key={r} value={r}>{r}×</option>)}</select></label><Button size="icon" variant="ghost" disabled={index === 0} aria-label="Previous concept scene" onClick={() => select(index - 1)}><ChevronLeft /></Button><Button size="icon" variant="ghost" disabled={!conceptCanSeek(scenes, index + 1, checkpointDone)} aria-label="Next concept scene" onClick={() => select(index + 1)}><ChevronRight /></Button><Button size="icon" variant="ghost" aria-label="Mute concept narration" aria-pressed={muted} onClick={() => setMuted(v => !v)}>{muted ? <VolumeX /> : <Volume2 />}</Button><Button size="icon" variant="ghost" aria-label="Show concept captions" aria-pressed={captions} onClick={() => setCaptions(v => !v)}><Captions /></Button><Button size="icon" variant="ghost" aria-label="Concept fullscreen" onClick={() => { const action = document.fullscreenElement ? document.exitFullscreen() : screen.current?.requestFullscreen(); void action?.catch(() => setMessage('Fullscreen is unavailable in this browser.')); }}><Maximize /></Button></div>
      <label className="sr-only" htmlFor={`concept-seek-${video.id}`}>Seek within concept scene</label><input className="block w-full accent-[var(--ok)]" id={`concept-seek-${video.id}`} type="range" min={0} max={duration || 1} step={.1} value={Math.min(elapsed, duration || 1)} disabled={!duration || checking} onChange={e => { if (media.current) media.current.currentTime = Number(e.target.value); }} />
      {captions && <p className="hook-film-captions" aria-label="Concept narration captions">{conceptNarration(scene)}</p>}
      <audio ref={media} src={scene.audio} preload="metadata" muted={muted} onLoadedMetadata={e => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = rate; }} onTimeUpdate={e => setElapsed(e.currentTarget.currentTime)} onEnded={ended} onError={() => { setPlaying(false); setMessage('Narration could not load. Retry playback or choose the original recording.'); }} />
      {endChecking && <QuizOverlay questions={video.endQuiz} doneLabel="Complete source check" onDone={()=>{setEndChecking(false);completed.current=true;setDone(true);onComplete?.();}} onAnswer={(question,response)=>signal({kind:'video_check',moduleId:video.module,lesson:video.lesson,payload:{videoId:video.id,section:'end',question,response}})}/>}
      {checking && <div ref={quiz}><QuizOverlay questions={video.midQuiz} doneLabel="Continue personalised video" onDone={() => { setCheckpointDone(true); setChecking(false); setIndex(index + 1); setElapsed(0); setDuration(0); setPlaying(true); }} onAnswer={(question, response) => signal({ kind: 'video_check', moduleId: video.module, lesson: video.lesson, payload: { videoId: video.id, section: 'mid', question, response } })} /></div>}
    </div>
    {message && <p role="status" className="text-sm text-ink-muted">{message}</p>}
    <div className="personal-concept-chapters" aria-label="Personalised concept scenes">{scenes.map((s, i) => <button key={s.id} disabled={!conceptCanSeek(scenes, i, checkpointDone)} aria-current={index === i ? 'step' : undefined} onClick={() => select(i)}>{i + 1}. {s.title}</button>)}</div>
    <details><summary className="cursor-pointer text-sm font-medium">Read personalised transcript</summary><div className="mt-3 space-y-3 text-sm leading-relaxed">{scenes.filter(s => checkpointDone || s.phase === 'before').map(s => <p key={s.id}>{conceptNarration(s)}</p>)}</div></details>
    {done && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-4"><p role="status">Personalised concept complete.</p>{onNext && <Button onClick={onNext}>{nextLabel ?? 'Continue learning'}</Button>}</div>}
  </div>;
}
