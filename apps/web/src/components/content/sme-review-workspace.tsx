"use client";
import { CourseDeliveryFlow } from './course-delivery-flow';
import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SmeModuleReview } from "./sme-module-review";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import type { BlueprintRun } from "@/lib/instructional-blueprint";
import { reviewSummary, type SmeReviewState } from "@/lib/sme-review";

export function SmeReviewWorkspace({ run, initialState }: { run: BlueprintRun; initialState: SmeReviewState }) {
  const [state, setState] = useState(initialState);
  const [dirtyModules, setDirtyModules] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const dirty = Object.values(dirtyModules).some(Boolean);
  useUnsavedGuard(dirty);
  const onDirty = useCallback((id: string, value: boolean) => setDirtyModules(old => old[id] === value ? old : { ...old, [id]: value }), []);
  const onSaved = useCallback((id: string, next: SmeReviewState) => {
    setState(old => { const entries = [...new Map([...old.entries, ...next.entries].map(e => [e.id, e])).values()]; return { ...next, entries, summary: reviewSummary({ output: run.output, outdated: !next.writable }, entries) }; });
    setDirtyModules(old => ({ ...old, [id]: false })); setMessage(`Review for ${id} saved.`);
  }, [run.output]);
  async function reload() {
    if (dirty && !window.confirm('Reload the latest decisions? Unsaved review edits will be discarded. Copy any feedback you want to keep first.')) return;
    try {
      const response = await fetch(`/api/v1/content/courses/${run.courseId}/blueprints/${run.id}/reviews`, { cache: 'no-store' }); const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Could not load reviews.');
      setState(data); setDirtyModules({}); setReloadEpoch(n => n + 1); setError(''); setMessage('Latest review decisions loaded.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load reviews. Your feedback remains here.'); }
  }
  const summary = state.summary;
  return <div className="space-y-7"><header className="space-y-3"><Link className="text-sm text-brand-ink underline" href={`/content/courses/${run.courseId}/blueprint`}>← Instructional blueprint</Link><p className="text-sm text-brand-ink">Stage 3 · SME Quality Control</p><h1 className="text-3xl font-semibold">Review the instructional blueprint</h1><p className="text-lg">{run.input.brief.title}</p><p className="text-sm text-ink-muted">SME input revision {run.inputRevision} · Prompt v{run.promptVersion} · Blueprint {run.id} · {run.model}. Every decision applies only to this saved blueprint. Reviewer identity uses the shared local demo session; reviewer qualifications are not verified.</p></header><CourseDeliveryFlow structure={run.deliveryStructure} lastModule={run.output!.modules.at(-1)!.id} />
    <section aria-label="Review progress" className="space-y-4 rounded-xl border border-line bg-panel p-5"><h2 className="text-xl font-semibold">{summary.status === 'outdated' ? 'Historical review — blueprint outdated' : summary.gatePassed ? 'All modules approved · Gate 1 review complete' : summary.changesRequested ? 'Changes requested before content creation' : 'SME review in progress'}</h2><p className="text-sm">{summary.approved}/{summary.total} approved · {summary.changesRequested} need changes · {summary.pending} pending</p><p className="text-sm text-ink-muted">Module approvals do not publish a course or constitute the final SME release sign-off. Content creation and later ILD quality checks remain separate stages. Feedback is recorded for revision; it does not automatically edit or regenerate the blueprint.</p>
      {!state.writable && <p className="text-sm text-destructive">This blueprint cannot receive new decisions. Generate a current, completed blueprint from the latest SME input. Historical reviews remain visible and are not transferred to the new version.</p>}
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => void reload()}>Reload latest decisions</Button><Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify({ runId: run.id, courseId: run.courseId, inputRevision: run.inputRevision, promptVersion: run.promptVersion, ...state }, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `sme-review-${run.id}.json`; link.click(); URL.revokeObjectURL(url); }}>Download review record</Button></div><p role="status" className="text-sm text-brand-ink">{message}{dirty ? ' Unsaved module review changes.' : ''}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
    <nav aria-label="Review modules" className="flex flex-wrap gap-3 text-sm text-brand-ink">{run.output?.modules.map(m => <a key={m.id} href={`#review-${m.id}`} className="underline">{m.id}: {state.summary.latest[m.id]?.verdict.replaceAll('_', ' ') ?? 'pending'}</a>)}</nav>
    {run.output?.modules.map(unit => <SmeModuleReview key={`${reloadEpoch}:${unit.id}:${state.summary.latest[unit.id]?.version ?? 0}`} run={run} moduleId={unit.id} entry={state.summary.latest[unit.id]} history={state.entries.filter(e => e.moduleId === unit.id).sort((a, b) => b.version - a.version)} writable={state.writable} onDirty={onDirty} onSaved={onSaved} />)}
  </div>;
}
