import { getSessionUser } from '@/server/auth';
import { learningService } from '@/server/learning/service';
import { PersonalLearning } from '@/components/learning/personal-learning';
export const metadata = { title: 'Your personalized learning path' };
export default async function PersonalLearningPage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ topic?: string }> }) {
  const { courseId } = await params, { topic } = await searchParams, user = await getSessionUser();
  const context = await learningService.context(user.id, courseId);
  return <main className="mx-auto max-w-5xl space-y-5 px-5 py-10"><p className="text-sm text-ink-muted">{context.course.title} · Module 1</p><h1 className="text-3xl font-semibold">Your personalized learning path</h1><PersonalLearning courseId={courseId} initialTopic={topic} /></main>;
}
