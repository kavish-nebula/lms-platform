import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BookOpen, Check, Clock, Sparkles } from 'lucide-react';
import { getSessionUser } from '@/server/auth';
import { learnerCourseRecommendations } from '@/server/course-recommendations';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Recommended for you' };

export default async function RecommendedCourses({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const user = await getSessionUser();
  const result = await learnerCourseRecommendations(user.id);
  if (!result.hasProfile) redirect('/learn/welcome?return=%2Flearn%2Frecommended');
  const { return: back } = await searchParams;
  const returnTo = back?.startsWith('/learn') && !back.startsWith('//') && !back.startsWith('/learn/recommended') ? back : '/learn';
  return <div className="course-recommendations">
    <header className="course-recommendations-header">
      <span className="course-recommendations-icon"><Sparkles aria-hidden="true" /></span>
      <h1>Recommended for you, {user.name.split(' ')[0]}.</h1>
      <p>These suggestions connect your answers with courses available now. Choose what interests you; your profile is a starting point, not a limit.</p>
      {result.suggestions.length > 0 && result.suggestions.every(s => s.basis === 'starting-point') && <p>These are general starting points, rather than courses specific to your field.</p>}
    </header>
    <section aria-label="Suggested courses" className="course-recommendations-list">
      {result.suggestions.map(({ course, reason, enrolled }, i) => <article key={course.course_id} className="course-recommendation">
        <div className="course-recommendation-position" aria-hidden="true">{i + 1}</div>
        <div className="course-recommendation-content">
          <p className="course-recommendation-reason"><Sparkles aria-hidden="true" />{reason}</p>
          <h2><Link href={`/learn/courses/${course.course_id}`}>{course.title}</Link></h2>
          <p>{course.tagline || course.goal}</p>
          <ul className="course-recommendation-meta" aria-label="Course information">
            <li><BookOpen aria-hidden="true" />{course.moduleCount} {course.moduleCount === 1 ? 'module' : 'modules'}</li>
            <li><Clock aria-hidden="true" />About {Math.round(course.estimated_hours * 10) / 10} hours</li>
            {enrolled && <li><Check aria-hidden="true" />Already enrolled</li>}
          </ul>
        </div>
        <Button variant={i === 0 ? 'brand' : 'outline'} asChild><Link href={`/learn/courses/${course.course_id}`}>Explore course<ArrowRight aria-hidden="true" /></Link></Button>
      </article>)}
      {!result.suggestions.length && <p>There are no course suggestions available yet. You can still explore the catalog and choose your own starting point.</p>}
    </section>
    <footer className="course-recommendations-footer">
      <Button variant="outline" asChild><Link href="/learn/courses">Browse all courses</Link></Button>
      <Link href={returnTo}>Continue to {returnTo === '/learn/settings' ? 'settings' : 'your learning'}</Link>
      <Link href="/learn/profile">Update my profile</Link>
    </footer>
  </div>;
}
