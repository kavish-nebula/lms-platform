'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LessonActivityDraft } from '@/lib/lesson-activities';

export function LessonActivityList({ courseId, revision, moduleId }: { courseId?: string; revision?: number; moduleId?: string }) {
  const [items, setItems] = useState<LessonActivityDraft[]>([]); const [error, setError] = useState('');
  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();
    void fetch(`/api/v1/content/courses/${courseId}/lesson-activities`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load saved teaching activities. Refresh to retry.');
      const data = await response.json(); setItems(data.activities); setError('');
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load activities.'); });
    return () => controller.abort();
  }, [courseId, revision]);
  const visible = items.filter(item => !moduleId || item.moduleId === moduleId);
  if (!visible.length && !error) return null;
  return <section aria-label="Saved teaching activities" className="space-y-3 rounded-xl border border-brand-line bg-brand-soft p-4"><h3 className="font-semibold">Problem hook, worked examples and guided practice</h3><p className="text-sm text-ink-muted">Open the step-by-step creator preview. These drafts remain separate from approved course content.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{visible.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel p-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-ink-muted">{item.outdated ? 'Earlier brief — reconciliation required' : 'Draft — human review pending'} · {item.content.workedExamples.length} examples · {item.content.guidedPractice.steps.length} practice steps</p></div><Link className="text-sm font-medium text-brand-ink underline" href={`/content/courses/${courseId}/activities/${item.id}`}>Open activity preview →</Link></div>)}</section>;
}
