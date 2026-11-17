'use client';
import { useEffect, useRef, useState } from 'react';
import type { ConceptVideo } from '@/data/types';
import { Button } from '@/components/ui/button';
import { useSignal } from '@/lib/signals';
import { QuizOverlay } from './video-lesson';
import { SourceReviewNotes } from './source-recording-lesson';

export function UploadedVideoLesson({ video, onComplete, onNext, nextLabel }: { video: ConceptVideo; onComplete?: () => void; onNext?: () => void; nextLabel?: string }) {
  const source = video.uploadedVideo!; const media = useRef<HTMLVideoElement>(null); const signal = useSignal();
  const [checking, setChecking] = useState(false); const [passed, setPassed] = useState(!video.midQuiz.length); const [done, setDone] = useState(false); const [error, setError] = useState('');
  const completed = useRef(false);
  const player = useRef<HTMLDivElement>(null);
  useEffect(() => { if (checking) player.current?.querySelector<HTMLElement>('[role="dialog"] input, [role="dialog"] button')?.focus(); }, [checking]);
  const checkpoint = () => { media.current?.pause(); if (document.fullscreenElement === media.current) void document.exitFullscreen().catch(() => undefined); setChecking(true); };
  const guard = () => {
    if (!media.current || passed || media.current.currentTime < source.checkpointSeconds) return;
    if (media.current.currentTime > source.checkpointSeconds + 0.01) media.current.currentTime = source.checkpointSeconds;
    checkpoint();
  };
  return <section className="space-y-4" aria-label={`Concept video: ${video.title}`}>
    <SourceReviewNotes video={video} />
    <p className="text-sm text-ink-muted">Watch the original teaching video. It pauses for two knowledge-check questions near the midpoint. Use the video controls for captions, playback speed and full screen.</p>
    <div ref={player} className="relative overflow-hidden rounded-xl border border-line bg-panel">
      <video ref={media} controls playsInline preload="metadata" className="aspect-video w-full bg-black" aria-label={video.title} src={source.src}
        onTimeUpdate={guard} onSeeking={guard} onPlay={() => { if (checking) media.current?.pause(); }} onError={() => setError('The video could not be loaded. Check your connection and reload this lesson.')}
        onEnded={() => { if (!passed) { checkpoint(); return; } setDone(true); if (!completed.current) { completed.current = true; onComplete?.(); } }}>
        <track kind="captions" src={source.transcriptUrl} srcLang="en" label="Reviewed transcript" />
      </video>
      {checking && <QuizOverlay questions={video.midQuiz} doneLabel="Continue video" onDone={() => { setPassed(true); setChecking(false); if (media.current) { media.current.currentTime = source.checkpointSeconds + 0.05; void media.current.play().catch(() => setError('Press play to continue the video.')); } }} onAnswer={(question, response) => signal({ kind: 'video_check', moduleId: video.module, lesson: video.lesson, payload: { videoId: video.id, section: 'mid', question, response } })} />}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {done && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-4"><p role="status">Video complete.</p>{onNext && <Button onClick={onNext}>{nextLabel ?? 'Continue learning'}</Button>}<Button variant="outline" onClick={() => { setDone(false); if (media.current) { media.current.currentTime = 0; void media.current.play(); } }}>Replay video</Button></div>}
    <details className="rounded-lg border border-line bg-panel p-4"><summary className="cursor-pointer font-medium">Read reviewed transcript</summary><div className="mt-3 space-y-3 text-sm leading-relaxed">{video.slides.map((slide, i) => <p key={i}>{slide.narration}</p>)}</div></details>
  </section>;
}
