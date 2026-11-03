'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SourceLibraryData } from '@/lib/source-library';

type Source = SourceLibraryData['sources'][number];
export function VideoSourceEditor({ source, courseId, onChange }: { source: Source; courseId?: string; onChange: (patch: Partial<Source>) => void }) {
  const [vtt, setVtt] = useState(''); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const endpoint = `/api/v1/content/courses/${courseId}/videos`;
  const video = source.video;
  useEffect(() => {
    if (!courseId || !video?.transcriptId) return;
    const controller = new AbortController();
    void fetch(`/api/v1/courses/${courseId}/concept-video/${video.assetId}?transcript=${video.transcriptId}`, { signal: controller.signal }).then(async response => {
      if (response.ok) setVtt(await response.text());
    }).catch(() => undefined);
    return () => controller.abort();
  }, [courseId, video?.assetId, video?.transcriptId]);
  async function upload(file?: File) {
    if (!file || !courseId) return;
    setBusy('Uploading and checking video…'); setError('');
    try {
      const body = new FormData(); body.set('file', file);
      const response = await fetch(endpoint, { method: 'POST', body }); const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Upload failed.');
      onChange({ video: { assetId: result.asset.id, durationSeconds: result.asset.durationSeconds }, text: '' }); setVtt(''); setConfirmed(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed.'); }
    finally { setBusy(''); }
  }
  async function action(kind: 'transcribe' | 'review') {
    if (!video) return;
    setBusy(kind === 'transcribe' ? 'Transcribing audio…' : 'Saving reviewed transcript…'); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: kind, assetId: video.assetId, ...(kind === 'review' ? { vtt } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Could not process transcript.');
      if (kind === 'transcribe') { setVtt(result.vtt); setConfirmed(false); onChange({ video: { assetId: video.assetId, durationSeconds: video.durationSeconds } }); }
      else onChange({ video: { ...video, transcriptId: result.transcript.id, checkpointSeconds: result.transcript.checkpointSeconds }, text: result.transcript.text });
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not process transcript.'); }
    finally { setBusy(''); }
  }
  return <section className="space-y-3 rounded-lg border border-line p-3" aria-label={`Concept video for ${source.title || source.id}`}>
    <h4 className="font-semibold">Concept teaching video</h4><p className="text-sm text-ink-muted">Upload MP4 (H.264) or WebM, up to 250 MB and 7 minutes. The original video and its recorded voice play to learners. Activity generation uses your reviewed transcript.</p>
    {!courseId ? <p className="text-sm">Save the course brief before uploading.</p> : source.scope === 'course' ? <p className="text-sm">Choose module or topic scope above before uploading.</p> : <><label htmlFor={`video-file-${source.id}`} className="block text-sm font-medium">{video ? 'Replace concept video' : 'Upload concept video'}</label><input id={`video-file-${source.id}`} type="file" accept="video/mp4,video/webm" disabled={!!busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-panel file:p-2 focus-visible:outline-2 focus-visible:outline-ring" /></>}
    {video && courseId && <><video key={video.assetId} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" src={`/api/v1/courses/${courseId}/concept-video/${video.assetId}`} aria-label={`Preview ${source.title}`} />
      <p className="text-sm">Video duration: {Math.round(video.durationSeconds)} seconds · {video.transcriptId ? 'Transcript reviewed' : 'Transcript needs review'}</p>
      <Button type="button" variant="outline" disabled={!!busy} onClick={() => void action('transcribe')}>Generate draft transcript</Button>
      <p className="text-xs text-ink-muted">Automatic transcription sends the video’s audio to your configured Google AI service. You can paste an existing WebVTT transcript instead.</p>
      <label htmlFor={`video-transcript-${source.id}`} className="block text-sm font-medium">Review timestamped transcript (WebVTT)</label><p className="text-xs text-ink-muted">Correct the words and timestamps against the video. You can also paste an existing WebVTT transcript. Describe essential on-screen actions if speech alone does not explain them. Include a cue boundary near the midpoint so questions assess only what has played.</p>
      <Textarea id={`video-transcript-${source.id}`} rows={9} maxLength={200000} value={vtt} placeholder={'WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nSpoken words…'} disabled={!!busy} onChange={e => { setVtt(e.target.value); setConfirmed(false); if (video.transcriptId) onChange({ video: { assetId: video.assetId, durationSeconds: video.durationSeconds } }); }} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={!!busy} />I checked the transcript and timestamps against this video.</label>
      <Button type="button" disabled={!!busy || !confirmed || !vtt.trim()} onClick={() => void action('review')}>Confirm transcript reviewed</Button>
      <p className="text-xs text-ink-muted">Save the course brief after confirming the transcript. Replacing the video or editing the transcript requires a new review.</p>
    </>}
    {busy && <p role="status" className="text-sm">{busy}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
