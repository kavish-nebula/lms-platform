import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { appRoot } from '@/server/db/client';
import { audioRoot } from './tts';
import { chalkboardPlan, type ChalkboardView } from '@/lib/chalkboard';
import type { ConceptScene } from '@/lib/personalized-concept';
import type { ContinuousPlayback } from '@/lib/continuous-concept';
import * as repo from '@/server/repo';
import type { SessionUser } from '@/server/auth';
import hybrid from '../../../video-renderer/contract.json';
import { courseVideoPresentation } from '../course-video-presentation';
import { directedPlanWithCache, DIRECTOR_VERSION } from './visual-director';

export const chalkboardEnabled = () => process.env.CHALKBOARD_ENABLED !== 'false';
export const boardRoot = () => path.join(appRoot(), '.data', 'chalkboard-video');
// One native renderer at a time keeps playback and adaptive generation responsive.
const state = globalThis as unknown as { __chalkboardQueue?: Promise<void> };
async function readStatus(file: string) { try { return JSON.parse(await fs.readFile(file, 'utf8')) as { status: ChalkboardView['status']; stage?: string }; } catch { return null; } }
async function atomic(file: string, value: unknown) {
  const temp = `${file}.${randomUUID()}.tmp`; await fs.writeFile(temp, JSON.stringify(value));
  for(let attempt=0;;attempt++)try{await fs.rename(temp,file);return;}catch(error){if(attempt===9||!['EPERM','EACCES','EBUSY'].includes((error as NodeJS.ErrnoException).code??''))throw error;await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));}
}

