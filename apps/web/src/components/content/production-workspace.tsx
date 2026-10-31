"use client";
import { formatIst } from "@/lib/display-time";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductionEditor } from "./production-editor";
import { ProductionAudio } from "./production-audio";
import { LongformWorkspace } from "./longform-workspace";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import type { BlueprintRun } from "@/lib/instructional-blueprint";
import type { ProductionState } from "@/lib/module-production";

function PilotProductionWorkspace({ run, moduleId, initialState }: { run: BlueprintRun; moduleId: string; initialState: ProductionState }) {
  const [state, setState] = useState({ ...initialState, jobs: initialState.jobs.filter(j => !j.input.unit) }); const [selectedJob, setSelectedJob] = useState(''); const [selectedVersion, setSelectedVersion] = useState(0);
  const [dirtyParts, setDirtyParts] = useState<Record<string, boolean>>({}); const [epoch, setEpoch] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const dirty = Object.values(dirtyParts).some(Boolean); useUnsavedGuard(dirty);
  const endpoint = `/api/v1/content/courses/${run.courseId}/blueprints/${run.id}/modules/${encodeURIComponent(moduleId)}/production`;
  const unit = run.output!.modules.find(m => m.id === moduleId)!;
  const lessonMode = run.input.deliveryStructure === 'codex-ild-v2';
  const active = state.jobs.find(j => !j.outdated);
  const job = state.jobs.find(j => j.id === selectedJob) ?? active ?? state.jobs[0];
  const revision = job?.revisions.find(r => r.version === selectedVersion) ?? job?.revisions[0];
  const onDirty = useCallback((id: string, value: boolean) => setDirtyParts(old => old[id] === value ? old : { ...old, [id]: value }), []);
  const onSaved = useCallback((next: ProductionState) => { setState({ ...next, jobs: next.jobs.filter(j => !j.input.unit) }); setSelectedVersion(0); setDirtyParts({}); setMessage('Saved. Review status is tied to the exact saved revision.'); }, []);
  const fetchState = useCallback(async (signal?: AbortSignal) => { const response = await fetch(endpoint, { signal, cache: 'no-store' }); const next = await response.json(); if (!response.ok) throw new Error(next.error?.message ?? 'Could not load production status.'); return { ...next, jobs: (next as ProductionState).jobs.filter(j => !j.input.unit) } as ProductionState; }, [endpoint]);
  const running = state.jobs.some(j => j.status === 'running');
  useEffect(() => {
    if (!running) return;
    const controller = new AbortController(); const timer = setInterval(() => { void fetchState(controller.signal).then(setState).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not refresh status.'); }); }, 2500);
    return () => { controller.abort(); clearInterval(timer); };
  }, [running, fetchState]);
  function discard(action: () => void) { if (dirty && !window.confirm('Discard unsaved slide or review edits? Copy any text you need before loading another saved version.')) return; setDirtyParts({}); setEpoch(n => n + 1); action(); }
  async function refresh() { try { const next = await fetchState(); setState(next); setError(''); setMessage('Latest production records loaded.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh.'); } }
  async function generate() {
    if (!state.approval || busy) return; setBusy(true); setError('');
    try { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvalId: state.approval.id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Could not start generation.'); setSelectedJob(result.jobId); setSelectedVersion(0); setState(await fetchState()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Generation could not start.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-7"><header className="space-y-3"><Link href={`/content/courses/${run.courseId}/blueprint/review/${run.id}`} className="text-sm text-brand-ink underline">← Stage 3 SME review</Link><p className="text-sm text-brand-ink">{lessonMode ? 'Stage 4 · Module lessons and narration' : 'Stage 4 · Single-module pilot · Scripts first'}</p><h1 className="text-3xl font-semibold">{moduleId}: {unit.title}</h1><p className="text-ink-muted">{run.input.brief.title} · Blueprint input revision {run.inputRevision} · Prompt v{run.promptVersion}</p><p className="text-sm text-ink-muted">Audio: <strong>Available after script approval.</strong> Narration is generated locally with Kokoro. No learner publishing occurs. This module workspace does not release the whole course.</p></header>
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5" aria-label="Production generation"><h2 className="text-xl font-semibold">Approved source and generation</h2><p className={state.eligible ? 'text-sm text-ink-muted' : 'text-sm text-destructive'}>{state.reason}</p>
      {state.approval && <p className="break-words text-xs text-ink-muted">Latest Stage 3 decision: {state.approval.verdict.replaceAll('_', ' ')} · Review {state.approval.version} · {state.approval.reviewerName} · {formatIst(state.approval.createdAt)} · Approval record {state.approval.id}</p>}
      <details className="space-y-4 rounded-lg border border-line p-4"><summary className="cursor-pointer font-medium">Source blueprint, objectives and SME material</summary><p className="break-words text-xs text-ink-muted">Blueprint run {run.id} · Input revision {run.inputRevision}. This frozen material is separate from learner profiles and course progress.</p><h3 className="font-medium">Module objectives</h3><ul className="list-disc space-y-2 pl-5 text-sm">{unit.objectiveIds.map(id => <li key={id}>{id}: {run.input.objectives.find(o => o.id === id)?.text}</li>)}</ul><h3 className="font-medium">Teaching sequence</h3><ol className="list-decimal space-y-3 pl-5 text-sm">{unit.steps.map(step => <li key={step.kind}><strong className="capitalize">{step.kind.replaceAll('_', ' ')} · {step.minutes} min</strong><p className="mt-1 whitespace-pre-wrap text-ink-muted">{step.activity}</p></li>)}</ol><h3 className="font-medium">Frozen SME sources</h3>{run.input.sources.map(source => <div key={source.id} className="space-y-1 text-sm"><strong>{source.id}</strong><p className="whitespace-pre-wrap break-words text-ink-muted">{source.text}</p></div>)}<h3 className="font-medium">Latest approval feedback</h3><p className="whitespace-pre-wrap text-sm text-ink-muted">{state.approval?.feedback || 'No approval feedback recorded.'}</p></details>
      <p className="text-sm">{lessonMode ? 'Generate 3–4 focused concept videos with substantive narration, midpoint checks, worked examples, guided practice, a scenario lab and a module quiz.' : 'Generate 12 editable slides and scripts using the frozen SME sources, approved blueprint and feedback.'} The configured AI provider receives this course material; learner profiles and progress are excluded.</p>
      <div className="flex flex-wrap gap-3"><Button disabled={!state.eligible || !state.configured || busy || active?.status === 'running' || active?.status === 'ready'} onClick={() => void generate()}>{busy ? 'Starting…' : active?.status === 'running' ? 'Generating slides and scripts…' : active?.status === 'ready' ? 'Production package generated' : active?.status === 'failed' ? 'Retry generation' : lessonMode ? 'Generate module lessons and scripts' : 'Generate 12 slides and scripts'}</Button><Button variant="outline" onClick={() => discard(() => void refresh())}>Reload latest records</Button></div>
      {!state.configured && <p className="text-sm text-destructive">The server AI service is not configured.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<p role="status" className="text-sm text-brand-ink">{message}{running ? ' Generation is running. You can return later; interrupted runs become retryable after eight minutes.' : ''}</p>
    </section>
    {job && <section className="space-y-3"><div className="grid gap-3 md:grid-cols-2"><div><label htmlFor="production-job" className="mb-2 block text-sm font-medium">Generation history</label><select id="production-job" className="min-h-11 max-w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={job.id} onChange={e => discard(() => { setSelectedJob(e.target.value); setSelectedVersion(0); })}>{state.jobs.map(j => <option key={j.id} value={j.id}>Approval {j.input.approval.version} · {j.status} · Production prompt v{j.promptVersion}{j.outdated ? ' · Outdated' : ''}</option>)}</select></div>{revision && <div><label htmlFor="production-version" className="mb-2 block text-sm font-medium">Saved content revisions</label><select id="production-version" className="min-h-11 rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={revision.version} onChange={e => discard(() => setSelectedVersion(Number(e.target.value)))}>{job.revisions.map(r => <option key={r.id} value={r.version}>Revision {r.version} · {formatIst(r.createdAt)}</option>)}</select></div>}</div>
      <p className="text-xs text-ink-muted">Model: {job.model ?? 'Pending'} · Attempt {job.attempts} · Frozen source approval {job.input.approval.id}</p>{job.outdated && <p role="status" className="rounded-lg border border-brand-line bg-brand-soft p-4 text-sm text-brand-ink">The SME input, prompt or source approval changed. This package is historical and read only. Recheck Stage 3, then generate from the current approval.</p>}{job.error && <p role="alert" className="text-sm text-destructive">{job.error}</p>}
      {revision && <Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify({ jobId: job.id, source: job.input, revision, scriptReviews: job.reviews.filter(r => r.revisionId === revision.id), audio: 'Generate and download clips from the audio narration panel after script approval' }, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `module-${moduleId}-revision-${revision.version}.json`; link.click(); URL.revokeObjectURL(url); }}>Download saved production package</Button>}
    </section>}
    {job && revision && <><ProductionEditor key={`${epoch}:${job.id}:${revision.id}`} job={job} revision={revision} endpoint={endpoint} onDirty={onDirty} onSaved={onSaved} /><ProductionAudio key={`${job.id}:${revision.id}`} job={job} revision={revision} endpoint={endpoint} disabled={dirty} /></>}
  </div>;
}

export function ProductionWorkspace(props: {run: BlueprintRun; moduleId: string; initialState: ProductionState}) { return props.initialState.format === 'longform-v1' ? <LongformWorkspace {...props} /> : <PilotProductionWorkspace {...props} />; }
