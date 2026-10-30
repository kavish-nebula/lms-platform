"use client";
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ProductionJob, ProductionRevision } from '@/lib/module-production';
import type { ProductionAudioState } from '@/lib/production-audio';
import { ProductionLessonPreview } from './production-lesson-preview';
import { ProductionVideoPreview } from './production-video-preview';

export function ProductionAudio({ job, revision, endpoint, disabled }: { job: ProductionJob; revision: ProductionRevision; endpoint: string; disabled: boolean }) {
  const [state, setState] = useState<ProductionAudioState | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(''); const [slideId, setSlideId] = useState(revision.content.slides[0].id);
  const review = job.reviews.find(r => r.revisionId === revision.id);
  const url = `${endpoint}/audio`;
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${url}?jobId=${job.id}`, { cache: 'no-store', signal });
    const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Could not load audio.');
    setState(result); setError('');
  }, [url, job.id]);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Audio is unavailable.'); }); return () => controller.abort(); }, [load, revision.id, review?.id]);
  const running = state?.jobs.some(j => j.status === 'running');
  useEffect(() => {
    if (!running) return;
    const controller = new AbortController(); const timer = setInterval(() => { void load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not refresh audio.'); }); }, 4000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [running, load]);
  const current = state?.jobs.find(j => j.current);
  const chosen = state?.jobs.find(j => j.id === selected && j.revisionId === revision.id) ?? state?.jobs.find(j => j.revisionId === revision.id);
  const clip = chosen?.clips.find(c => c.slideId === slideId);
  const slide = revision.content.slides.find(s => s.id === slideId)!;
  const canGenerate = !disabled && !job.outdated && revision.version === job.currentRevision && review?.verdict === 'approved' && state?.eligible && state.configured && current?.status !== 'ready' && current?.status !== 'running' && !current?.shortSlides?.length && !current?.longSlides?.length;
  async function generate() {
    if (!review || busy) return; setBusy(true); setError('');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id, revisionId: revision.id, reviewId: review.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Audio generation failed.');
      setSelected(result.audioId); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start audio.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-line bg-panel p-5" aria-labelledby="production-audio-title">
    <h2 id="production-audio-title" className="text-xl font-semibold">Audio narration · Revision {revision.version}</h2>
    <p className="text-sm text-ink-muted">Generate one WAV clip per slide from the approved scripts using local Kokoro. Unchanged clips are reused. Audio remains in the creator workspace; it does not publish the course.</p>
    <p className="text-sm text-ink-muted">{job.input.unit?.kind === 'video' && 'Every individual slide must measure 5–7 minutes (300–420 seconds) at normal speed. Clips outside this range require script revision and renewed approval.'}</p><p className="text-sm text-ink-muted">{state?.reason ?? 'Checking script approval…'}</p>
    {disabled && <p className="text-sm text-ink-muted">Save your slide and review changes before generating or previewing audio.</p>}
    {state && !state.configured && <p className="text-sm text-destructive">Local Kokoro narration is disabled in server settings.</p>}
    <div className="flex flex-wrap gap-3"><Button disabled={!canGenerate || busy} onClick={() => void generate()}>{busy ? 'Starting audio…' : current?.status === 'running' ? 'Generating narration…' : current?.status === 'ready' ? 'Narration ready' : current?.status === 'failed' ? 'Retry missing narration' : 'Generate approved narration'}</Button><Button variant="outline" onClick={() => void load().catch(e => setError(e instanceof Error ? e.message : 'Could not refresh audio.'))}>Refresh audio status</Button></div>
    <p role="status" className="text-sm text-ink-muted">{current?.status === 'running' ? `${current.clips.length}/${revision.content.slides.length} clips ready. Local synthesis may take several minutes. You can return later.` : ''}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!!state?.jobs.length && <><label htmlFor="audio-history" className="block text-sm font-medium">Audio history</label><select id="audio-history" className="min-h-11 max-w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={chosen?.id ?? ''} onChange={e => setSelected(e.target.value)}>{state.jobs.filter(j => j.revisionId === revision.id).map(j => <option value={j.id} key={j.id}>{j.status} · {j.voice.voice} · {j.clips.length} clips{j.current ? ' · Current' : ' · Historical'}</option>)}</select></>}
    {chosen?.revisionId === revision.id && <div className="space-y-3 border-t border-line pt-4">
      {!chosen.current && <p className="text-sm text-ink-muted">Historical audio: the source, review or voice settings changed. It is not approved audio for the current scripts.</p>}
      {chosen.shortSlides && chosen.shortSlides.length > 0 && <p role="alert" className="text-sm text-destructive">Below the minimum: {chosen.shortSlides.join(', ')}. Edit those narration scripts, save, and approve the new revision.</p>}
      {chosen.longSlides && chosen.longSlides.length > 0 && <p role="alert" className="text-sm text-destructive">Above the seven-minute maximum: {chosen.longSlides.join(', ')}. Shorten those narration scripts, save, and approve the new revision.</p>}
      {chosen.error && <p role="alert" className="text-sm text-destructive">{chosen.error}</p>}
      <p className="text-xs text-ink-muted">Kokoro · {chosen.voice.voice} · {Math.round(chosen.clips.reduce((n, c) => n + c.seconds, 0))} seconds spoken · {chosen.clips.filter(c => c.reused).length} reused clips. Activity time is separate. Pronunciation notes require a listening check.</p>
      {revision.content.lessonVideos && <ProductionLessonPreview content={revision.content} clips={chosen.clips} audioUrl={`${url}?jobId=${job.id}&audioId=${chosen.id}`} ready={chosen.current && chosen.status === 'ready'} disabled={disabled} />}
      {job.input.unit?.kind === 'video' ? <ProductionVideoPreview key={`${chosen.id}:${revision.id}:${disabled}`} content={revision.content} clips={chosen.clips} ready={chosen.current && chosen.status === 'ready'} disabled={disabled} audioUrl={`${url}?jobId=${job.id}&audioId=${chosen.id}`} /> : <><label htmlFor="audio-slide" className="block text-sm font-medium">Narration slide</label><select id="audio-slide" className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={slideId} onChange={e => setSlideId(e.target.value)}>{revision.content.slides.map((s, i) => <option value={s.id} key={s.id}>{i + 1}. {s.title}</option>)}</select>
      <details><summary className="cursor-pointer text-sm font-medium">Matching narration script</summary><p className="mt-3 whitespace-pre-wrap text-sm">{slide.narration}</p></details><p className="text-sm text-ink-muted">{clip ? `${Math.floor(Math.round(clip.seconds) / 60)}:${String(Math.round(clip.seconds) % 60).padStart(2, '0')} measured narration${state?.minimumSeconds ? clip.seconds >= state.minimumSeconds ? ' · Meets five-minute minimum' : ' · Below five-minute minimum' : ''}` : 'Awaiting this clip'}</p>
      {clip && !disabled ? <><audio aria-label={`Narration for ${slide.title}`} key={`${chosen.id}:${clip.key}`} className="w-full" controls preload="none" src={`${url}?jobId=${job.id}&audioId=${chosen.id}&slideId=${slideId}`} /><a className="text-sm text-brand-ink underline" download={`slide-${slideId}.wav`} href={`${url}?jobId=${job.id}&audioId=${chosen.id}&slideId=${slideId}`}>Download this narration clip</a></> : <p className="text-sm text-ink-muted">{disabled ? 'Audio preview is paused while changes are unsaved.' : 'This slide’s narration is not ready yet.'}</p>}</>}
    </div>}
  </section>;
}
