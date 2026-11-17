import 'server-only';
import { getCourses } from '@/data';
import { recommendationCourse, recommendCourses } from '@/lib/course-recommendations';
import { getProfile, listEnrollments, progressFor, signalsFor } from './repo';
import { learningService } from './learning/service';
import { PILOT_COURSE } from './learning/pilot-policy';
import { rankLearningActions, personalLearningHref, type LearningAction } from '@/lib/personal-learning';
import { ApiError } from './http';

export async function learnerCourseRecommendations(userId: string) {
  const [profile, courses, enrollments] = await Promise.all([getProfile(userId), getCourses(true, userId), listEnrollments(userId)]);
  const actions: LearningAction[] = [];
  const completed = new Set<string>();
  for (const enrollment of enrollments) {
    const course = courses.find(c => c.course_id === enrollment.courseId);
    if (!course) continue;
    const [progress, evidence] = await Promise.all([progressFor(enrollment.id), signalsFor(enrollment.id)]);
    const modulesDone = course.modules.every(m => m.stages.filter(s => s !== 'review' && s !== 'reflection').every(s => progress.some(p => p.moduleId === m.module_id && p.stage === s)));
    if (modulesDone && evidence.some(s => s.kind === 'final_check' && s.payload.verified === true && s.payload.passed === true)) { completed.add(course.course_id); continue; }
    if (course.course_id === PILOT_COURSE) {
      try {
        const state = await learningService.state(userId, course.course_id);
        const reviews = state.topics.filter(t => t.review && !t.review.completed);
        for (const topic of reviews) actions.push({ kind: 'review', title: `Review ${topic.title}`, reason: topic.review!.reason, href: `${personalLearningHref(course.course_id)}?topic=${encodeURIComponent(topic.id)}`, priority: 0 });
        const next = state.topics.find(t => !t.disposition);
        const required = course.modules[0]?.stages.find(stage => stage !== 'explainer' && stage !== 'review' && stage !== 'reflection' && !progress.some(p => p.moduleId === 'M1' && p.stage === stage));
        actions.push({ kind: 'continue', title: next ? `Continue ${next.title}` : `Continue ${course.title}`, reason: next ? 'This topic has not yet been completed or demonstrated in your current learning path.' : 'Your concepts are resolved. Continue the remaining required activities and independent assessments.', href: next?.href ?? `/learn/courses/${course.course_id}/${required ? `M1/${required}` : 'finale/capstone'}`, priority: 1 });
        continue;
      } catch (error) { if (!(error instanceof ApiError && error.code === 'learning_unavailable')) throw error; }
    }
    const next = course.modules.flatMap(m => m.stages.filter(s => s !== 'review' && s !== 'reflection').map(stage => ({ moduleId: m.module_id, stage }))).find(t => !progress.some(p => p.moduleId === t.moduleId && p.stage === t.stage));
    if (next) actions.push({ kind: 'continue', title: `Continue ${course.title}`, reason: 'Continue from your saved course progress.', href: `/learn/courses/${course.course_id}/${next.moduleId}/${next.stage}`, priority: 2 });
  }
  return {
    hasProfile: !!profile,
    learningActions: rankLearningActions(actions),
    suggestions: recommendCourses(courses.filter(c => !completed.has(c.course_id)).map(recommendationCourse), profile?.answers ?? {}, enrollments.map(e => e.courseId)),
  };
}
