import Link from 'next/link';

export function CourseWorkflowNav({ courseId, step, runId, videoFirst = false }: { courseId: string; step: number; runId?: string; videoFirst?: boolean }) {
  const base = `/content/courses/${courseId}`;
  const items = [
    ['Brief and sources', base], ['Blueprint', `${base}/blueprint`],
    ['Module review', runId ? `${base}/blueprint/review/${runId}` : `${base}/blueprint/review`],
    ['Produce lessons', `${base}/production`],
    ['Review and publish', `${base}/authoring`],
  ];
  return <nav aria-label="Course creation workflow" className="creator-workflow rounded-xl border border-line bg-panel"><ol className="text-sm">{items.map(([label, href], i) => <li key={label}><Link href={href} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'font-semibold text-brand-ink' : 'text-ink-muted'}><span className="creator-workflow-number" aria-hidden>{i + 1}</span><span><span className="sr-only">Stage {i + 1}: </span>{label}</span></Link></li>)}</ol><p className="text-xs text-ink-muted">{videoFirst ? 'Review recordings and transcripts in Stage 1. The same five stages apply to recorded videos and narrated lessons.' : 'Prepare sources, generate a blueprint, review each module, produce its lessons, then review and publish the complete course.'}</p></nav>;
}
