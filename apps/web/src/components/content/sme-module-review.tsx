"use client";
import { formatIst } from "@/lib/display-time";
import { moduleDeliverySteps, STAGE_LABELS } from '@/lib/course-delivery';
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_SME_CHECKLIST, SME_CHECKS, SmeDecision, type ReviewDecision, type SmeReviewEntry, type SmeReviewState } from "@/lib/sme-review";
import type { BlueprintRun } from "@/lib/instructional-blueprint";

export function SmeModuleReview({ run, moduleId, entry, history, writable, onDirty, onSaved }: { run: BlueprintRun; moduleId: string; entry?: SmeReviewEntry; history: SmeReviewEntry[]; writable: boolean; onDirty: (id: string, dirty: boolean) => void; onSaved: (id: string, state: SmeReviewState) => void }) {
  const unit = run.output!.modules.find(m => m.id === moduleId)!;
  const initial = { verdict: entry?.verdict ?? '' as ReviewDecision['verdict'] | '', checklist: entry?.checklist ?? EMPTY_SME_CHECKLIST, feedback: entry?.feedback ?? '', priority: entry?.priority ?? 'Recommended' as ReviewDecision['priority'] };
  const [baseline] = useState(() => JSON.stringify(initial));
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dirty = JSON.stringify(values) !== baseline;
  useEffect(() => { onDirty(moduleId, dirty); }, [moduleId, dirty, onDirty]);
  const tasks = run.output!.tasks.filter(t => t.moduleId === moduleId);
  const assessments = run.output!.assessments.filter(a => a.moduleId === moduleId && !(['six-stage-v1', 'codex-ild-v2'].includes(run.deliveryStructure ?? '') && a.layer === 'L4'));
  const sourceIds = new Set([...unit.sourceIds, ...tasks.flatMap(t => t.sourceIds)]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const parsed = SmeDecision.safeParse({ ...values, moduleId, expectedVersion: entry?.version ?? 0 });
    if (!parsed.success) { setError(parsed.error.issues.map(i => i.message).join(' ')); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/v1/content/courses/${run.courseId}/blueprints/${run.id}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      const state = await response.json();
      if (!response.ok) throw new Error(state.error?.message ?? 'Could not save your review.');
      onSaved(moduleId, state); setMessage('Review saved.');
    } catch (error) { setError(error instanceof TypeError ? 'Could not reach the server. Your decision and feedback are still here; retry when available.' : error instanceof Error ? error.message : 'Could not save. Your feedback is retained.'); }
    finally { setBusy(false); }
  }
  return <article id={`review-${moduleId}`} className="min-w-0 scroll-mt-24 space-y-5 rounded-xl border border-line bg-panel p-5 md:p-6">
    <header className="space-y-2"><p className="text-xs font-medium text-brand-ink">{entry ? entry.verdict.replaceAll('_', ' ') : 'Pending review'}{dirty ? ' · Unsaved changes' : ''}</p><h2 className="text-xl font-semibold">{unit.id}: {unit.title}</h2><p className="text-sm text-ink-muted">{unit.minutes} min · Objectives: {unit.objectiveIds.join(', ')} · Prerequisites: {unit.prerequisites.join(', ') || 'Course entry requirements'}</p>{writable && entry?.verdict === 'approved' ? <Button asChild variant="outline"><Link href={`/content/courses/${run.courseId}/production/${run.id}/${encodeURIComponent(moduleId)}`}>Open Stage 4 →</Link></Button> : <p className="text-xs text-ink-muted">Stage 4 requires a current saved approval for this module.</p>}</header>
    <details className="space-y-3 rounded-lg border border-line p-4"><summary className="cursor-pointer font-medium">Review module content, tasks, assessments and sources</summary>
      <h3 className="font-semibold">Original objectives</h3>{run.input.objectives.filter(o => unit.objectiveIds.includes(o.id)).map(o => <p key={o.id} className="text-sm">{o.id} · {o.bloom}: {o.text}</p>)}
      <h3 className="font-semibold">Teaching sequence</h3><ol className="space-y-2 text-sm">{(run.deliveryStructure === 'six-stage-v1' ? moduleDeliverySteps(unit.steps) : unit.steps).map((s, i) => <li key={s.kind}><strong>{i + 1}. {STAGE_LABELS[s.kind] ?? s.kind.replaceAll('_', ' ')}{s.minutes !== undefined ? ` · ${s.minutes} min` : ''}</strong><p>{s.activity}</p></li>)}</ol>
      <h3 className="font-semibold">Tasks</h3>{tasks.map((t, i) => <div key={i} className="space-y-1 border-t border-line pt-3 text-sm"><h4 className="font-medium">{t.tier}: {t.title}</h4><p>{t.instructions}</p><p>Deliverable: {t.deliverable}</p><p>Feedback: {t.feedback}</p></div>)}
      <h3 className="font-semibold">Assessment specifications</h3>{assessments.map((a, i) => <div key={i} className="space-y-1 border-t border-line pt-3 text-sm"><h4 className="font-medium">{a.layer} · {a.bloom} · {a.solo} · {a.objectiveIds.join(', ')}</h4><p>{a.timing}: {a.prompt}</p><p>Evidence: {a.evidence}</p><p>Criteria: {a.successCriteria.join('; ')}</p><p>Misconceptions: {a.misconceptions.join('; ')}</p><p>Remediation: {a.remediation}</p></div>)}
      <h3 className="font-semibold">Frozen SME source blocks</h3>{run.input.sources.filter(s => sourceIds.has(s.id)).map(s => <div key={s.id} className="border-t border-line pt-3 text-sm"><h4 className="font-medium">{s.id}</h4><p className="whitespace-pre-wrap break-words">{s.text}</p></div>)}
    </details>
    <form onSubmit={save} className="space-y-4"><fieldset disabled={busy || !writable} className="space-y-4"><legend className="mb-3 font-semibold">SME quality-control checklist</legend><p className="text-sm text-ink-muted">Check a criterion only after reviewing it. Approval requires all seven checks. For a rejection or revision request, leave failed checks unchecked and explain the required changes.</p>
      {SME_CHECKS.map(([key, title, help]) => <label key={key} className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-brand" checked={values.checklist[key]} onChange={e => setValues(v => ({ ...v, checklist: { ...v.checklist, [key]: e.target.checked } }))} /><span><strong>{title}</strong><span className="block text-ink-muted">{help}</span></span></label>)}
      <div className="space-y-2"><label htmlFor={`verdict-${moduleId}`} className="block text-sm font-medium">Module decision</label><select id={`verdict-${moduleId}`} value={values.verdict} required className="min-h-11 w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" onChange={e => setValues(v => ({ ...v, verdict: e.target.value as typeof v.verdict }))}><option value="">Choose a decision</option><option value="approved">Approve module</option><option value="revision_requested">Request revisions</option><option value="rejected">Reject module</option></select></div>
      <div className="space-y-2"><label htmlFor={`feedback-${moduleId}`} className="block text-sm font-medium">Revision feedback / review notes{values.verdict && values.verdict !== 'approved' ? ' (required)' : ''}</label><p id={`feedback-help-${moduleId}`} className="text-xs text-ink-muted">Name the affected element, explain the issue and give numbered, actionable changes. Feedback is saved for the creator; it does not automatically regenerate content.</p><Textarea id={`feedback-${moduleId}`} aria-describedby={`feedback-help-${moduleId}`} rows={4} maxLength={6000} required={!!values.verdict && values.verdict !== 'approved'} value={values.feedback} onChange={e => setValues(v => ({ ...v, feedback: e.target.value }))} /></div>
      {values.verdict !== 'approved' && <div className="space-y-2"><label htmlFor={`priority-${moduleId}`} className="block text-sm font-medium">Feedback priority</label><select id={`priority-${moduleId}`} className="min-h-11 rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={values.priority} onChange={e => setValues(v => ({ ...v, priority: e.target.value as typeof v.priority }))}>{['Critical', 'Recommended', 'Optional'].map(p => <option key={p}>{p}</option>)}</select></div>}
      <Button type="submit" disabled={!dirty}>{busy ? 'Saving…' : entry ? 'Save updated review' : 'Save module review'}</Button>
    </fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<p role="status" className="text-sm text-brand-ink">{message}</p></form>
    {history.length > 0 && <details className="space-y-3 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-medium">Decision history ({history.length})</summary>{history.map(h => <div key={h.id} className="space-y-1 rounded-lg border border-line p-3 text-sm"><p className="font-medium">Review {h.version} · {h.verdict.replaceAll('_', ' ')}</p><p className="text-xs text-ink-muted">{h.reviewerName} · {formatIst(h.createdAt)} · {Object.values(h.checklist).filter(Boolean).length}/7 checks passed{h.verdict !== 'approved' ? ` · ${h.priority}` : ''}</p><p className="whitespace-pre-wrap break-words">{h.feedback || 'No additional notes.'}</p></div>)}</details>}
  </article>;
}
