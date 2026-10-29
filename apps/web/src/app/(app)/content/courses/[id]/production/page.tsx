import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/server/auth';
import { getCreatorDraft } from '@/server/content-creator';
import { listBlueprints } from '@/server/creator-blueprints';
import { getSmeReview } from '@/server/creator-sme-review';
import { ApiError } from '@/server/http';
import { Button } from '@/components/ui/button';

export default async function CourseProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params;
  let course;
  try { course = await getCreatorDraft(user.id, id); } catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
  const runs = await listBlueprints(user.id, id); const current = runs.find(r => r.status === 'ready' && !r.outdated); const reference = current ?? runs.find(r => r.status === 'ready');
  const reviews = reference ? await getSmeReview(user.id, id, reference.id) : null;
  return <div className="space-y-6"><Link className="text-sm text-brand-ink underline" href={`/content/courses/${id}`}>← Course brief</Link><h1 className="text-3xl font-semibold">Stage 4 · {course.brief.title}</h1><p className="text-ink-muted">{course.productionFormat === 'longform-v1' ? 'Five videos per module · 7–9 slides per video · At least five minutes of measured narration per slide.' : 'Short module pilot. Change the production format in the course brief to enable five-video modules.'}</p>{!current && <section className="space-y-3 rounded-xl border border-line bg-panel p-5"><h2 className="text-xl font-semibold">Current blueprint required</h2><p className="text-sm">Saved SME input revision {course.revision} has no ready current blueprint. Generate or retry Stage 2, then review each module in Stage 3. Historical packages remain accessible below.</p><Button asChild><Link href={`/content/courses/${id}/blueprint`}>Open Stage 2</Link></Button></section>}
    <div className="grid gap-4 md:grid-cols-2">{reference?.output?.modules.map(m => <article className="space-y-3 rounded-xl border border-line bg-panel p-5" key={m.id}><h2 className="text-xl font-semibold">{m.id}: {m.title}</h2><p className="text-sm text-ink-muted">{current ? 'Current blueprint' : 'Historical blueprint — read only'} · Stage 3: {reviews?.summary.latest[m.id]?.verdict.replaceAll('_', ' ') ?? 'Pending'}</p><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={`/content/courses/${id}/production/${reference.id}/${m.id}`}>Open module production</Link></Button><Button asChild variant="outline"><Link href={`/content/courses/${id}/blueprint/review/${reference.id}#review-${m.id}`}>Review module</Link></Button></div></article>)}</div>
  </div>;
}
