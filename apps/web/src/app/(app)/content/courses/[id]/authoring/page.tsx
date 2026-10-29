import { notFound } from 'next/navigation';
import { AuthoredCourseWorkspace } from '@/components/content/authored-course-workspace';
import { getSessionUser } from '@/server/auth';
import { authoredCourseState } from '@/server/authored-course';
import { ApiError } from '@/server/http';

export default async function AuthoredCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params;
  let initial;
  try { initial = await authoredCourseState(user.id, id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <AuthoredCourseWorkspace initial={initial} />;
}
