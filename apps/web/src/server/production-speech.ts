import 'server-only';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { appRoot } from './db/client';
import type { ProductionVoice } from '@/lib/production-audio';

export type SpeechClip = { key: string; text: string };
export type ProductionSpeaker = (dir: string, clips: SpeechClip[], voice: ProductionVoice, completed: (key: string) => Promise<void>) => Promise<void>;

/** Reuse the installed Kokoro worker, with a frozen voice and a bounded lifetime. */
export const speakProduction: ProductionSpeaker = async (dir, clips, voice, completed) => {
  if (!clips.length) return;
  await mkdir(dir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(appRoot(), 'scripts', 'tts-worker.mjs')], {
      cwd: appRoot(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, KOKORO_MODEL: voice.model, KOKORO_DEVICE: voice.device, KOKORO_DTYPE: voice.dtype },
    });
    let pending = Promise.resolve(); let output = ''; let callbackError: unknown;
    const timer = setTimeout(() => { child.kill(); reject(new Error('Speech worker timed out.')); }, 30 * 60 * 1000);
    child.stdout.setEncoding('utf8'); child.stderr.resume(); child.stdin.on('error', () => undefined);
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      let newline: number;
      while ((newline = output.indexOf('\n')) >= 0) {
        const line = output.slice(0, newline).trim(); output = output.slice(newline + 1);
        const clip = clips.find(c => line === `ok ${path.join(dir, `${c.key}.wav`)}`);
        if (clip) pending = pending.then(() => completed(clip.key)).catch(e => { callbackError = e; child.kill(); });
      }
    });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); void pending.then(() => callbackError ? reject(callbackError) : code ? reject(new Error('Speech worker failed.')) : resolve()); });
    child.stdin.end(JSON.stringify({ voice: voice.voice, chunkLong: voice.version === 2, clips: clips.map(c => ({ text: c.text, out: path.join(dir, `${c.key}.wav`) })) }));
  });
};
