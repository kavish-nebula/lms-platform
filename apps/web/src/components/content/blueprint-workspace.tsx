"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlueprintDocument } from "./blueprint-document";
import { briefReadiness, type CreatorDraft } from "@/lib/content-creator";
import type { BlueprintRun } from "@/lib/instructional-blueprint";

export function BlueprintWorkspace({ draft, initialRuns, configured }: { draft: CreatorDraft; initialRuns: BlueprintRun[]; configured: boolean }) {
  const [runs, setRuns] = useState(initialRuns);
  const [selected, setSelected] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/v1/content/courses/${draft.id}/blueprints`;
  const active = runs.find(r => !r.outdated && r.promptVersion === (draft.deliveryStructure === 'codex-ild-v2' ? 4 : draft.deliveryStructure === 'six-stage-v1' ? 3 : 2));
  const shown = runs.find(r => r.id === selected) ?? active ?? runs[0];
  const complete = briefReadiness(draft.brief).every(c => c.ready);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? 'Could not check AI processing.');
    setRuns(data.runs); setError("");
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setInterval(() => { void refresh(controller.signal).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not refresh. Your saved runs are retained.'); }); }, runs.some(r => r.status === 'running') ? 2500 : 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh, runs]);
  async function start() {
    setStarting(true); setError("");
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: draft.revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Could not start AI processing.');
      setRuns(old => [data.run, ...old.filter(r => r.id !== data.run.id)]); setSelected(data.run.id);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not start. Your SME input remains saved.'); }
    finally { setStarting(false); }
  }
  return <div className="space-y-8">
    <header className="space-y-3"><Link className="text-sm text-brand-ink underline" href={`/content/courses/${draft.id}`}>← Edit SME input</Link><p className="text-sm text-brand-ink">Stage 2 · AI Processing</p><h1 className="text-3xl font-semibold">Instructional blueprint</h1><p className="text-lg">{draft.brief.title || 'Untitled course'}</p><p className="max-w-3xl text-sm text-ink-muted">Generate the seven ILD design sections from saved SME input revision {draft.revision}. The saved course brief, source notes and references will be sent to the configured AI provider. Learner profiles and progress are not included. Source links are not fetched.</p></header>
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5" aria-label="AI processing controls"><p className="text-sm">AI draft for SME review. Structural checks do not establish factual accuracy, instructional quality or approval. Review in Stage 3, then open the Stage 4 scripts-first pilot for an approved module. Approved scripts can then be narrated with local Kokoro. Publishing remains deferred.</p>
      {!complete && <p className="text-sm text-destructive">Complete the Stage 1 preparation checks and save the input before generating.</p>}{!configured && <p className="text-sm text-destructive">The server AI service is not configured. Your saved input remains available.</p>}
      <div className="flex flex-wrap gap-3"><Button onClick={() => void start()} disabled={!complete || !configured || starting || active?.status === 'running' || active?.status === 'ready'}><Sparkles aria-hidden />{starting ? 'Starting…' : active?.status === 'running' ? 'AI processing in progress…' : active?.status === 'ready' ? 'Blueprint generated for this input' : active?.status === 'failed' ? 'Retry AI processing' : 'Generate instructional blueprint'}</Button><Button variant="outline" onClick={() => void refresh().catch(() => setError('Could not refresh. Your saved runs are retained.'))}>Refresh status</Button>
      {shown?.output && <><Button asChild variant="outline"><Link href={`/content/courses/${draft.id}/blueprint/review/${shown.id}`}>Stage 3: SME quality control →</Link></Button><Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify({ ...shown, reviewStatus: 'AI draft — see separate SME review record for decisions' }, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `instructional-blueprint-${shown.id}.json`; anchor.click(); URL.revokeObjectURL(url); }}><Download aria-hidden />Download blueprint JSON</Button></>}</div>
      <p role="status" className="text-sm text-ink-muted">{active?.status === 'running' ? 'Processing the frozen input. You can leave this page and return. Interrupted runs become retryable after eight minutes.' : active?.status === 'ready' ? 'Generated and saved. Open Stage 3 for current SME decisions.' : 'Generate when the saved input is ready. Completed results are retained by input revision.'}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
    {active && !active.outdated && active.inputRevision !== draft.revision && <p className="text-sm text-ink-muted">The saved brief matches frozen input revision {active.inputRevision} exactly. Its blueprint and existing reviews are reused.</p>}
    {runs.length > 0 && <div className="space-y-2"><label className="block text-sm font-medium" htmlFor="blueprint-run">Generation history</label><select id="blueprint-run" className="min-h-11 max-w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={shown?.id ?? ''} onChange={e => setSelected(e.target.value)}>{runs.map(r => <option key={r.id} value={r.id}>Input revision {r.inputRevision} · {r.status} · Prompt v{r.promptVersion}{r.outdated ? ' · Outdated' : ''}</option>)}</select></div>}
    {shown && <section className="space-y-3" aria-label="Selected run"><p className="text-xs text-ink-muted">Input revision {shown.inputRevision} · Prompt v{shown.promptVersion} · Attempt {shown.attempts} · {shown.model ?? 'Model pending'} · {new Date(shown.updatedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC</p>{shown.outdated && <p role="status" className="rounded-lg border border-brand-line bg-brand-soft p-4 text-sm text-brand-ink">This blueprint uses an older input revision or prompt. It is retained for comparison. Generate a new blueprint from the latest saved SME input.</p>}{shown.status === 'failed' && <p role="alert" className="text-sm text-destructive">{shown.error}</p>}<BlueprintDocument run={shown} /></section>}
  </div>;
}
