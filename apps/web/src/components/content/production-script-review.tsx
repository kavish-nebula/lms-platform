"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScriptDecision, type ProductionJob, type ProductionRevision, type ProductionState } from "@/lib/module-production";

export function ProductionScriptReview({ job, revision, endpoint, disabled, onDirty, onSaved }: { job: ProductionJob; revision: ProductionRevision; endpoint: string; disabled: boolean; onDirty: (value: boolean) => void; onSaved: (state: ProductionState) => void }) {
  const isPlan = job.input.unit?.kind === 'plan';
  const existing = job.reviews.find(r => r.revisionId === revision.id);
  const initial = { verdict: existing?.verdict ?? '' as '' | 'approved' | 'revision_requested', checklist: existing?.checklist ?? { sourceAccuracy: false, alignment: false, pronunciation: false, pacing: false }, feedback: existing?.feedback ?? '' };
  const [baseline] = useState(() => JSON.stringify(initial)); const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dirty = JSON.stringify(value) !== baseline;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const parsed = ScriptDecision.safeParse({ ...value, jobId: job.id, expectedRevision: revision.version, expectedReviewVersion: job.reviews[0]?.version ?? 0 });
    if (!parsed.success) { setError(parsed.error.issues.map(i => i.message).join(' ')); return; }
    setBusy(true); setError('');
    try { const response = await fetch(`${endpoint}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) }); const state = await response.json(); if (!response.ok) throw new Error(state.error?.message ?? 'Could not save script review.'); onSaved(state); }
    catch (e) { setError(e instanceof TypeError ? 'The server is unavailable. Your review feedback is retained.' : e instanceof Error ? e.message : 'Could not save script review.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-line bg-panel p-5" aria-labelledby="script-review-title"><h2 id="script-review-title" className="text-xl font-semibold">{isPlan ? 'Plan and activities review' : 'Script review'} · Revision {revision.version}</h2><p className="text-sm text-ink-muted">Current decision: {existing?.verdict.replaceAll('_', ' ') ?? 'Pending'}. Save content before reviewing. Every edit creates a new revision requiring renewed review. Script approval does not publish the course or approve final release.</p>
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={disabled || busy} className="space-y-4"><legend className="sr-only">Script review checks</legend>
      {([['sourceAccuracy', 'I checked source accuracy against the frozen SME material.'], ['alignment', 'I checked that the content aligns with objectives and the matching visuals or activity.'], ['pronunciation', 'I checked pronunciation notes, or confirmed none are needed.'], ['pacing', 'I checked narration requirements and separate learner activity timing.']] as const).map(([key, label]) => <label className="flex min-h-11 items-start gap-3 text-sm" key={key}><input className="mt-1 size-4 accent-brand" type="checkbox" checked={value.checklist[key]} onChange={e => setValue(v => ({ ...v, checklist: { ...v.checklist, [key]: e.target.checked } }))} />{label}</label>)}
      <div><label htmlFor="script-verdict" className="mb-2 block text-sm font-medium">Script decision</label><select id="script-verdict" value={value.verdict} required className="min-h-11 rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" onChange={e => setValue(v => ({ ...v, verdict: e.target.value as typeof v.verdict }))}><option value="">Choose a decision</option><option value="approved">{isPlan ? 'Approve plan and activities' : 'Approve scripts'}</option><option value="revision_requested">Request script revisions</option></select></div>
      <div><label htmlFor="script-feedback" className="mb-2 block text-sm font-medium">Script review feedback</label><Textarea id="script-feedback" maxLength={6000} rows={3} required={value.verdict === 'revision_requested'} value={value.feedback} onChange={e => setValue(v => ({ ...v, feedback: e.target.value }))} /></div><Button type="submit" disabled={!dirty}>{busy ? 'Saving review…' : 'Save script review'}</Button>
    </fieldset>{disabled && <p className="text-sm text-ink-muted">Review is disabled for unsaved edits, historical revisions or outdated source approval.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>
    <details className="space-y-3 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-medium">Script decision history ({job.reviews.length})</summary>{job.reviews.map(r => <article className="space-y-1 rounded-lg border border-line p-3 text-sm" key={r.id}><h3 className="font-medium">Content revision {r.expectedRevision} · {r.verdict.replaceAll('_', ' ')}</h3><p className="text-xs text-ink-muted">{r.reviewerName} · {r.createdAt.replace('T', ' ').slice(0, 19)} UTC</p><p className="whitespace-pre-wrap">{r.feedback || 'No additional notes.'}</p></article>)}</details>
  </section>;
}
