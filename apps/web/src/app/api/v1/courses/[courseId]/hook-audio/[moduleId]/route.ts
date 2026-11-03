import { getSessionUser } from '@/server/auth';
import { handle, ok } from '@/server/http';
import { prepareVideoHookAudio, videoHookAudio } from '@/server/video-hook-audio';

type Context = { params: Promise<{ courseId: string; moduleId: string }> };
export const POST = handle(async (_request: Request, { params }: Context) => {
  const { courseId, moduleId } = await params;
  await prepareVideoHookAudio((await getSessionUser()).id, courseId, moduleId);
  return ok({ ready: true });
});
export const GET = handle(async (request: Request, { params }: Context) => {
  const { courseId, moduleId } = await params;
  const bytes = await videoHookAudio((await getSessionUser()).id, courseId, moduleId, Number(new URL(request.url).searchParams.get('scene') ?? 0));
  const size = bytes.length;
  const headers = { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-cache', 'Accept-Ranges': 'bytes' };
  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Length': String(size) } });
});
