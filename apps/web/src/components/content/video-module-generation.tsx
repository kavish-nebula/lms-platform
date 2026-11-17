'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LessonActivityList } from './lesson-activity-list';
import type { CourseBriefData } from '@/lib/content-creator';
import { moduleReadiness } from '@/lib/module-authoring';
import { correctChoiceIndices } from '@/lib/assessment-answers';
import type { AuthoredCoursePackageData, AuthoredQuestionData } from '@/lib/authored-course';

export function VideoModuleGeneration({ courseId, revision, brief, dirty, moduleId }: { moduleId?: string; courseId?: string; revision?: number; brief: CourseBriefData; dirty: boolean }) {
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [generated, setGenerated] = useState<AuthoredCoursePackageData['modules'][number] | null>(null);
  const [generatedOutdated, setGeneratedOutdated] = useState(false);
  const [selectedId, setSelectedId] = useState(moduleId ?? brief.sourceLibrary?.modules[0]?.id ?? '');
  const selected = moduleId ?? (brief.sourceLibrary?.modules.some(m => m.id === selectedId) ? selectedId : brief.sourceLibrary?.modules[0]?.id ?? '');
  const hasVideo = !!brief.sourceLibrary?.sources.some(s => s.video);
  useEffect(() => {
    if (!courseId || !hasVideo) return;
    const controller = new AbortController();
    void fetch(`/api/v1/content/courses/${courseId}/videos`, { signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const data = await response.json(); const latest = data.modules.find((item: { moduleId: string; outdated: boolean }) => item.moduleId === selected);
      setGenerated(latest?.content ?? null); setGeneratedOutdated(latest?.outdated ?? false);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [courseId, revision, selected, hasVideo]);
  if (!hasVideo || !brief.sourceLibrary) return null;
  const gaps = moduleReadiness(brief, selected);
  const prepared = gaps.length === 0;
  const quizPreview = (questions: AuthoredQuestionData[]) => <ol className="list-decimal space-y-3 pl-5">{questions.map(q => <li key={q.id}><p className="font-medium">{q.prompt}</p><ul className="mt-2 list-disc pl-5">{q.choices.map((choice, i) => <li key={i}>{choice}{correctChoiceIndices(q).includes(i) ? ' (answer key: correct)' : ''}</li>)}</ul><p className="mt-2 text-sm text-ink-muted">Hint: {q.hint}</p><p className="text-sm">Explanation: {q.explanation}</p></li>)}</ol>;
  async function generate(moduleId: string) {
    setBusy(moduleId); setError('');
    try {
      const response = await fetch(`/api/v1/content/courses/${courseId}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate', moduleId, expectedBriefRevision: revision }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Generation failed.'); setGenerated(result.module.content); setGeneratedOutdated(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Generation failed.'); }
    finally { setBusy(''); }
  }
  return <section id="video-modules" className="space-y-4 rounded-xl border border-line bg-panel p-5"><h2 className="text-lg font-semibold">Generate one module from your videos</h2><p className="text-sm text-ink-muted">Save the reviewed transcripts, then create the problem hook, worked examples, guided practice, scenarios, midpoint questions and module-end quiz. The videos stay unchanged. Review the result before course assembly and publication.</p>{dirty && <p className="text-sm">Save your current brief and transcript reviews first.</p>}
    {!moduleId && <div className="space-y-2"><label htmlFor="generation-module" className="block text-sm font-medium">Module workspace</label><select id="generation-module" disabled={!!busy} value={selected} onChange={e => { setSelectedId(e.target.value); setError(''); }} className="min-h-11 w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">{brief.sourceLibrary.modules.map(unit => <option key={unit.id} value={unit.id}>{unit.title || unit.id}</option>)}</select></div>}
    <p className="text-sm text-ink-muted">1. Set module instructions → 2. Map SME sources and upload topic videos → 3. Review transcripts → 4. Generate and review this module. Other modules can remain drafts. Course project, final assessment and reflection are assembled once at course end.</p>
    <LessonActivityList courseId={courseId} revision={revision} moduleId={selected}/>
    {!prepared && <ul aria-label="Selected module preparation gaps" className="list-disc pl-5 text-sm text-ink-muted">{gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>}
    {brief.sourceLibrary.modules.filter(unit => unit.id === selected).map(unit => <div key={unit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"><span>{unit.title || unit.id}</span><Button type="button" disabled={!courseId || dirty || !!busy || !prepared} onClick={() => void generate(unit.id)}>{busy === unit.id ? 'Generating activities…' : 'Generate this module'}</Button></div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {generated?.id === selected && <section className="space-y-3" aria-label="Generated module preview"><h3 className="font-semibold">Generated draft: {generated.title}</h3><p role="status" className="text-sm">{dirty || generatedOutdated ? "This preview uses earlier saved input. Save your changes and regenerate affected activities." : "Module draft saved with versioned instructions and source evidence. Human review is still required."}</p><details open><summary>Problem hook</summary><p>{generated.problemHook.situation}</p><p>{generated.problemHook.question}</p></details><details><summary>Worked examples</summary>{generated.workedExamples.map(e => <div key={e.id}><h4>{e.title}</h4><p>{e.problem}</p><ol className="list-decimal pl-5">{e.reasoning.map((r, i) => <li key={i}>{r}</li>)}</ol><p>{e.result}</p></div>)}</details><details><summary>Guided practice</summary><p>{generated.guidedPractice.instructions}</p><ol className="list-decimal pl-5">{generated.guidedPractice.steps.map(s => <li key={s.id}>{s.instruction}<p>Hint: {s.hint}</p><p>Expected evidence: {s.evidence}</p></li>)}</ol></details><details><summary>Scenario lab</summary>{generated.scenarioLab.scenarios.map(s => <div key={s.id}><h4>{s.title}</h4><p>{s.situation}</p><p>{s.challenge}</p><p>Expected evidence: {s.expectedEvidence}</p></div>)}</details><details><summary>Quizzes and answer keys (creator review)</summary><p>{generated.conceptExplainer.videos.length * 2} midpoint questions · {generated.moduleQuiz?.questions.length} module-end questions</p>{generated.conceptExplainer.videos.map(video => <section key={video.id} className="my-4 space-y-3"><h4 className="font-semibold">{video.title} · midpoint at {Math.round(video.uploadedVideo?.checkpointSeconds ?? 0)} seconds</h4>{quizPreview(video.midpointQuiz.questions)}</section>)}{generated.moduleQuiz && <section className="space-y-3"><h4 className="font-semibold">Module-end quiz</h4>{quizPreview(generated.moduleQuiz.questions)}</section>}</details><Link href={`/content/courses/${courseId}/authoring`} className="text-sm text-brand-ink underline">Continue to course assembly, review and publication →</Link></section>}
  </section>;
}
