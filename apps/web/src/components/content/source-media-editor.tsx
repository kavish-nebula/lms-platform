'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SourceRecord } from '@/lib/source-library';

export function SourceMediaEditor({ source, courseId, onChange }: { source: SourceRecord; courseId?: string; onChange: (patch: Partial<SourceRecord>) => void }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [confirmed, setConfirmed] = useState(false);
  const endpoint = `/api/v1/content/courses/${courseId}/materials`;
  const href = (id: string) => `${endpoint}/${id}`;
  async function upload(kind: 'audio' | 'diagram', file?: File) {
    if (!file || !courseId) return;
    setBusy('Uploading and checking source media…'); setError('');
    try {
      const body = new FormData(); body.set('kind', kind); body.set('file', file);
      const response = await fetch(endpoint, { method: 'POST', body }); const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Upload failed.');
      onChange(kind === 'audio' ? { audio: { assetId: result.asset.id, durationSeconds: result.asset.durationSeconds } } : { diagram: { assetId: result.asset.id, description: '' } }); setConfirmed(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); } finally { setBusy(''); }
  }
  async function review() {
    if (!source.audio || !courseId) return;
    setBusy('Saving reviewed audio transcript…'); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'review-audio', assetId: source.audio.assetId, text: source.audio.transcriptText }) }); const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Transcript review failed.');
      onChange({ audio: { ...source.audio, transcriptId: result.transcript.id, transcriptText: result.transcript.text } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Transcript review failed.'); } finally { setBusy(''); }
  }
  const fileClass = 'block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-panel file:p-2 focus-visible:outline-2 focus-visible:outline-ring';
  return <div className="space-y-3">
    <details className="space-y-3 rounded-lg border border-line p-3"><summary className="cursor-pointer font-medium">Audio recording{source.audio ? ' · attached' : ''}</summary>
      <p className="text-sm text-ink-muted">Upload MP3, WAV, M4A, Ogg or FLAC, up to 100 MB and 30 minutes. Paste and review its transcript locally. Generation uses the reviewed text; uploading does not send audio to an AI provider.</p>
      {!courseId ? <p className="text-sm">Save the course brief before uploading audio.</p> : <><label htmlFor={`audio-file-${source.id}`} className="block text-sm">{source.audio ? 'Replace source audio' : 'Upload source audio'}</label><input id={`audio-file-${source.id}`} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/flac,.mp3,.wav,.m4a,.ogg,.flac" disabled={!!busy} className={fileClass} onChange={e => { void upload('audio', e.target.files?.[0]); e.target.value = ''; }} /></>}
      {source.audio && <>
        <audio controls preload="metadata" className="w-full" aria-label={`Source audio for ${source.title || source.id}`} src={href(source.audio.assetId)} />
        <p className="text-xs text-ink-muted">{Math.round(source.audio.durationSeconds)} seconds · {source.audio.transcriptId ? 'Audio transcript reviewed' : 'Audio transcript needs review'}</p>
        <label htmlFor={`audio-text-${source.id}`} className="block text-sm font-medium">Audio transcript</label><Textarea id={`audio-text-${source.id}`} rows={5} maxLength={100000} disabled={!!busy} value={source.audio.transcriptText ?? ''} onChange={e => { onChange({ audio: { assetId: source.audio!.assetId, durationSeconds: source.audio!.durationSeconds, transcriptText: e.target.value } }); setConfirmed(false); }} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!!busy} className="mt-1 size-4 accent-brand" onChange={e => setConfirmed(e.target.checked)} />I checked this transcript against the audio recording.</label>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={!!busy || !confirmed || !source.audio.transcriptText?.trim()} onClick={() => void review()}>Confirm audio transcript reviewed</Button><Button type="button" variant="outline" disabled={!!busy} onClick={() => onChange({ audio: undefined })}>Remove audio attachment</Button></div>
      </>}
    </details>
    <details className="space-y-3 rounded-lg border border-line p-3"><summary className="cursor-pointer font-medium">Text diagram and image{source.diagram || source.diagramText?.trim() ? ' · supplied' : ''}</summary>
      <label htmlFor={`diagram-text-${source.id}`} className="block text-sm font-medium">Text diagram or process explanation</label><p id={`diagram-hint-${source.id}`} className="text-xs text-ink-muted">Write steps, arrows, labels and relationships, for example: Request → AI draft → Human review → Approved response. Plain text is stored; diagram code is not executed.</p><Textarea id={`diagram-text-${source.id}`} aria-describedby={`diagram-hint-${source.id}`} className="font-mono" rows={4} maxLength={12000} value={source.diagramText ?? ''} onChange={e => onChange({ diagramText: e.target.value })} />
      {!courseId ? <p className="text-sm">Save the course brief before uploading a diagram image.</p> : <><label htmlFor={`diagram-file-${source.id}`} className="block text-sm">{source.diagram ? 'Replace diagram image' : 'Upload diagram image (optional)'}</label><input id={`diagram-file-${source.id}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={!!busy} className={fileClass} onChange={e => { void upload('diagram', e.target.files?.[0]); e.target.value = ''; }} /><p className="text-xs text-ink-muted">PNG, JPEG or WebP, up to 10 MB. Generation uses your description below, not automatic image interpretation.</p></>}
      {source.diagram && <>
        {/* The authenticated creator asset must load directly with session cookies. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href(source.diagram.assetId)} alt={source.diagram.description.trim().slice(0, 250) || 'Uploaded diagram awaiting a text description'} className="max-h-80 max-w-full rounded-lg object-contain" />
        <label htmlFor={`diagram-description-${source.id}`} className="block text-sm font-medium">Diagram description and essential visual information</label><Textarea id={`diagram-description-${source.id}`} rows={4} maxLength={12000} value={source.diagram.description} onChange={e => onChange({ diagram: { assetId: source.diagram!.assetId, description: e.target.value } })} />
        <Button type="button" variant="outline" disabled={!!busy} onClick={() => onChange({ diagram: undefined })}>Remove diagram attachment</Button>
      </>}
    </details>
    {busy && <p role="status" className="text-sm">{busy}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
