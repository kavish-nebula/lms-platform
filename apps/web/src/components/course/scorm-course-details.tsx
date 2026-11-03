import Link from 'next/link';
import { Surface } from '@/components/kit/surface';
import { Button } from '@/components/ui/button';
import type { ScormImport } from '@/lib/scorm-topic';
export function ScormCourseDetails({ rows }: { rows: ScormImport[] }) {
  const first = rows[0]!;
  return <div className="space-y-6"><Link className="text-brand-ink underline" href="/learn/courses">← All courses</Link><header className="space-y-3"><h1 className="text-3xl font-semibold">{first.source.courseName === 'AIforProduction' ? 'AI for Production' : first.source.courseName}</h1><p className="text-ink-muted">Learner pilot · Teaching from SCORM Builder, personalized for your profile.</p><p className="text-sm text-ink-muted">Imported source drafts are available for this pilot. This is not a completed or approved full-course release.</p></header>
    {first.hierarchy.map(m => <Surface key={m.num} pad="lg" className="space-y-5"><h2 className="text-2xl font-semibold">Module {m.num}</h2>{m.topics.map(t => { const row = rows.find(r => r.topicId === t.topicId); return <section key={t.topicId} className="space-y-3 border-t border-line pt-4"><h3 className="text-lg font-semibold">{t.title}</h3><p className="text-sm text-ink-muted">{t.topicId}{row ? ` · Source v${row.source.sourceVersion} · ${row.source.status}` : ' · Not imported yet'}</p>{row && <><ul className="list-disc space-y-1 pl-5">{row.source.objectives.map(o => <li key={o}>{o}</li>)}</ul><div className="flex flex-wrap gap-3"><Button asChild variant="brand"><Link href={`/learn/courses/${row.courseId}/enroll`}>Set up personalized learning</Link></Button><Button asChild variant="outline"><Link href={`/learn/courses/${row.courseId}/M${m.num}/explainer?v=${encodeURIComponent(`${row.topicId}-${row.source.concepts[0]!.sub_concepts[0]!.id}-p1`)}`}>Open lessons</Link></Button></div></>}</section>; })}</Surface>)}
    {first.courseId === 'ai-for-production' && <Link className="text-brand-ink underline" href="/learn/imported/ai-for-production/M1">Open original M1-T1 SCORM package</Link>}
    <p className="text-sm text-ink-muted">The original package and its saved progress remain available. External tasks, the guided project and the full-course final are not part of this lesson pilot.</p>
  </div>;
}
