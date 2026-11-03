import Link from 'next/link';

export function CourseWorkflowNav({ courseId, step, runId }: { courseId: string; step: number; runId?: string }) {
  const base = `/content/courses/${courseId}`;
  const items = [
    ['Brief and sources', base], ['Blueprint', `${base}/blueprint`],
    ['Review and produce modules', runId ? `${base}/blueprint/review/${runId}` : `${base}/blueprint`],
    ['Assemble, review and publish', `${base}/authoring`],
  ];
  return <nav aria-label="Course creation workflow" className="rounded-xl border border-line bg-panel p-4"><ol className="flex flex-wrap gap-4 text-sm">{items.map(([label, href], i) => <li key={label}><Link href={href} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'font-semibold text-brand-ink underline' : 'text-ink-muted underline'}>{i + 1}. {label}</Link></li>)}</ol><p className="mt-3 text-xs text-ink-muted">Save sources → generate a blueprint → review modules and create teaching with narration → assemble the complete package → human approval → publish.</p></nav>;
}
