import type { Course } from '@/data/types';
import type { SetupAnswers } from './setup';

export type RecommendationCourse = Pick<Course, 'course_id' | 'title' | 'tagline' | 'goal' | 'skills' | 'level' | 'estimated_hours'> & { moduleCount: number };
export type CourseRecommendation = { course: RecommendationCourse; reason: string; basis: 'field' | 'interest' | 'starting-point'; enrolled: boolean };
export const recommendationCourse = (c: Course): RecommendationCourse => ({ course_id: c.course_id, title: c.title, tagline: c.tagline, goal: c.goal, skills: c.skills, level: c.level, estimated_hours: c.estimated_hours, moduleCount: c.modules.length });

const sectors = [
  { name: 'healthcare', words: /\b(healthcare|clinical|clinician|medical|medicine|nursing|nurse|hospital|dentistry|dental)\b/i },
  { name: 'production and manufacturing', words: /\b(manufacturing|production|factory|industrial|mechanical|maintenance|mechatronics)\b/i },
  { name: 'software and technology', words: /\b(software|developer|programming|programmer|coding|api|engineering|technology|tech)\b/i },
  { name: 'finance', words: /\b(finance|financial|accounting|accountant|banking|audit)\b/i },
  { name: 'human resources', words: /\b(hr|human resources|recruitment|recruiter|hiring)\b/i },
];
const tokens = (text: string) => [...new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? [])].filter(t => !['the','and','for','with','from','your','work','other','none','not','yet','years','step','show','example','examples','learning','course'].includes(t));

/** Read-only, deterministic ranking. Stated preferences are not proficiency scores.
 * Callers supply only the learner-visible catalog, never creator drafts. */
export function recommendCourses(catalog: RecommendationCourse[], answers: SetupAnswers, enrolledIds: string[] = [], limit = 3): CourseRecommendation[] {
  const field = [answers.domain === 'other' ? answers.domainOther : answers.domain, answers.field, answers.studyField, answers.studyFieldOther].filter(Boolean).join(' ');
  const stated = [field, answers.role === 'other' ? answers.roleOther : answers.role, ...(answers.tools ?? []), answers.project, answers.goal, answers.firstJobOther, ...Object.values(answers.extra ?? {})].filter(Boolean).join(' ');
  // Profile packs use compact field codes; expand them only on the profile
  // side so the ordinary word "it" in a course description cannot match IT.
  const fieldSignal = field.replace(/\b(it|cs)\b/gi, 'software technology');
  const sector = sectors.find(s => s.words.test(fieldSignal));
  const interests = tokens(stated);
  const noCoding = answers.coding === 'none';
  const enrolled = new Set(enrolledIds);
  const unique = new Map<string, RecommendationCourse>();
  for (const c of catalog) {
    const title = c.title.trim().toLowerCase();
    const prior = unique.get(title);
    // Prefer the fuller learner-delivery course over an imported title alias.
    if (!prior || c.moduleCount > prior.moduleCount) unique.set(title, c);
  }
  return [...unique.values()].map(course => {
    const text = [course.title, course.tagline, course.goal, ...course.skills].join(' ');
    const courseWords = new Set(tokens(text));
    const overlap = interests.filter(word => courseWords.has(word));
    const fieldMatch = !!sector && sector.words.test(text);
    const otherSector = sectors.find(s => s !== sector && s.words.test(course.title));
    const foundational = /essentials|everyday|fundamentals|foundations|introduction/i.test(course.title);
    const technical = /agent|programming|coding|api/i.test(course.title + ' ' + course.skills.join(' '));
    let score = overlap.length * 4 + (fieldMatch ? 100 : 0) + (foundational ? 20 : 0);
    if (sector && otherSector && !fieldMatch) score -= 65;
    if (noCoding && foundational && !technical) score += 20;
    if (noCoding && technical) score -= 12;
    if (answers.coding && answers.coding !== 'none' && technical) score += 15;
    // A new suggestion is useful, but existing enrollments remain available.
    if (enrolled.has(course.course_id)) score -= 8;
    const reason = fieldMatch ? `Connects with your stated field of ${sector!.name}.`
      : overlap.length ? `Connects with your interest in ${overlap.slice(0, 2).join(' and ')}.`
      : noCoding && foundational && !technical ? 'A starting point for everyday AI, based on your answer that you have not started coding.'
      : foundational ? 'A general starting point for building familiarity with AI.'
      : 'An option to explore from the available course catalog.';
    const basis: CourseRecommendation['basis'] = fieldMatch ? 'field' : overlap.length ? 'interest' : 'starting-point';
    return { course, reason, basis, enrolled: enrolled.has(course.course_id), score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.course.title.localeCompare(b.course.title) || a.course.course_id.localeCompare(b.course.course_id))
    .slice(0, Math.max(0, limit)).map(({ course, reason, basis, enrolled }) => ({ course, reason, basis, enrolled }));
}
