import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CourseWorkflowNav } from '@/components/content/course-workflow-nav';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/server/auth';
import { getCreatorDraft } from '@/server/content-creator';
import { listBlueprints } from '@/server/creator-blueprints';
import { ApiError } from '@/server/http';

/** A stable Stage 3 entry point when another workspace has no selected run. */
export default async function ModuleReviewIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  let course, runs;
  try {
    course = await getCreatorDraft(user.id, id);
    runs = await listBlueprints(user.id, id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const ready = runs.find(run => run.status === 'ready' && !run.outdated) ?? runs.find(run => run.status === 'ready');
  if (ready) redirect(`/content/courses/${id}/blueprint/review/${ready.id}`);
  return <div className="creator-stage">
    <CourseWorkflowNav courseId={id} step={3} />
    <header className="space-y-3"><p className="text-sm text-brand-ink">Stage 3 · Module review</p><h1 className="text-3xl font-semibold">Review modules: {course.brief.title}</h1></header>
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5"><h2 className="text-xl font-semibold">Prepare a blueprint first</h2><p>Generate a module blueprint in Stage 2 before reviewing its teaching plan. Saved course input is unchanged.</p><Button asChild><Link href={`/content/courses/${id}/blueprint`}>Open Stage 2</Link></Button></section>
  </div>;
}
