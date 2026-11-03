import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { appRoot } from '@/server/db/client';
import { ApiError, handle } from '@/server/http';
import { requireImportedModule } from '@/server/imported-courses';

export const runtime = 'nodejs';
export const GET = handle(async (req: Request, { params }: { params: Promise<{ courseId: string; moduleId: string; file: string }> }) => {
  const { courseId, moduleId, file } = await params;
  const { module } = requireImportedModule(courseId, moduleId);
  const source = (module.media as Record<string, string>)[file];
  if (!source || !/^[\w.-]+\.(wav|mp4)$/.test(file)) throw new ApiError(404, 'not_found', 'Media not found.');
  const local = path.join(appRoot(), '.data', 'course-package-media', courseId, moduleId, file);
  // A fresh checkout can still use the package's original public media links.
  if (!fs.existsSync(local)) return new Response(null, { status: 307, headers: { Location: source, 'Access-Control-Allow-Origin': '*' } });
  const size = fs.statSync(local).size;
  const headers = { 'Content-Type': file.endsWith('.mp4') ? 'video/mp4' : 'audio/wav', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  const start = range?.[1] ? Number(range[1]) : range?.[2] ? Math.max(0, size - Number(range[2])) : 0;
  const end = range?.[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  const stream = Readable.toWeb(fs.createReadStream(local, { start, end })) as ReadableStream;
  return new Response(stream, { status: range ? 206 : 200, headers: { ...headers, 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) } });
});
