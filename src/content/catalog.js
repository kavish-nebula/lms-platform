import { COURSE } from './course.js'

/* Every course on the platform — the one that is open, and the ones coming next. */
export const COURSES = [
  { id: COURSE.id, title: COURSE.title, problem: COURSE.problem, open: true },
  { id: 'sql', title: 'SQL Data Modeling', problem: 'Schemas that were “obvious” on day one and unbearable by month three.', open: false },
  { id: 'webperf', title: 'Web Performance, Honestly', problem: 'A page that scores 100 and still feels slow. Measure what users feel.', open: false },
]
