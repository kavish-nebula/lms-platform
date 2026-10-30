'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, ArrowRight, Check, CirclePlay, LockKeyhole, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Surface } from '@/components/kit/surface';
import { api } from '@/lib/api';
import { useEnrollment } from '@/lib/enrollment';
import { useFinale } from '@/lib/finale';
import { useUnsavedGuard } from '@/lib/use-unsaved-guard';
import { runSandbox, type SandboxRun } from '@/lib/project-sandbox';
import type { GuidedReport, GuidedWork } from '@/lib/guided-project';
import type { PublicSandboxProject } from '@/server/project-sandbox';
import { GuidedWorkflowCanvas } from './guided-workflow-canvas';
import './guided-project.css';

export function GuidedProjectWorkspace({ project }: { project: PublicSandboxProject }) {
  const guided = project.sandbox.guided!;
  const { enrolled, ready } = useEnrollment(project.courseId);
  const { markDone, state } = useFinale(project.courseId);
  const endpoint = `/api/v1/enrollments/${project.courseId}/guided-project`;
  const { data, error: loadError, isLoading, mutate } = useSWR<{ work: GuidedWork }>(enrolled ? `${endpoint}?revisionId=${project.revisionId}` : null, (url: string) => api(url), { revalidateOnFocus: false });
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [index, setIndex] = React.useState(0);
  const [version, setVersion] = React.useState(0);
  const [runCases, setRunCases] = React.useState<string[]>([]);
  const [caseId, setCaseId] = React.useState(project.sandbox.tests[0]!.id);
  const [runs, setRuns] = React.useState<Record<string, SandboxRun>>({});
  const [report, setReport] = React.useState<GuidedReport | null>(null);
  const [submittedAt, setSubmittedAt] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [mobilePanel, setMobilePanel] = React.useState<'explore' | 'results'>('explore');
  const initialized = React.useRef(false);
  const heading = React.useRef<HTMLHeadingElement>(null);
  useUnsavedGuard(dirty);

  const restore = React.useCallback((work: GuidedWork) => {
    setAnswers(work.answers); setVersion(work.version); setRunCases(work.runCaseIds);
    setIndex(Math.max(0, guided.stages.findIndex(s => s.id === work.stageId)));
    setReport(work.report); setSubmittedAt(work.submittedAt); setDirty(false);
    // Only previously recorded runs are replayed for display; this creates no new run evidence.
    setRuns(Object.fromEntries(work.runCaseIds.map(id => [id, runSandbox(guided.artifact, project.sandbox.tests.find(t => t.id === id)!.inputs)])));
  }, [guided, project.sandbox.tests]);
  React.useEffect(() => { if (data && !initialized.current) { restore(data.work); initialized.current = true; } }, [data, restore]);
  React.useEffect(() => { if (submittedAt && report?.passed && !state.done.includes('capstone')) markDone('capstone', { capstoneAt: submittedAt }); }, [submittedAt, report?.passed, state.done, markDone]);

  const stage = guided.stages[index]!;
  const test = project.sandbox.tests.find(t => t.id === caseId)!;
  const run = runs[caseId];
  const prompts = guided.prompts.filter(p => stage.promptIds.includes(p.id));
  const steps = guided.artifact.steps.filter(s => stage.stepIds.includes(s.id));
  const answered = guided.prompts.filter(p => answers[p.id]?.trim()).length;
  const complete = answered === guided.prompts.length && runCases.length === project.sandbox.tests.length;
  const locked = busy || !enrolled || !initialized.current || !!loadError;

  async function action(action: 'save' | 'run' | 'submit', stageId = stage.id) {
    if (locked) return false;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ work: GuidedWork; run?: SandboxRun; caseId?: string }>(endpoint, { method: 'POST', body: { revisionId: project.revisionId, version, action, stageId, answers, ...(action === 'run' ? { caseId } : {}) } });
      setVersion(result.work.version); setRunCases(result.work.runCaseIds); setReport(result.work.report); setSubmittedAt(result.work.submittedAt); setDirty(false);
      if (result.run && result.caseId) setRuns(old => ({ ...old, [result.caseId!]: result.run! }));
      await mutate({ work: result.work }, { revalidate: false });
      setMessage(action === 'run' ? 'Example run complete. Inspect the results beside the workflow.' : action === 'submit' ? 'Explanations submitted. Review the concept-check feedback below.' : 'Explanations and your place in the project are saved.');
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your explanations are still here.'); return false; }
    finally { setBusy(false); }
  }
  async function go(next: number) {
    if (next < 0 || next >= guided.stages.length || busy) return;
    if (enrolled && !await action('save', guided.stages[next]!.id)) return;
    setIndex(next); setMobilePanel('explore');
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function reload() {
    if (dirty && !window.confirm('Reload saved explanations? Your unsaved text will be replaced.')) return;
    setBusy(true);
    try { const result = await api<{ work: GuidedWork }>(`${endpoint}?revisionId=${project.revisionId}`); restore(result.work); initialized.current = true; setError(''); await mutate(result, { revalidate: false }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not reload. Your text is retained.'); }
    finally { setBusy(false); }
  }

  return <div className="guided-project">
    <header className="guided-project-header">
      <Link className="guided-project-back" href={`/learn/courses/${project.courseId}/finale/capstone`}><ArrowLeft size={18} aria-hidden />Course project</Link>
      <div><p className="text-sm text-ink-muted">Guided exploration</p><p className="font-semibold">{project.title}</p></div>
      <span className="guided-readonly"><LockKeyhole size={14} aria-hidden />Read-only workflow</span>
    </header>
    <div className="guided-project-body">
      <aside className="guided-project-outline">
        <p className="font-semibold">Your exploration</p>
        <p className="mb-5 mt-1 text-xs text-ink-muted">{answered} of {guided.prompts.length} explanations written</p>
        <nav aria-label="Project exploration steps"><ol>{guided.stages.map((s, i) => <li key={s.id}><button disabled={busy} aria-current={i === index ? 'step' : undefined} onClick={() => void go(i)}><span className="guided-step-number">{i + 1}</span><span>{s.title}</span>{s.promptIds.length > 0 && s.promptIds.every(id => answers[id]?.trim()) && <Check size={15} aria-label="Explanation written" />}</button></li>)}</ol></nav>
        <p className="mt-5 text-xs text-ink-muted">Writing an answer marks progress. Submission checks your explanations separately.</p>
      </aside>
      <div className="guided-mobile-switch" aria-label="Workspace view"><Button variant={mobilePanel === 'explore' ? 'default' : 'outline'} aria-pressed={mobilePanel === 'explore'} onClick={() => setMobilePanel('explore')}>Explore & explain</Button><Button variant={mobilePanel === 'results' ? 'default' : 'outline'} aria-pressed={mobilePanel === 'results'} onClick={() => setMobilePanel('results')}>Examples & results</Button></div>
      <GuidedWorkflowCanvas artifact={guided.artifact} activeIds={stage.stepIds} run={run} disabled={locked} onInspect={stepId => { const next = guided.stages.findIndex(s => s.stepIds.includes(stepId)); if (next >= 0) void go(next); }} />
      <div className="guided-project-inspector">
      <main className="guided-project-main" data-mobile-hidden={mobilePanel !== 'explore'}>
        <p className="text-sm text-brand-ink">Step {index + 1} of {guided.stages.length}</p>
        <h1 ref={heading} tabIndex={-1} className="guided-project-title">{stage.title}</h1>
        <p className="guided-project-instruction">{stage.instruction}</p>
        {!enrolled && ready && <p className="guided-notice"><Link className="underline" href={`/learn/courses/${project.courseId}/enroll`}>Enroll in the course</Link> to run examples and save your explanations.</p>}
        {isLoading && <p role="status">Loading your saved explanations…</p>}
        {loadError && <p role="alert" className="text-destructive">Could not load saved explanations. Reload the saved copy before continuing.</p>}
        {steps.length > 0 && <section aria-label="Ready-made workflow steps" className="guided-workflow"><div className="flex items-center justify-between"><h2 className="font-semibold">What the workflow does</h2><span className="text-xs text-ink-muted">Already built</span></div><ol>{steps.map(step => <li key={step.id} className="guided-operation"><div className="flex items-center justify-between gap-3"><strong>{step.output}</strong><span className="guided-operation-label">{step.operation}</span></div><code>{step.expression}</code>{[...step.expression.matchAll(/input\.([A-Za-z][A-Za-z0-9_-]*)/g)].map(match => <div className="guided-operation-result" key={match[1]}><span>Input · {match[1]}</span><code>{JSON.stringify(test.inputs[match[1]!])}</code></div>)}<div className="guided-operation-result"><span>Result</span><code>{run ? JSON.stringify(run.outputs[step.output]) : 'Run an example to see the result'}</code></div></li>)}</ol></section>}
        {steps.length === 0 && index === 0 && <Surface pad="md" className="space-y-3"><h2 className="font-semibold">A messy record becomes a clear review card</h2><p className="text-sm text-ink-muted">Follow the complete workflow from padded names and mixed-case labels to a readable summary and planning quantity.</p><p className="text-sm">You will inspect the transformations, run two supplied examples, and explain the differences. Everything happens inside the course.</p><Button variant="outline" onClick={() => { setMobilePanel('results'); requestAnimationFrame(() => document.getElementById('guided-example')?.focus()); }}>View the supplied examples</Button></Surface>}
        {prompts.map(prompt => <section key={prompt.id} className="guided-explanation"><label htmlFor={`answer-${prompt.id}`} className="font-semibold">{prompt.label}</label><p id={`help-${prompt.id}`} className="mt-2 text-sm text-ink-muted">Explain the observed result and why it happens. At least {prompt.minWords} words.</p><Textarea id={`answer-${prompt.id}`} aria-describedby={`help-${prompt.id}`} rows={4} maxLength={4000} disabled={locked} value={answers[prompt.id] ?? ''} onChange={e => { setAnswers(old => ({ ...old, [prompt.id]: e.target.value })); setDirty(true); setReport(null); setSubmittedAt(null); setMessage(''); }} /><div className="flex justify-between gap-3"><details className="text-sm"><summary>Need a hint?</summary><p className="mt-2 text-ink-muted">{prompt.hint}</p></details><span className="text-xs text-ink-muted">{answers[prompt.id]?.trim().split(/\s+/).filter(Boolean).length ?? 0} words</span></div></section>)}
        {index === guided.stages.length - 1 && <Surface pad="md" className="space-y-3"><h2 className="font-semibold">Review before submitting</h2><p>{runCases.length}/{project.sandbox.tests.length} examples run · {answered}/{guided.prompts.length} explanations written</p><p className="text-sm text-ink-muted">Every explanation must meet its length and concept checks, and both examples must be run. Automated phrase checks do not replace a human assessment of reasoning quality.</p><Button variant="brand" disabled={locked || !complete} onClick={() => void action('submit')}>Submit explanations</Button></Surface>}
        {report && index === guided.stages.length - 1 && <section className="guided-feedback" aria-label="Submission feedback"><h2 className="font-semibold">{report.passed ? 'Exploration complete' : 'Review your explanations'} · {report.score}/{report.total} points</h2><ul>{report.criteria.map(c => <li key={c.id}><strong>{c.passed ? 'Meets checks' : 'Revisit'}: {c.label}</strong><p>{c.feedback}</p></li>)}</ul>{submittedAt && report.passed && <Button asChild variant="brand"><Link href={`/learn/courses/${project.courseId}/finale/final-check`}>Continue to final assessment<ArrowRight aria-hidden /></Link></Button>}</section>}
      </main>
      <aside className="guided-project-results" data-mobile-hidden={mobilePanel !== 'results'} aria-label="Examples and results">
        <h2 className="font-semibold">Run an example</h2>
        <label className="mt-4 block text-sm" htmlFor="guided-example">Supplied example</label>
        <select id="guided-example" className="guided-select" value={caseId} disabled={busy} onChange={e => setCaseId(e.target.value)}>{project.sandbox.tests.map(t => <option key={t.id} value={t.id}>{t.label}{runCases.includes(t.id) ? ' · run' : ''}</option>)}</select>
        <details className="guided-inputs"><summary>Inspect the input data</summary><dl>{Object.entries(test.inputs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd><code>{JSON.stringify(value)}</code></dd></div>)}</dl></details>
        <Button className="mt-4 w-full" variant="brand" disabled={locked} onClick={() => void action('run')}><CirclePlay aria-hidden />{busy ? 'Processing…' : 'Run example'}</Button>
        <div className="guided-output"><h3 className="font-semibold">{run ? 'Observed results' : 'Your results appear here'}</h3>{run ? <dl>{run.trace.filter(s => !steps.length || stage.stepIds.includes(s.stepId)).map(s => <div key={s.stepId}><dt>{s.output}</dt><dd>{JSON.stringify(s.value)}</dd></div>)}</dl> : <p className="mt-2 text-sm text-ink-muted">Run this example to see the workflow’s output. You can switch examples at any step.</p>}</div>
        <p className="mt-5 text-xs text-ink-muted">Simulation only. Nothing is sent, reserved or changed outside this course.</p>
      </aside>
      </div>
    </div>
    <footer className="guided-project-footer">
      <div className="guided-save-state"><span role="status" aria-live="polite">{busy ? 'Saving…' : dirty ? 'Unsaved explanations' : 'All changes saved'}</span><Button variant="ghost" size="sm" disabled={locked || !dirty} onClick={() => void action('save')}>Save explanations</Button><Button variant="ghost" size="sm" disabled={busy || !enrolled} onClick={() => void reload()}><RotateCcw aria-hidden />Reload saved copy</Button></div>
      <div className="flex gap-3"><Button variant="outline" disabled={busy || index === 0} onClick={() => void go(index - 1)}><ArrowLeft aria-hidden />Back</Button><Button variant="brand" disabled={busy || index === guided.stages.length - 1 || (enrolled && !initialized.current)} onClick={() => void go(index + 1)}>Continue<ArrowRight aria-hidden /></Button></div>
      {(error || message) && <p className={error ? 'guided-status text-destructive' : 'guided-status text-ink-muted'} role={error ? 'alert' : 'status'}>{error || message}</p>}
    </footer>
  </div>;
}
