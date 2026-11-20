import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { ApiError, body, handle, ok } from '@/server/http';
import { uploadSourceMedia, reviewSourceAudio } from '@/server/source-media';
export const runtime = 'nodejs';
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getSessionUser(), { id } = await params;
  if (req.headers.get('content-type')?.startsWith('multipart/form-data')) {
    const limit = 101*1024*1024;
    if (Number(req.headers.get('content-length')) > limit) throw new ApiError(413, 'too_large', 'The upload exceeds 100 MB.');
    const reader = req.body?.getReader(); if (!reader) throw new ApiError(400, 'file_required', 'Choose a source file.');
    let size = 0, oversized = false;
    const limited = new ReadableStream({ async pull(controller) { const next = await reader.read(); if (next.done) { controller.close(); return; } size += next.value.byteLength; if (size > limit) { oversized = true; await reader.cancel(); controller.error(new Error('Upload exceeds limit')); return; } controller.enqueue(next.value); }, cancel() { return reader.cancel(); } });
    const form = await new Response(limited, { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData().catch(() => { throw new ApiError(oversized ? 413 : 400, 'invalid_upload', 'Could not read this upload within the 100 MB limit.'); });
    const file = form.get('file'), kind = form.get('kind');
    if (!(file instanceof File) || (kind !== 'audio' && kind !== 'diagram')) throw new ApiError(400, 'invalid_upload', 'Choose an audio recording or diagram image.');
    return ok({ asset: await uploadSourceMedia(user.id, id, kind, file) }, 201);
  }
  const input = await body(req, z.object({ action: z.literal('review-audio'), assetId: z.uuid(), text: z.string().trim().min(1).max(100000) }).strict());
  return ok({ transcript: await reviewSourceAudio(user.id, id, input.assetId, input.text) }, 201);
});
