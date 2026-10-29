import { after } from 'next/server';
import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { ApiError, body, handle, ok } from '@/server/http';
import { StartProductionAudio } from '@/lib/production-audio';
import { productionAudioFile, productionAudioState, startProductionAudio, processProductionAudio } from '@/server/production-audio';

export const runtime = 'nodejs';
export const maxDuration = 1800;
type Context = { params: Promise<{ id: string; runId: string; moduleId: string }> };
export const GET = handle(async (request: Request, { params }: Context) => {
  const user = await getSessionUser(); const p = await params; const search = new URL(request.url).searchParams;
  const jobId = search.get('jobId');
  if (!z.uuid().safeParse(jobId).success) throw new ApiError(400, 'invalid_job', 'A valid production job is required.');
  const audioId = search.get('audioId'); const slideId = search.get('slideId');
  if (!audioId && !slideId) return ok(await productionAudioState(user.id, p.id, p.runId, p.moduleId, jobId!));
  if (!z.uuid().safeParse(audioId).success || !slideId || !/^[A-Za-z0-9-]{1,80}$/.test(slideId)) throw new ApiError(400, 'invalid_clip', 'A valid audio job and slide are required.');
  const bytes = await productionAudioFile(user.id, p.id, p.runId, p.moduleId, jobId!, audioId!, slideId);
  const headers = { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes', 'Content-Disposition': `inline; filename="slide-${slideId}.wav"` };
  const range = request.headers.get('range');
  if (!range) return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Length': String(bytes.length) } });
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, bytes.length - Number(match[2])) : NaN;
  const end = match?.[1] && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
  if (!Number.isSafeInteger(start) || start < 0 || start >= bytes.length || end < start) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
  return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } });
});
export const POST = handle(async (request: Request, { params }: Context) => {
  const user = await getSessionUser(); const p = await params;
  const input = await body(request, StartProductionAudio);
  const work = await startProductionAudio(user.id, p.id, p.runId, p.moduleId, input);
  if (work.token) after(() => processProductionAudio(work.id, work.token!, user.id, p.id, p.runId, p.moduleId));
  return ok({ audioId: work.id }, work.token ? 202 : 200);
});