export async function prepareChalkboard(input: { enrollmentId: string; moduleId: string; revisionId: string; title: string; field: string; scenes: ConceptScene[]; playback: ContinuousPlayback; retry?: boolean }): Promise<ChalkboardView> {
  if (![input.enrollmentId, input.moduleId].every(s => /^[\w-]+$/.test(s))) throw Error('Invalid render scope');
  // Legacy plan is retained only as a source fingerprint and cache migration
  // input. Its keyword diagrams and proportional cue times are never rendered.
  const identity = chalkboardPlan(input.scenes, input.playback, input.field);
  const prefix = `/api/v1/adapted-audio/${input.enrollmentId}/${input.moduleId}/clips/`;
  if (!input.playback.audio.startsWith(prefix) || !/^[a-f0-9]{64}\.wav$/.test(input.playback.audio.slice(prefix.length))) throw Error('Invalid narration asset');
  const audio = path.join(audioRoot(), input.enrollmentId, input.moduleId, 'clips', input.playback.audio.slice(prefix.length));
  const audioHash = createHash('sha256').update(await fs.readFile(audio)).digest('hex');
  const illustration = path.resolve(appRoot(), '../adaptive-api/chalkboard_assets/finance-workbench-transparent.png');
  const illustrationHash = createHash('sha256').update(await fs.readFile(illustration)).digest('hex');
  const rendererRoot=path.join(appRoot(),'video-renderer');
  const rendererHash=createHash('sha256');
  for(const name of (await fs.readdir(rendererRoot)).filter(name=>/\.(tsx?|mjs|json)$/.test(name)).sort())rendererHash.update(name).update(await fs.readFile(path.join(rendererRoot,name)));
  const key = createHash('sha256').update(JSON.stringify({ version: DIRECTOR_VERSION, rendererHash:rendererHash.digest('hex'), illustrationHash, plan: identity, title: input.title, revision: input.revisionId, audioHash })).digest('hex');
  const directory = path.join(boardRoot(), input.enrollmentId, input.moduleId, key);
  await fs.mkdir(directory, { recursive: true });
  const statusFile = path.join(directory, 'status.json'), lock = path.join(directory, 'lock');
  const previous = await readStatus(statusFile);
  if (previous?.status === 'ready') {
    try { await fs.access(path.join(directory, 'final.mp4')); const playback = JSON.parse(await fs.readFile(path.join(directory, 'playback.json'), 'utf8')) as ContinuousPlayback; return { status: 'ready', key, video: `/api/v1/chalkboard-video/${input.enrollmentId}/${input.moduleId}/${key}`, captions: playback.captions }; } catch { /* Recover a missing derivative. */ }
  }
  // Reuse only an exactly scoped, corrected legacy render after a header-only
  // renderer change. Revision, narration, profile plan and illustrations still match.
  const legacyKey = createHash('sha256').update(JSON.stringify({ version: DIRECTOR_VERSION, rendererHash:'631f81da6509e151378d5a2a834f0b10563445c9dfa762f7af6853a192787dd8', illustrationHash, plan: identity, title: input.title, revision: input.revisionId, audioHash })).digest('hex');
  if (legacyKey !== key) {
    const legacyDir = path.join(boardRoot(), input.enrollmentId, input.moduleId, legacyKey);
    const legacyFile = path.join(legacyDir, 'final.mp4');
    try {
      if ((await readStatus(path.join(legacyDir, 'status.json')))?.status === 'ready') {
        let neutral = await courseVideoPresentation(legacyFile) !== legacyFile;
        // Manim-only compositions never included the changed Remotion banner.
        // They can retain their exact scoped cache without a redundant transcode.
        if (!neutral) {
          const aligned = JSON.parse(await fs.readFile(path.join(legacyDir, 'aligned.json'), 'utf8')) as {chapters:{kind:string}[]};
          neutral = aligned.chapters.length > 0 && aligned.chapters.every(chapter => !(hybrid.remotionKinds as string[]).includes(chapter.kind)) && (await fs.stat(legacyFile)).size > 1024;
        }
        if (neutral) {
          const playback = JSON.parse(await fs.readFile(path.join(legacyDir, 'playback.json'), 'utf8')) as ContinuousPlayback;
          return { status:'ready', key:legacyKey, video:`/api/v1/chalkboard-video/${input.enrollmentId}/${input.moduleId}/${legacyKey}`, captions:playback.captions };
        }
      }
    } catch { /* Incomplete legacy caches must not prevent normal preparation. */ }
  }
  if (previous?.status === 'failed' && !input.retry) return { status: 'failed', key, message: `Your narration is ready, but ${previous.stage === 'storyboard' ? 'visual planning' : 'video rendering'} needs another attempt. Retry the video or watch the original lesson.` };
  try {
    const stat = await fs.stat(lock);
    let abandoned = Date.now() - stat.mtimeMs > 20 * 60_000;
    try {
      const owner = JSON.parse(await fs.readFile(path.join(directory, 'owner.json'), 'utf8'));
      if (Number.isInteger(owner.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') abandoned = true; }
      }
    } catch { /* Older caches rely on lease expiry. */ }
    if (abandoned) await fs.rmdir(lock);
  } catch { /* No active lock. */ }
  let acquired = false;
  try { await fs.mkdir(lock); acquired = true; } catch { /* A concurrent request already scheduled it. */ }
  if (acquired) {
    await atomic(path.join(directory, 'owner.json'), { pid: process.pid });
    // Queued jobs also renew their lease; a long earlier lesson must not allow
    // another request to enqueue a duplicate render of this same revision.
    const heartbeat = setInterval(() => void fs.utimes(lock, new Date(), new Date()).catch(() => {}), 30_000);
    const manifest = path.join(directory, 'manifest.json');
    await atomic(statusFile, { status: 'queued' });
    const root = path.resolve(appRoot(), '..', '..');
    const python = process.env.CHALKBOARD_PYTHON || process.env.ADAPTIVE_PYTHON_BIN || path.join(root, 'apps/adaptive-api/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const script = path.join(root, 'apps/adaptive-api/adaptive_api/chalkboard_directed_render.py');
    const work = async () => {
      let stage = 'storyboard';
      try {
        await atomic(statusFile, { status: 'rendering', stage });
        let repair: string | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
        const plan = await directedPlanWithCache({ title: input.title, field: identity.domain, scenes: input.scenes, playback: input.playback, repair });
        stage = 'alignment';
        await atomic(manifest, { hybrid: true, remotionKinds: hybrid.remotionKinds, plan, title: input.title, scenes: input.scenes, playback: input.playback, audio, ffmpeg,
          illustration: identity.domain === 'finance' ? illustration : undefined,
          modelRoot: path.join(appRoot(), '.data/chalkboard-models'), alignmentRoot: path.join(appRoot(), '.data/chalkboard-alignment') });
        try { await new Promise<void>((resolve, reject) => {
          const child = spawn(python, [script, manifest], { cwd: directory, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], timeout: 15 * 60_000,
            // Renderer receives local data, not provider credentials.
            env: { NODE_ENV: process.env.NODE_ENV, PATH: `${path.dirname(python)}${path.delimiter}${process.env.PATH ?? ''}`, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE, PYTHONUTF8: '1', CHALKBOARD_TEXT_FONT: 'Arial', HF_HUB_OFFLINE: '1' } });
          let log = ''; child.stderr.on('data', bytes => { log = (log + bytes.toString()).slice(-20_000); });
          child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(Error(log || `Renderer exited ${code}`)));
        }); break; } catch (error) {
          if (attempt || !/cue|align|Overlapping visual|layout\/sync/i.test(String(error))) throw error;
          repair = String(error).slice(-4000);
          await atomic(path.join(directory, 'repair.json'), { attempt: attempt + 1, diagnostic: repair });
        }
        }
        stage = 'composition';
        await new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, [path.join(appRoot(), 'video-renderer/render.mjs'), manifest], { cwd: appRoot(), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], timeout: 30 * 60_000, env: { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE, REMOTION_BROWSER_EXECUTABLE: process.env.REMOTION_BROWSER_EXECUTABLE } });
          let log = ''; child.stderr.on('data', bytes => { log = (log + bytes.toString()).slice(-20_000); });
          child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(Error(log || `Compositor exited ${code}`)));
        });
        if ((await readStatus(statusFile))?.status !== 'ready') throw Error('Incomplete render');
      } catch (error) {
        await fs.writeFile(path.join(directory, 'render-error.log'), String(error));
        await atomic(statusFile, { status: 'failed', stage });
      } finally { clearInterval(heartbeat); await fs.rmdir(lock).catch(() => {}); }
    };
    state.__chalkboardQueue = (state.__chalkboardQueue ?? Promise.resolve()).catch(() => {}).then(work);
  }
  return { status: (await readStatus(statusFile))?.status ?? 'queued', key };
}

export async function chalkboardFile(user: SessionUser, parts: string[]) {
  const [enrollmentId, moduleId, key] = parts;
  if (parts.length !== 3 || !/^[\w-]+$/.test(moduleId ?? '') || !/^[a-f0-9]{64}$/.test(key ?? '')) return null;
  if (!(await repo.listEnrollments(user.id)).some(e => e.id === enrollmentId)) return null;
  const directory = path.join(boardRoot(), enrollmentId, moduleId, key);
  if ((await readStatus(path.join(directory, 'status.json')))?.status !== 'ready') return null;
  const file = await courseVideoPresentation(path.join(directory, 'final.mp4'));
  try { await fs.access(file); return file; } catch { return null; }
}
