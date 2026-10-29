import { getSessionUser } from '@/server/auth';
import { authoredCourseAudioClip } from '@/server/authored-course-audio';
import { handle } from '@/server/http';

export const GET = handle(async (_request: Request, { params }: { params: Promise<{ id: string; revisionId: string; slideId: string }> }) => {
  const user = await getSessionUser(); const { id, revisionId, slideId } = await params; const { bytes } = await authoredCourseAudioClip(user.id, id, revisionId, slideId);
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(bytes.length), 'Cache-Control': 'private, no-store' } });
});
