'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthoredCoursePackage, COURSE_REVIEW_CHECKS, validateAuthoredCourse, type AuthoredCoursePackageData, type CourseReviewChecklist } from '@/lib/authored-course';
import type { CreatorDraft } from '@/lib/content-creator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedGuard } from '@/lib/use-unsaved-guard';
import { buildCoursePptx, courseDeckSlides } from '@/lib/pptx-export';

type Review = { id: string; version: number; verdict: 'approved' | 'revision_requested'; checklist: CourseReviewChecklist; feedback: string; reviewerName: string; createdAt: string };
type Revision = { id: string; version: number; briefRevision: number; blueprintRunId: string | null; content: AuthoredCoursePackageData; outdated: boolean; createdAt: string; reviews: Review[] };
type State = { course: CreatorDraft; revisions: Revision[]; activeCodexGrants: { id: string; expiresAt: string }[] };
type AudioClip = { slideId: string; key: string; narrationHash: string; seconds: number; reused: boolean };
type AudioJob = { id: string; revisionId: string; status: 'running' | 'ready' | 'failed'; clips: AudioClip[]; error: string | null; attempts: number; current: boolean; createdAt: string };
type AudioState = { configured: boolean; currentRevisionId: string | null; jobs: AudioJob[] };
const labels: Record<keyof CourseReviewChecklist, string> = {
  factualAccuracy: 'I checked factual claims against the SME material and research sources.',
  objectiveCoverage: 'The modules teach the objectives and the course-end gate assesses them.',
  citationsChecked: 'Research citations are relevant and were checked by a human reviewer.',
  teachingSequence: 'Every module follows the five required ILD stages.',
  narrationAndSlides: 'Narration supports the slides and remains clear at the planned pace.',
  assessmentsAndPassRule: 'Midpoint checks are formative; the Mastery Gate has a clear pass rule.',
  accessibilityAndPacing: 'Accessibility and total learning time have been reviewed.',
};
const emptyChecklist: CourseReviewChecklist = { factualAccuracy: false, objectiveCoverage: false, citationsChecked: false, teachingSequence: false, narrationAndSlides: false, assessmentsAndPassRule: false, accessibilityAndPacing: false };
const saveFile = (name: string, data: unknown) => { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
const errText = (body: { error?: { message?: string } }, fallback: string) => body.error?.message ?? fallback;

export function AuthoredCourseWorkspace({ initial }: { initial: State }) {
  const [state, setState] = useState(initial); const head = state.revisions[0];
  const [selectedId, setSelectedId] = useState(head?.id ?? ''); const selected = state.revisions.find(r => r.id === selectedId) ?? head;
  const [editor, setEditor] = useState(selected ? JSON.stringify(selected.content, null, 2) : '');
  const [baseline, setBaseline] = useState(editor); const dirty = editor !== baseline; useUnsavedGuard(dirty);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [tokenConfig, setTokenConfig] = useState(''); const [tokenValue, setTokenValue] = useState(''); const [tokenGrantId, setTokenGrantId] = useState('');
  const [checklist, setChecklist] = useState(emptyChecklist); const [feedback, setFeedback] = useState('');
  const [audioState, setAudioState] = useState<AudioState | null>(null); const [audioBusy, setAudioBusy] = useState(false);
  const endpoint = `/api/v1/content/courses/${state.course.id}/authoring`;
  const parsed = useMemo(() => { try { return AuthoredCoursePackage.safeParse(JSON.parse(editor)); } catch { return { success: false as const, error: null }; } }, [editor]);
  const packageErrors = useMemo(() => {
    if (!parsed.success || !parsed.data) return parsed.success ? ['Package JSON is incomplete.'] : ['Package must be valid JSON and match the editable course structure.'];
    const sourceIds = state.course.brief.sourceText.split(/\n\s*\n/).filter(s => s.trim()).map((_, i) => `S${i + 1}`);
    const objectiveIds = state.course.brief.objectives.map((o, i) => ({ id: `O${i + 1}`, text: o.text })).filter(o => o.text.trim()).map(o => o.id);
    try { validateAuthoredCourse(parsed.data, { objectives: objectiveIds, smeSourceIds: sourceIds, briefRevision: state.course.revision }); return []; }
    catch (e) { return (e instanceof Error ? e.message : 'Package validation failed.').split(/(?<=[.!?])\s+/).slice(0, 12); }
  }, [parsed, state.course]);
  const latestReview = head?.reviews.at(-1);
  const currentAudioJob = audioState?.jobs.find(job => job.revisionId === head?.id);
  const narratedSlides = head?.content.modules.flatMap(module => module.conceptExplainer.videos.flatMap(video => video.slides)) ?? [];

  useEffect(() => {
    const revisionId = head?.id;
    if (!revisionId) return;
    const controller = new AbortController();
    const loadAudio = async () => {
      const response = await fetch(`/api/v1/content/courses/${state.course.id}/authoring/audio?revisionId=${revisionId}`, { cache: 'no-store', signal: controller.signal });
      const next = await response.json(); if (!response.ok) throw new Error(errText(next, 'Could not load narration audio state.'));
      setAudioState(next as AudioState);
    };
    void loadAudio().catch(() => undefined);
    const timer = setInterval(() => void loadAudio().catch(() => undefined), currentAudioJob?.status === 'running' ? 3000 : 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [state.course.id, head?.id, currentAudioJob?.status]);

  async function reload() {
    const response = await fetch(endpoint, { cache: 'no-store' }); const next = await response.json();
    if (!response.ok) throw new Error(errText(next, 'Could not load course package history.'));
    setState(next as State);
    const newest = (next as State).revisions[0]; setSelectedId(newest?.id ?? '');
    const text = newest ? JSON.stringify(newest.content, null, 2) : ''; setEditor(text); setBaseline(text);
  }
  async function save() {
    if (!parsed.success || packageErrors.length || !parsed.data || dirty === false) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedBriefRevision: state.course.revision, expectedVersion: head?.version ?? 0, content: parsed.data }) });
      const result = await response.json(); if (!response.ok) throw new Error(errText(result, 'Could not save the course revision.'));
      setNotice('Saved as a new course package revision. Final human review is pending.'); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your text remains in this editor.'); }
    finally { setBusy(false); }
  }
  async function connect() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/v1/content/courses/${state.course.id}/codex-connection`, { method: 'POST' }); const grant = await response.json();
      if (!response.ok) throw new Error(errText(grant, 'Could not create the Codex connection.'));
      const url = `${window.location.origin}/api/mcp/ild-course-creator`;
      const config = `[mcp_servers.lms_ild_course_creator]\nurl = ${JSON.stringify(url)}\nbearer_token_env_var = "LMS_ILDCREATOR_TOKEN"`;
      setTokenConfig(config); setTokenValue(grant.token); setTokenGrantId(grant.id); setNotice(`Connection token created. It expires ${new Date(grant.expiresAt).toLocaleString()}. Configure the token and MCP server in Codex, then restart Codex.`); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect Codex.'); }
    finally { setBusy(false); }
  }
  async function revoke() {
    const grantId = tokenGrantId || state.activeCodexGrants[0]?.id;
    if (!grantId) return; setBusy(true); setError('');
    try { const response = await fetch(`/api/v1/content/courses/${state.course.id}/codex-connection`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantId }) }); const result = await response.json(); if (!response.ok) throw new Error(errText(result, 'Could not revoke the token.')); setTokenConfig(''); setTokenValue(''); setTokenGrantId(''); setNotice('Codex connection revoked.'); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not revoke token.'); } finally { setBusy(false); }
  }
  async function review(verdict: 'approved' | 'revision_requested') {
    if (!head || head.outdated || dirty) return; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${endpoint}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId: head.id, expectedReviewVersion: latestReview?.version ?? 0, verdict, checklist, feedback }) });
      const result = await response.json(); if (!response.ok) throw new Error(errText(result, 'Could not save final review.'));
      setNotice(verdict === 'approved' ? 'Final review approved for this exact draft revision. You can now publish it to learners.' : 'Revision request recorded for this exact draft revision.'); setChecklist(emptyChecklist); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the review.'); } finally { setBusy(false); }
  }
  async function publish() {
    if (!head || head.outdated || dirty || latestReview?.verdict !== 'approved') return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${endpoint}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId: head.id, reviewId: latestReview.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(errText(result, 'Could not publish this revision.'));
      setNotice('This approved revision is now available in the learner course catalog.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not publish this revision.'); }
    finally { setBusy(false); }
  }
  async function generateAudio() {
    if (!head || head.outdated || dirty || audioBusy || currentAudioJob?.status === 'ready' || currentAudioJob?.status === 'running') return;
    setAudioBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/v1/content/courses/${state.course.id}/authoring/audio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId: head.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(errText(result, 'Could not start local narration.'));
      setNotice(result.started ? 'Local Kokoro narration started. Saved clips will appear as each slide finishes.' : 'Audio for this script revision is already processing or ready.');
      const latest = await fetch(`/api/v1/content/courses/${state.course.id}/authoring/audio?revisionId=${head.id}`, { cache: 'no-store' }); setAudioState(await latest.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate narration audio.'); } finally { setAudioBusy(false); }
  }
  function selectRevision(id: string) { if (dirty && !window.confirm('Discard unsaved editor text and open the selected saved revision?')) return; const revision = state.revisions.find(r => r.id === id); if (!revision) return; setSelectedId(id); const text = JSON.stringify(revision.content, null, 2); setEditor(text); setBaseline(text); }
  async function downloadContext() {
    setError(''); try { const response = await fetch(`/api/v1/content/courses/${state.course.id}/codex-context`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(errText(data, 'Could not prepare the SME context.')); saveFile(`${state.course.brief.title || 'course'}-codex-context.json`, data.context); setNotice('Downloaded the saved SME context. Keep its source IDs unchanged when drafting.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not export context.'); }
  }
  function downloadDeck() {
    if (!head || head.outdated || dirty) return;
    const bytes = buildCoursePptx(head.content); const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${head.content.title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'course'}-course.pptx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) { if (!file) return; setError(''); try { const text = await file.text(); JSON.parse(text); setEditor(text); setNotice('Imported JSON into the editor. Review the validation results before saving.'); } catch { setError('The selected file is not valid JSON. The existing editor text was retained.'); } }

  return <div className="space-y-7">
    <header className="space-y-3"><Link href={`/content/courses/${state.course.id}`} className="text-sm text-brand-ink underline">← SME input</Link><p className="text-sm text-brand-ink">Codex-assisted course authoring</p><h1 className="text-3xl font-semibold">Build the full course from the SME brief</h1><p className="max-w-3xl text-ink-muted">Codex reads the saved brief and source notes, drafts the editable course package, then saves it here as a versioned draft. It does not publish to learners.</p><p className="rounded-lg border border-line bg-panel px-4 py-3 text-sm">This workspace currently uses the shared local demo identity. The expiring token scopes Codex to this course, but is not production authentication or tenant isolation.</p></header>

    <section className="grid gap-4 lg:grid-cols-[1fr_auto] rounded-xl border border-line bg-panel p-5">
      <div className="space-y-2"><h2 className="text-xl font-semibold">Connect your local Codex</h2><p className="text-sm text-ink-muted">Create an eight-hour token, add the MCP snippet to your Codex <code>config.toml</code>, set its environment variable, then restart Codex and ask it to use <code>course-creation</code>. This coordinator runs the learner-profiling, lesson-generation, quiz-generation, mini-project-generation and course-quality-review skills in the same chat. The connection only exposes this saved course brief and its draft package.</p><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void connect()}>{state.activeCodexGrants.length ? 'Create a new token' : 'Connect Codex'}</Button>{state.activeCodexGrants.length > 0 && <Button variant="outline" disabled={busy} onClick={() => void revoke()}>Revoke active token</Button>}<Button variant="outline" disabled={busy} onClick={() => void downloadContext()}>Download SME context</Button>{state.activeCodexGrants.length > 0 && <span className="self-center text-xs text-ink-muted">Active until {new Date(state.activeCodexGrants[0].expiresAt).toLocaleString()}</span>}</div></div>
      <p className="max-w-xs text-xs text-ink-muted">A new token revokes earlier course tokens. The full token appears once; keep it private and do not commit it.</p>
      {tokenConfig && <div className="space-y-3 lg:col-span-2"><label htmlFor="codex-mcp-config" className="block text-sm font-medium">Add this MCP server entry to your Codex <code>config.toml</code></label><Textarea id="codex-mcp-config" rows={3} readOnly value={tokenConfig} onFocus={e => e.currentTarget.select()} /><label htmlFor="codex-token-setup" className="block text-sm font-medium">Set the one-time token in Windows PowerShell</label><Textarea id="codex-token-setup" rows={2} readOnly value={`setx LMS_ILDCREATOR_TOKEN "${tokenValue}"`} onFocus={e => e.currentTarget.select()} /><p className="text-xs text-ink-muted">Run the command, add the config snippet, then restart Codex so it can read the saved environment variable. The token expires after eight hours and is not stored in the config file.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => void navigator.clipboard.writeText(tokenConfig).then(() => setNotice('MCP configuration copied.'))}>Copy configuration</Button><Button variant="outline" onClick={() => void navigator.clipboard.writeText(`setx LMS_ILDCREATOR_TOKEN "${tokenValue}"`).then(() => setNotice('Token setup command copied.'))}>Copy token setup command</Button><Button variant="outline" onClick={() => void revoke()} disabled={busy}>Revoke token</Button></div></div>}
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="space-y-4 rounded-xl border border-line bg-panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Editable course package</h2><p className="text-xs text-ink-muted">JSON is validated before saving. Each save creates an immutable revision.</p></div><div className="flex flex-wrap gap-2"><label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-line px-3 text-sm focus-within:outline-2 focus-within:outline-ring">Import JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={e => void importFile(e.target.files?.[0])} /></label>{head && <Button variant="outline" onClick={() => saveFile(`${head.content.title || 'course'}-revision-${head.version}.json`, head.content)}>Download package JSON</Button>}</div></div>
        {state.revisions.length > 0 && <label className="block space-y-2 text-sm">Saved revision<select className="block min-h-11 w-full rounded-lg border border-input bg-background px-3" value={selected?.id ?? ''} onChange={e => selectRevision(e.target.value)}>{state.revisions.map(r => <option key={r.id} value={r.id}>Revision {r.version}{r.outdated ? ' · outdated' : ''} · {new Date(r.createdAt).toLocaleString()}</option>)}</select></label>}
        <label htmlFor="course-package-json" className="block text-sm font-medium">Paste or edit the Codex course package</label><Textarea id="course-package-json" spellCheck={false} className="min-h-[28rem] font-mono text-xs leading-5" value={editor} readOnly={!!selected && (selected.id !== head?.id || selected.outdated)} onChange={e => setEditor(e.target.value)} placeholder="Connect Codex, then ask it to read the SME context and save a full course package. You can also paste a JSON package here." />
        {packageErrors.length > 0 && <div className="rounded-lg border border-destructive/40 p-3 text-sm"><p className="font-medium">Package needs attention</p><ul className="mt-2 list-disc space-y-1 pl-5">{packageErrors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
        <div className="flex flex-wrap items-center gap-3"><Button disabled={busy || !dirty || packageErrors.length > 0 || !!selected && (selected.id !== head?.id || selected.outdated)} onClick={() => void save()}>{busy ? 'Saving…' : 'Save as new revision'}</Button>{head && <Button variant="outline" disabled={busy || dirty || head.outdated || !parsed.success} onClick={() => downloadDeck()}>Download PowerPoint deck</Button>}<span className="text-xs text-ink-muted">SME revision {state.course.revision} · Current package {head?.version ?? 'not saved'}</span></div>
      </div>
      <div className="space-y-4">
        <section className="space-y-3 rounded-xl border border-line bg-panel p-5"><h2 className="text-xl font-semibold">Course preview</h2>{parsed.success && parsed.data ? <><h3 className="text-lg font-medium">{parsed.data.title}</h3><p className="text-sm text-ink-muted">{parsed.data.modules.length} modules · {parsed.data.durationMinutes} planned minutes · {parsed.data.sources.length} cited sources · {courseDeckSlides(parsed.data).length} PowerPoint slides</p><ol className="space-y-3">{parsed.data.modules.map((m, i) => <li key={m.id} className="rounded-lg border border-line p-3"><h4 className="font-semibold">{i + 1}. {m.title}</h4><p className="text-xs text-ink-muted">{m.durationMinutes} minutes · {m.objectiveIds.join(', ')}</p><ol className="mt-2 list-inside list-decimal text-sm"><li>{m.problemHook.title}</li><li>Concept Explainer · {m.conceptExplainer.videos.length} videos · {m.conceptExplainer.videos.reduce((n, v) => n + v.slides.length, 0)} slides · {m.conceptExplainer.videos.reduce((n, v) => n + v.midpointQuiz.questions.length, 0)} midpoint questions</li><li>Worked Example · {m.workedExamples.length} examples</li><li>Guided Practice · {m.guidedPractice.steps.length} steps</li><li>Scenario Lab · {m.scenarioLab.scenarios.length} scenarios</li>{m.moduleQuiz && <li>Module Quiz · {m.moduleQuiz.questions.length} questions · {m.moduleQuiz.questions.filter(q => q.selectionType === 'multiple').length} select-all · {m.moduleQuiz.passPercent ?? parsed.data!.courseEnd.masteryGate.passPercent}% pass rule</li>}</ol></li>)}</ol><div className="rounded-lg border border-brand-line bg-brand-soft p-3 text-sm"><strong>After the final module:</strong> {parsed.data.courseEnd.miniProject.title} → {parsed.data.courseEnd.masteryGate.title} ({parsed.data.courseEnd.masteryGate.passPercent}% pass rule) → Reflection</div>{parsed.data.courseEnd.miniProject.sandbox && <p className="text-sm text-ink-muted">In-course practical sandbox · {parsed.data.courseEnd.miniProject.sandbox.fields.length} artifact fields · {parsed.data.courseEnd.miniProject.sandbox.tests.length} test cases · {parsed.data.courseEnd.miniProject.sandbox.criteria.length} graded criteria</p>}</> : <p className="text-sm text-ink-muted">Preview appears when a valid package is in the editor.</p>}<p className="border-t border-line pt-3 text-xs text-ink-muted">This preview and package validator cannot verify facts, citations, teaching quality or accessibility. Human review is required.</p></section>

        {head && !head.outdated && <section className="space-y-4 rounded-xl border border-line bg-panel p-5"><div><h2 className="text-xl font-semibold">Final human review</h2><p className="mt-1 text-sm text-ink-muted">Review applies only to saved revision {head.version}. Editing or changing the SME brief creates a new review target. Approval does not publish the course.</p></div>{latestReview && <p role="status" className="text-sm">Latest decision: {latestReview.verdict.replaceAll('_', ' ')} · {latestReview.reviewerName}</p>}<fieldset className="space-y-3"><legend className="text-sm font-medium">Confirm before approval</legend>{COURSE_REVIEW_CHECKS.map(key => <label key={key} className="flex items-start gap-3 text-sm"><input className="mt-1 size-4 accent-brand" type="checkbox" checked={checklist[key]} onChange={e => setChecklist(old => ({ ...old, [key]: e.target.checked }))} /><span>{labels[key]}</span></label>)}</fieldset><label htmlFor="course-review-feedback" className="block text-sm font-medium">Review notes</label><Textarea id="course-review-feedback" rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Required when requesting revisions" /><div className="flex flex-wrap gap-2"><Button disabled={busy || Object.values(checklist).some(value => !value)} onClick={() => void review('approved')}>Approve this course revision</Button><Button variant="outline" disabled={busy || !feedback.trim()} onClick={() => void review('revision_requested')}>Request revisions</Button></div><div className="flex flex-wrap items-center gap-3"><Button disabled={busy || dirty || latestReview?.verdict !== 'approved'} onClick={() => void publish()}>Publish approved revision</Button><Link className="text-sm underline" href={`/learn/courses/${state.course.id}`}>Open learner course</Link></div><p className="text-xs text-ink-muted">Publication pins this exact approved revision in the learner catalog. Later draft edits require a new approval and publication.</p></section>}

        {head && !head.outdated && <section className="space-y-4 rounded-xl border border-line bg-panel p-5"><div><h2 className="text-xl font-semibold">Narration audio</h2><p className="mt-1 text-sm text-ink-muted">Generate matching local Kokoro WAV audio from the saved narration scripts. Audio is tied to revision {head.version}; unchanged narration is reused in later revisions.</p></div><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={!audioState?.configured || audioBusy || dirty || currentAudioJob?.status === 'ready' || currentAudioJob?.status === 'running'} onClick={() => void generateAudio()}>{audioBusy ? 'Starting…' : currentAudioJob?.status === 'running' ? 'Generating audio…' : currentAudioJob?.status === 'ready' ? 'Audio ready' : currentAudioJob?.status === 'failed' ? 'Retry missing audio' : 'Generate narration audio'}</Button><span className="text-xs text-ink-muted">{audioState?.configured ? `${currentAudioJob?.clips.length ?? 0} of ${narratedSlides.length} clips saved` : 'Local speech service is disabled or unavailable.'}</span></div>{currentAudioJob?.error && <p role="alert" className="text-sm text-destructive">{currentAudioJob.error}</p>}{currentAudioJob?.clips.length ? <ol className="space-y-3">{narratedSlides.filter(slide => currentAudioJob.clips.some(clip => clip.slideId === slide.id)).map(slide => { const clip = currentAudioJob.clips.find(item => item.slideId === slide.id)!; return <li key={slide.id} className="space-y-2 rounded-lg border border-line p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{slide.title}</strong><span className="text-xs text-ink-muted">{Math.ceil(clip.seconds)} seconds{clip.reused ? ' · reused' : ''}</span></div><audio controls preload="none" className="w-full" src={`/api/v1/content/courses/${state.course.id}/authoring/audio/${head.id}/${encodeURIComponent(slide.id)}`} /></li>; })}</ol> : <p className="text-sm text-ink-muted">No audio generated for this saved revision yet. Script edits create new revision-bound audio; historical clips remain available with their revision.</p>}</section>}
      </div>
    </section>
    {(notice || error) && <div aria-live="polite" role={error ? 'alert' : 'status'} className={error ? 'rounded-lg border border-destructive/40 p-3 text-sm text-destructive' : 'rounded-lg border border-brand-line bg-brand-soft p-3 text-sm text-brand-ink'}>{error || notice}</div>}
  </div>;
}
