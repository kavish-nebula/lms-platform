import { COURSE, MODULES } from './course.js'

/* Every course on the platform — the one that is open, and the ones coming next. */
export const COURSES = [
  { id: COURSE.id, title: COURSE.title, problem: COURSE.problem, skills: COURSE.skills, open: true,
    level: 'Beginner', rating: 4.6, reviews: 1203, planned: MODULES.length },
  { id: 'sql', title: 'SQL Data Modeling', problem: 'Schemas that were “obvious” on day one and unbearable by month three.', open: false,
    skills: ['Relational modeling', 'Normalization', 'Indexes & query plans', 'Joins', 'Schema migrations', 'Analytical SQL'],
    level: 'Intermediate', rating: 4.7, reviews: 862, planned: 3 },
  { id: 'webperf', title: 'Web Performance, Honestly', problem: 'A page that scores 100 and still feels slow. Measure what users feel.', open: false,
    skills: ['Core Web Vitals', 'Performance budgets', 'Lazy loading', 'Caching strategy', 'Bundle analysis', 'Rendering metrics'],
    level: 'Advanced', rating: 4.8, reviews: 540, planned: 2 },
]
