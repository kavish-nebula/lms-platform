/** Retired catalog cards keep their original routes and learner history. */
export function isListedCourseId(courseId: string) {
  return courseId !== 'ai-for-production';
}
