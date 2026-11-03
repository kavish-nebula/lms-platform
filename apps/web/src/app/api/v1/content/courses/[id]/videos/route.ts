import { z } from 'zod/v4';
import { getSessionUser } from '@/server/auth';
import { body, handle, ok, ApiError } from '@/server/http';
import { uploadConceptVideo, reviewVideoTranscript, transcribeConceptVideo, ownedVideo } from '@/server/concept-videos';
import { generateVideoModule, videoModuleDrafts } from '@/server/video-first-authoring';

export const runtime = 'nodejs';
export const maxDuration = 180;
type Context = { params: Promise<{ id: string }> };
const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('transcribe'), assetId: z.uuid() }).strict(),
  z.object({ action: z.literal('review'), assetId: z.uuid(), vtt: z.string().max(200000) }).strict(),
  z.object({ action: z.literal('generate'), moduleId: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,29}$/), expectedBriefRevision: z.number().int().positive() }).strict(),
]);
export const GET = handle(async (_req: Request, { params }: Context) => ok({ modules: await videoModuleDrafts((await getSessionUser()).id, (await params).id) }));
export const POST = handle(async (req: Request, { params }: Context) => {
  const user = await getSessionUser(); const { id } = await params;
  if (req.headers.get('content-type')?.startsWith('multipart/form-data')) {
    if (Number(req.headers.get('content-length')) > 251 * 1024 * 1024) throw new ApiError(413, 'too_large', 'Maximum video upload is 250 MB.');
    const reader = req.body?.getReader();
    if (!reader) throw new ApiError(400, 'file_required', 'Choose a concept video.');
    let size = 0; let oversized = false;
    const limited = new ReadableStream({ async pull(controller) {
      const next = await reader.read();
      if (next.done) { controller.close(); return; }
      size += next.value.byteLength;
      if (size > 251 * 1024 * 1024) { oversized = true; await reader.cancel(); controller.error(new Error('Upload exceeds limit')); return; }
      controller.enqueue(next.value);
    }, cancel() { return reader.cancel(); } });
    const form = await new Response(limited, { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData().catch(() => { throw new ApiError(oversized ? 413 : 400, 'invalid_upload', oversized ? 'Maximum video upload is 250 MB.' : 'Could not read this upload. Choose the video again.'); });
    const file = form.get('file');
    if (!(file instanceof File)) throw new ApiError(400, 'file_required', 'Choose a concept video.');
    const asset = await uploadConceptVideo(user.id, id, file);
    return ok({ asset: { id: asset.id, durationSeconds: asset.durationSeconds, filename: asset.filename }, href: `/api/v1/courses/${id}/concept-video/${asset.id}` }, 201);
  }
  const data = await body(req, Action);
  if (data.action === 'generate') return ok({ module: await generateVideoModule(user.id, id, data.moduleId, data.expectedBriefRevision) }, 201);
  await ownedVideo(user.id, id, data.assetId);
  if (data.action === 'transcribe') return ok(await transcribeConceptVideo(user.id, id, data.assetId));
  return ok({ transcript: await reviewVideoTranscript(user.id, id, data.assetId, data.vtt) }, 201);
});
