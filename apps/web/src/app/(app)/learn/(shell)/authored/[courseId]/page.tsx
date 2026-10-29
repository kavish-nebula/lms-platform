import { notFound, redirect } from 'next/navigation';
import { getPublishedAuthoredCourse } from '@/server/authored-publication';

/** Keep bookmarks to the original sample reader opening the shared course experience. */
export default async function AuthoredLearnerRedirect({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!await getPublishedAuthoredCourse(courseId)) notFound();
  redirect('/learn/courses/' + courseId);
}
