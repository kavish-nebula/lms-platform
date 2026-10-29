'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Surface } from '@/components/kit/surface';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useEnrollment } from '@/lib/enrollment';
import { useFinale } from '@/lib/finale';
import { useUnsavedGuard } from '@/lib/use-unsaved-guard';
import { runSandbox, starterArtifact, SANDBOX_OPERATIONS, type SandboxArtifactData, type SandboxRun, type SandboxReport, type SandboxWork } from '@/lib/project-sandbox';
import type { PublicSandboxProject } from '@/server/project-sandbox';

const selectClass = 'min-h-11 w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';

export function ProjectSandboxWorkspace({ project, embedded = false, onContinue }: { project: PublicSandboxProject; embedded?: boolean; onContinue?: () => void }) {
  const { enrolled, ready } = useEnrollment(project.courseId);
  const { state, markDone } = useFinale(project.courseId);
  const endpoint = `/api/v1/enrollments/${project.courseId}/project-sandbox`;
  const { data, error: loadError, isLoading, mutate } = useSWR<{ work: SandboxWork }>(enrolled ? `${endpoint}?revisionId=${project.revisionId}` : null, (url: string) => api(url), { revalidateOnFocus: false });
  const [artifact, setArtifact] = React.useState<SandboxArtifactData | null>(null);
  const [version, setVersion] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const [report, setReport] = React.useState<SandboxReport | null>(null);
  const [run, setRun] = React.useState<SandboxRun | null>(null);
  const [submittedAt, setSubmittedAt] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [confirm, setConfirm] = React.useState<'reset' | 'reload' | null>(null);
  useUnsavedGuard(dirty);

  if (!artifact && ready && !isLoading && (!enrolled || data)) {
    setArtifact(data?.work.artifact ?? starterArtifact(project.sandbox));
    setVersion(data?.work.version ?? 0); setReport(data?.work.report ?? null); setSubmittedAt(data?.work.submittedAt ?? null);
  }
  React.useEffect(() => {
    if (submittedAt && report?.passed && !state.done.includes('capstone')) markDone('capstone', { capstoneAt: submittedAt });
  }, [submittedAt, report?.passed, state.done, markDone]);

  function change(next: SandboxArtifactData) { setArtifact(next); setDirty(true); setRun(null); setReport(null); setSubmittedAt(null); setNotice(''); setError(''); }
  async function action(which: 'save' | 'run' | 'test' | 'submit') {
    if (!artifact) return;
    setError(''); setNotice('');
    if (which === 'run') { setRun(runSandbox(artifact, Object.fromEntries(project.sandbox.inputs.map(i => [i.id, i.sample])))); return; }
    setBusy(true);
    try {
      const response = await api<{ work?: SandboxWork; report?: SandboxReport }>(endpoint, { method: 'POST', body: { revisionId: project.revisionId, version, artifact, action: which } });
      if (response.work) {
        setVersion(response.work.version); setReport(response.work.report); setSubmittedAt(response.work.submittedAt); setDirty(false);
        await mutate({ work: response.work }, { revalidate: false });
        setNotice(which === 'submit' ? 'Project submitted. This grade is computed from your submitted artifact.' : 'Draft saved. Your earlier submissions remain in history.');
      } else if (response.report) { setReport(response.report); setSubmittedAt(null); setNotice('Tests finished. This is practice feedback; submit to record your project.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not process the project. Your draft is retained.'); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (confirm === 'reset') { change(starterArtifact(project.sandbox)); setConfirm(null); return; }
    setBusy(true); setError('');
    try {
      const response = await api<{ work: SandboxWork }>(`${endpoint}?revisionId=${project.revisionId}`);
      setArtifact(response.work.artifact ?? starterArtifact(project.sandbox)); setVersion(response.work.version); setReport(response.work.report); setSubmittedAt(response.work.submittedAt); setDirty(false); setRun(null); setConfirm(null);
      await mutate(response, { revalidate: false });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not reload. Your draft is retained.'); }
    finally { setBusy(false); }
  }
  const updateStep = (index: number, patch: Partial<SandboxArtifactData['steps'][number]>) => artifact && change({ ...artifact, steps: artifact.steps.map((s, i) => i === index ? { ...s, ...patch } : s) });
  const submittedPass = !!submittedAt && !!report?.passed;
  return <div className={embedded ? 'flex flex-col gap-5' : 'mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-8'}>
    {!embedded && <Link className="text-sm underline" href={`/learn/courses/${project.courseId}/finale/capstone`}>Back to course project</Link>}
    <Surface pad="lg" className="space-y-4">
      <div><p className="text-sm font-medium text-brand-ink">Practical project · In-course sandbox</p><h1 className="text-2xl font-semibold">{project.title}</h1></div>
      <p className="whitespace-pre-wrap">{project.brief}</p>
      <p><strong>Deliverable:</strong> {project.deliverable}</p>
      <ol className="list-decimal space-y-2 pl-5">{project.sandbox.instructions.map((instruction, i) => <li key={i}>{instruction}</li>)}</ol>
      <p className="text-sm text-ink-muted">Build your artifact and workflow below. Run simulates the sample input. Test checks every supplied case. Submit records the artifact and a server-computed grade. All actions stay inside this course.</p>
      {!enrolled && ready && <p className="text-sm">You can build and run a preview. <Link className="underline" href={`/learn/courses/${project.courseId}/enroll`}>Enroll to save, test and submit.</Link></p>}
    </Surface>
    {loadError && <p role="alert" className="text-destructive">Could not load your saved project: {loadError.message}. Reload before editing saved work.</p>}
    {!artifact ? <p role="status">Loading project…</p> : <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Surface pad="lg" className="space-y-4">
          <h2 className="text-lg font-semibold">1. Build your artifact</h2>
          <fieldset disabled={busy} className="space-y-4"><legend className="sr-only">Project fields</legend>{project.sandbox.fields.map(field => <label key={field.id} className="block space-y-2"><span className="text-sm font-medium">{field.label}</span><Textarea rows={2} maxLength={4000} value={artifact.values[field.id] ?? ''} onChange={e => change({ ...artifact, values: { ...artifact.values, [field.id]: e.target.value } })} /><span className="block text-xs text-ink-muted">{field.help} Reference: values.{field.id}</span></label>)}</fieldset>
          <h2 className="text-lg font-semibold">2. Build your workflow</h2>
          <p className="text-sm text-ink-muted">Steps run in order. Reference input.name, values.name or a previous output.name. Templates use {'{{input.name}}'}. Sum and multiply use comma-separated references. Fallback uses two references separated by |.</p>
          <fieldset disabled={busy} className="space-y-4"><legend className="sr-only">Workflow steps</legend>{artifact.steps.map((step, i) => <div key={step.id} className="space-y-3 rounded-lg border border-line p-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Step {i + 1}</h3><Button variant="ghost" size="sm" aria-label={`Remove step ${i + 1}`} onClick={() => change({ ...artifact, steps: artifact.steps.filter((_, n) => n !== i) })}>Remove</Button></div>
            <label className="block space-y-1 text-sm"><span>Operation {i + 1}</span><select className={selectClass} value={step.operation} onChange={e => updateStep(i, { operation: e.target.value as typeof step.operation })}>{SANDBOX_OPERATIONS.map(op => <option key={op} value={op}>{op}</option>)}</select></label>
            <label className="block space-y-1 text-sm"><span>Output name {i + 1}</span><Input maxLength={60} value={step.output} onChange={e => updateStep(i, { output: e.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Expression {i + 1}</span><Textarea maxLength={4000} rows={2} value={step.expression} onChange={e => updateStep(i, { expression: e.target.value })} /></label>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => { const steps = [...artifact.steps]; [steps[i - 1], steps[i]] = [steps[i]!, steps[i - 1]!]; change({ ...artifact, steps }); }}>Move up</Button></div>
          </div>)}</fieldset>
          <Button variant="outline" disabled={busy || artifact.steps.length >= 40} onClick={() => {
            const id = `step${crypto.randomUUID().replaceAll('-', '')}`;
            let n = 1; while (artifact.steps.some(step => step.output === `result${n}`)) n++;
            change({ ...artifact, steps: [...artifact.steps, { id, operation: 'copy', output: `result${n}`, expression: `input.${project.sandbox.inputs[0]!.id}` }] });
          }}>Add step</Button>
        </Surface>
        <div className="space-y-5">
          <Surface pad="lg" className="space-y-3"><h2 className="text-lg font-semibold">Sample inputs and test cases</h2><dl className="space-y-2">{project.sandbox.inputs.map(input => <div key={input.id}><dt className="text-sm font-medium">{input.label} · input.{input.id}</dt><dd className="whitespace-pre-wrap text-sm text-ink-muted">{input.sample || '(empty)'}</dd></div>)}</dl>{project.sandbox.tests.map(test => <details key={test.id} className="rounded-lg border border-line p-3 text-sm"><summary className="cursor-pointer font-medium">{test.label}</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(test.inputs, null, 2)}</pre></details>)}</Surface>
          <Surface pad="lg" className="space-y-3"><h2 className="text-lg font-semibold">Grading criteria</h2><p className="text-sm text-ink-muted">{project.sandbox.passPercent ? `Pass mark: ${project.sandbox.passPercent}%.` : 'Every criterion must pass.'} Each criterion earns its full weight only when all its checks pass.</p><ul className="space-y-3">{project.sandbox.criteria.map(c => <li key={c.id} className="text-sm"><strong>{project.rubric[c.rubricIndex]}</strong><span className="block text-ink-muted">{c.weight} points · {c.objectiveIds.join(', ')}</span></li>)}</ul></Surface>
        </div>
      </div>
      <Surface pad="md" className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} onClick={() => void action('run')}>Run</Button>
        <Button variant="outline" disabled={busy || !enrolled} onClick={() => void action('test')}>Test project</Button>
        <Button variant="outline" disabled={busy || !enrolled || !dirty} onClick={() => void action('save')}>Save draft</Button>
        <Button variant="brand" disabled={busy || !enrolled} onClick={() => void action('submit')}>Submit project</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setConfirm('reset')}>Reset to starter</Button>
        {enrolled && <Button variant="ghost" disabled={busy} onClick={() => setConfirm('reload')}>Reload saved draft</Button>}
        <span className="text-xs text-ink-muted">{busy ? 'Processing…' : dirty ? 'Unsaved changes' : `Saved version ${version}`}</span>
      </Surface>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-brand-ink">{notice}</p>}
      {run && <Surface pad="lg" className="space-y-3"><h2 className="text-lg font-semibold">Run output</h2>{run.error && <p role="alert" className="text-sm text-destructive">{run.error}</p>}<pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-panel-2 p-3 text-sm">{JSON.stringify(run.outputs, null, 2)}</pre><ol className="space-y-1 text-sm">{run.trace.map(step => <li key={step.stepId}>{step.output}: {step.value}</li>)}</ol></Surface>}
      {report && <Surface pad="lg" className="space-y-3" aria-live="polite"><h2 className="text-lg font-semibold">{submittedAt ? 'Submission grade' : 'Test results'}: {report.score}/{report.total} points · {report.passed ? 'Passed' : 'Needs revision'}</h2><ul className="space-y-3">{report.criteria.map(c => <li key={c.id} className="text-sm"><strong>{c.passed ? 'Passed' : 'Revise'}: {project.rubric[c.rubricIndex]}</strong> · {c.earned}/{c.possible}<ul className="mt-1 list-disc pl-5">{c.checks.map((check, i) => <li key={i}>{project.sandbox.tests.find(t => t.id === check.testId)?.label}: {check.passed ? 'passed' : 'not yet'}</li>)}</ul></li>)}</ul>{report.runs.map(r => <details key={r.testId} className="text-sm"><summary className="cursor-pointer">{project.sandbox.tests.find(t => t.id === r.testId)?.label} output</summary>{r.result.error && <p>{r.result.error}</p>}<pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(r.result.outputs, null, 2)}</pre></details>)}</Surface>}
      {submittedPass && (onContinue ? <Button variant="brand" onClick={onContinue}>Continue to final assessment</Button> : <Button asChild variant="brand"><Link href={`/learn/courses/${project.courseId}/finale/final-check`}>Continue to final assessment</Link></Button>)}
    </>}
    <Dialog open={!!confirm} onOpenChange={open => !open && setConfirm(null)}><DialogContent><DialogHeader><DialogTitle>{confirm === 'reset' ? 'Reset this working draft?' : 'Reload the saved draft?'}</DialogTitle><DialogDescription>Your current unsaved edits will be replaced. Recorded submissions remain available on the server.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>Keep editing</Button><Button disabled={busy} onClick={() => void confirmAction()}>Replace working draft</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
