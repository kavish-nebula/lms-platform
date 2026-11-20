import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { z } from 'zod/v4';
import { getCreatorDraft } from './content-creator';
import { appRoot } from './db/client';
import { ApiError } from './http';
import type { CourseBriefData } from '@/lib/content-creator';

type Asset = { id: string; courseId: string; ownerId: string; kind: 'audio' | 'diagram'; mime: string; bytes: number; filename: string; sha256: string; durationSeconds?: number };
const root = () => path.resolve(process.env.LMS_SOURCE_MEDIA_DIR ?? path.join(appRoot(), '.data', 'source-media'));
function directory(courseId: string, assetId: string) {
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(assetId).success) throw new ApiError(404, 'not_found', 'Source media not found.');
  return path.join(root(), courseId, assetId);
}
async function owned(ownerId: string, courseId: string, assetId: string): Promise<Asset> {
  await getCreatorDraft(ownerId, courseId);
  let asset: Asset;
  try { asset = JSON.parse(await fs.readFile(path.join(directory(courseId, assetId), 'asset.json'), 'utf8')); }
  catch { throw new ApiError(404, 'not_found', 'Source media not found.'); }
  if (asset.ownerId !== ownerId || asset.courseId !== courseId || asset.id !== assetId) throw new ApiError(404, 'not_found', 'Source media not found.');
  return asset;
}
async function probe(file: string) {
  if (!ffmpeg) throw new ApiError(503, 'media_unavailable', 'Install FFmpeg before uploading media.');
  return new Promise<string>((resolve, reject) => execFile(ffmpeg!, ['-i', file], { timeout: 30000, maxBuffer: 1000000, windowsHide: true }, (error, _out, stderr) => {
    if (error && !stderr.includes('Duration:') && !stderr.includes('Video:')) reject(new ApiError(422, 'invalid_media', 'This file could not be read as audio or an image.'));
    else resolve(stderr);
  }));
}
export async function uploadSourceMedia(ownerId: string, courseId: string, kind: 'audio' | 'diagram', file: File) {
  await getCreatorDraft(ownerId, courseId);
  const audioMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/flac', 'audio/x-flac'];
  if (!file.size || file.size > (kind === 'audio' ? 100 : 10) * 1024 * 1024 || !(kind === 'audio' ? audioMimes : ['image/png', 'image/jpeg', 'image/webp']).includes(file.type)) throw new ApiError(422, 'invalid_media', 'Use MP3, WAV, M4A, Ogg or FLAC up to 100 MB, or PNG, JPEG or WebP up to 10 MB.');
  const id = randomUUID(), dir = directory(courseId, id), data = Buffer.from(await file.arrayBuffer());
  // Do not let a claimed image MIME turn an HTML/SVG file into an inline preview.
  if (kind === 'diagram') {
    const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    const webp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    if (!(file.type === 'image/png' ? png : file.type === 'image/jpeg' ? jpeg : webp)) throw new ApiError(422, 'invalid_media', 'The image contents do not match its format.');
  }
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(path.join(dir, 'media'), data, { flag: 'wx' });
    const info = await probe(path.join(dir, 'media'));
    const time = info.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const durationSeconds = time ? Number(time[1])*3600+Number(time[2])*60+Number(time[3]) : 0;
    if (kind === 'audio' && (!/Audio:/.test(info) || !durationSeconds || durationSeconds > 1800 || /Video:(?![^\n]*\(attached pic\))/.test(info))) throw new ApiError(422, 'invalid_media', 'Use an audio recording no longer than 30 minutes. Upload concept videos in the video section.');
    const dimensions = info.match(/Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
    if (kind === 'diagram' && (!dimensions || Number(dimensions[1])*Number(dimensions[2]) > 30000000)) throw new ApiError(422, 'invalid_media', 'Use a readable PNG, JPEG or WebP diagram up to 30 megapixels.');
    const asset: Asset = { id, courseId, ownerId, kind, mime: file.type === 'audio/mp3' ? 'audio/mpeg' : file.type, bytes: data.length, filename: path.basename(file.name).slice(0, 200), sha256: createHash('sha256').update(data).digest('hex'), ...(kind === 'audio' ? { durationSeconds } : {}) };
    await fs.writeFile(path.join(dir, 'asset.json'), JSON.stringify(asset), { flag: 'wx' });
    return { id, kind, filename: asset.filename, ...(kind === 'audio' ? { durationSeconds } : {}) };
  } catch (error) {
    // `dir` is constructed only from the configured root and validated/generated UUIDs.
    if (!path.resolve(dir).startsWith(root() + path.sep)) throw error;
    await fs.rm(dir, { recursive: true, force: true }); throw error;
  }
}
export async function reviewSourceAudio(ownerId: string, courseId: string, assetId: string, text: string) {
  const asset = await owned(ownerId, courseId, assetId);
  if (asset.kind !== 'audio') throw new ApiError(422, 'invalid_media', 'Choose an audio recording.');
  const transcript = { id: randomUUID(), text: z.string().trim().min(1).max(100000).parse(text) };
  await fs.writeFile(path.join(directory(courseId, assetId), `${transcript.id}.json`), JSON.stringify(transcript), { flag: 'wx' });
  return transcript;
}
export async function assertSourceMedia(ownerId: string, courseId: string, brief: CourseBriefData) {
  for (const source of brief.sourceLibrary?.sources ?? []) {
    if (source.audio) {
      const asset = await owned(ownerId, courseId, source.audio.assetId);
      if (asset.kind !== 'audio' || asset.durationSeconds !== source.audio.durationSeconds || !source.audio.transcriptId) throw new ApiError(422, 'audio_review_required', 'Review the source audio transcript before generation.');
      let transcript;
      try { transcript = JSON.parse(await fs.readFile(path.join(directory(courseId, asset.id), `${z.uuid().parse(source.audio.transcriptId)}.json`), 'utf8')); } catch { throw new ApiError(422, 'audio_review_required', 'Review the source audio transcript before generation.'); }
      if (transcript.text !== source.audio.transcriptText) throw new ApiError(422, 'audio_transcript_changed', 'The audio transcript changed. Review and save it again.');
    }
    if (source.diagram && (await owned(ownerId, courseId, source.diagram.assetId)).kind !== 'diagram') throw new ApiError(422, 'invalid_media', 'Choose a diagram image.');
  }
}
export async function serveSourceMedia(ownerId: string, courseId: string, assetId: string, request: Request) {
  const asset = await owned(ownerId, courseId, assetId);
  let start = 0, end = asset.bytes - 1;
  const range = request.headers.get('range');
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${asset.bytes}` } });
    if (!match[1]) start = Math.max(0, asset.bytes - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= asset.bytes) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${asset.bytes}` } });
  }
  return new Response(request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(path.join(directory(courseId, assetId), 'media'), { start, end })) as ReadableStream, { status: range ? 206 : 200, headers: { 'Content-Type': asset.mime, 'Content-Length': String(end-start+1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${asset.bytes}` } : {}) } });
}
