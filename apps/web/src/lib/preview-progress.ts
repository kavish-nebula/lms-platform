/** Preserve the original course's saved keys; new courses own separate preview progress. */
export const SCOPED_PROGRESS = 'lms-course-progress:v1:';
export function previewPrefix(courseId: string) {
  return courseId === 'ai-agent' ? 'lms-progress:' : `${SCOPED_PROGRESS}${courseId}:`;
}
export function previewKey(courseId: string, moduleId: string) {
  return `${previewPrefix(courseId)}${moduleId}`;
}
export function previewFor<T>(courseId: string, legacy: Record<string, T>, scoped: Record<string, T>): Record<string, T> {
  const prefix = previewPrefix(courseId);
  const source = courseId === 'ai-agent' ? legacy : scoped;
  return Object.fromEntries(Object.entries(source).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value]));
}
