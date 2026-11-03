import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/server/auth';
import { importedCourse, importedModule } from '@/lib/imported-courses';
import { packageHtml, readPackageState } from '@/server/imported-courses';
import { ImportedModulePlayer } from '@/components/course/imported-module-player';

type Params = { courseId: string; moduleId: string };
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId, moduleId } = await params;
  return { title: importedModule(courseId, moduleId)?.title ?? 'Module' };
}
export default async function ImportedModulePage({ params }: { params: Promise<Params> }) {
  const { courseId, moduleId } = await params;
  const course = importedCourse(courseId), unit = importedModule(courseId, moduleId);
  if (!course || !unit) notFound();
  const [html, initial] = await Promise.all([packageHtml(courseId, moduleId), readPackageState((await getSessionUser()).id, courseId, moduleId)]);
  return <ImportedModulePlayer courseId={courseId} moduleId={moduleId} courseTitle={course.title} moduleTitle={unit.title} html={html} initial={initial} />;
}
