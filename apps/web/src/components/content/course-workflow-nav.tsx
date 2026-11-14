import Link from 'next/link';

export function CourseWorkflowNav({ courseId, step, runId, videoFirst = false }: { courseId: string; step: number; runId?: string; videoFirst?: boolean }) {
  const base = `/content/courses/${courseId}`;
  const items = [
    ['Brief and sources', base], [videoFirst ? 'Generate video modules' : 'Blueprint', videoFirst ? `${base}#video-modules` : `${base}/blueprint`],
    [videoFirst ? 'Blueprint and SME review' : 'Review and produce modules', runId ? `${base}/blueprint/review/${runId}` : `${base}/blueprint`],
    ['Assemble, review and publish', `${base}/authoring`],
  ];
  return <nav aria-label="Course creation workflow" className="rounded-xl border border-line bg-panel p-4"><ol className="flex flex-wrap gap-4 text-sm">{items.map(([label, href], i) => <li key={label}><Link href={href} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'font-semibold text-brand-ink underline' : 'text-ink-muted underline'}>{i + 1}. {label}</Link></li>)}</ol><p className="mt-3 text-xs text-ink-muted">{videoFirst ? 'Save brief and module instructions → upload and review topic videos → generate ready modules → review blueprint and teaching → assemble → human approval → publish.' : 'Save sources → generate a blueprint → review modules and create teaching with narration → assemble the complete package → human approval → publish.'}</p></nav>;
}
