export const PERSONAL_LEARNING_COURSE = 'dd1fec93-8c51-4f2d-9e0c-943823062c76';
export const PERSONAL_LEARNING_REVISION = '2f676c65-2849-42f9-ab75-2d503142d5e1';
export const personalLearningHref = (courseId: string) => `/learn/courses/${courseId}/personalized`;
export type LearningAction = { title: string; reason: string; href: string; kind: 'review' | 'continue'; priority: number };
export const rankLearningActions = (actions: LearningAction[]) => [...actions].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title)).slice(0, 5);
