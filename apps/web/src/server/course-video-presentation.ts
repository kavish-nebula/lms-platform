import 'server-only';
import fs from 'node:fs/promises';
import { NEUTRAL_VIDEO_VERSION } from '@/lib/lesson-presentation';
/** Only presentation changes: keep the approved source and its audio intact. */
export async function courseVideoPresentation(source: string): Promise<string> {
  const corrected = /\.mp4$/i.test(source) ? source.replace(/\.mp4$/i, `.${NEUTRAL_VIDEO_VERSION}.mp4`) : `${source}.${NEUTRAL_VIDEO_VERSION}.mp4`;
  try {
    const [original, metadata] = await Promise.all([fs.stat(source), fs.readFile(corrected + '.json', 'utf8').then(JSON.parse)]);
    if (metadata.version !== NEUTRAL_VIDEO_VERSION || metadata.sourceBytes !== original.size || metadata.sourceModified !== original.mtimeMs || metadata.audioUnchanged !== true) return source;
    await fs.access(corrected);
    return corrected;
  } catch { return source; }
}
