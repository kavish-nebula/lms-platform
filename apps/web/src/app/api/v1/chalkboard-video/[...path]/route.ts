import fs from 'node:fs/promises';
import { getSessionUser } from '@/server/auth';
import { ApiError, handle } from '@/server/http';
import { chalkboardFile } from '@/server/adapt/chalkboard';

export const runtime = 'nodejs';
export const GET = handle(async (request: Request, { params }: { params: Promise<{ path: string[] }> }) => {
  const file = await chalkboardFile(await getSessionUser(), (await params).path);
  if (!file) throw new ApiError(404, 'not_found', 'Video not found.');
  const data = await fs.readFile(file), size = data.length;
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (request.headers.has('range')) {
    if (!match || !(match[1] || match[2])) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isSafeInteger(start) || start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, 'Content-Length': String(size) } });
});
