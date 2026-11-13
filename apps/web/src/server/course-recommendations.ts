import 'server-only';
import { getCourses } from '@/data';
import { recommendationCourse, recommendCourses } from '@/lib/course-recommendations';
import { getProfile, listEnrollments } from './repo';

export async function learnerCourseRecommendations(userId: string) {
  const [profile, courses, enrollments] = await Promise.all([getProfile(userId), getCourses(true, userId), listEnrollments(userId)]);
  return {
    hasProfile: !!profile,
    suggestions: recommendCourses(courses.map(recommendationCourse), profile?.answers ?? {}, enrollments.map(e => e.courseId)),
  };
}
