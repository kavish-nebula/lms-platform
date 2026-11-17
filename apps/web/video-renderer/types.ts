import type { DirectedChapter } from '../src/server/adapt/visual-director';
export type Chapter = Omit<DirectedChapter, 'cues'> & { question?: string; start: number; end: number; cues: (DirectedChapter['cues'][number] & { seconds: number; withTargets?: string[] })[] };
export type LessonProps = { chapters: Chapter[]; durationSeconds: number; manim: string; title: string };
