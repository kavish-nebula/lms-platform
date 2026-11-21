/** Retired catalog cards keep their original routes and learner history. */
const retiredCourseIds = new Set([
  'ai-for-production',
  '3f969ac0-0afe-4ff5-971a-2e1850ff4351', // Clean Data to Clear Decisions
  '8cbcd44f-35be-4dff-ad37-778b70c0eee7', // Clear Task Handoffs — MCP Setup Verification
]);

export function isListedCourseId(courseId: string) {
  return !retiredCourseIds.has(courseId);
}
