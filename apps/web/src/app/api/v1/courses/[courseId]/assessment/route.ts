import { AuthoredAssessmentInput, gradeAuthoredAssessment } from '@/server/authored-assessment';
import { body, handle, ok } from '@/server/http';

export const POST = handle(async (request: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  const input = await body(request, AuthoredAssessmentInput);
  return ok({ result: await gradeAuthoredAssessment(courseId, input) });
});
