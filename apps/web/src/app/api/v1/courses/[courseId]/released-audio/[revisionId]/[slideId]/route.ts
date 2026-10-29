import { getPublishedAuthoredCourse } from '@/server/authored-publication';
import { authoredCourseAudioClip } from '@/server/authored-course-audio';
import { ApiError, handle } from '@/server/http';

export const GET = handle(async (request: Request, { params }: { params: Promise<{ courseId: string; revisionId: string; slideId: string }> }) => {
  const { courseId, revisionId, slideId } = await params;
  const release = await getPublishedAuthoredCourse(courseId);
  if (!release || release.revisionId !== revisionId) throw new ApiError(404, 'not_found', 'Released narration not found.');
  const { bytes } = await authoredCourseAudioClip(release.ownerId, courseId, revisionId, slideId);
  const size = bytes.length;
  const headers = { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  // The shared video player needs seekable clips and finite metadata for its clock.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Length': String(size) } });
});
