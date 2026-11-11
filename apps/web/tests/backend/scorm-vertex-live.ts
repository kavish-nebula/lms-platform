import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getSessionUser } from '@/server/auth';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import * as repo from '@/server/repo';
import { importScormTopic, activateScormPilot, readScorm, scormCourseDelivery } from '@/server/scorm-builder';
import { getBlock } from '@/data/client';
import { queueSlide, claimJob, finishJob, heartbeat, jobsFor } from '@/server/adapt/live';
import { vertexAccessToken } from '@/server/ai/vertex';
import { audioRoot } from '@/server/adapt/tts';

const out = process.env.SCORM_VERIFY_OUTPUT!;
assert.equal(process.env.PGLITE_DIR, 'memory://', 'Never run synthetic profiles against the learner database.');
assert(!process.env.DATABASE_URL, 'Live verification must never connect to the application PostgreSQL database.');
await fs.mkdir(out, { recursive: true });
try {
  await vertexAccessToken();
} catch {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ status: 'blocked', reason: 'Vertex ADC or Google credential file is not configured. No live lesson/audio verification performed.' }, null, 2));
  console.error('BLOCKED: Vertex authentication is unavailable. Supply GOOGLE_APPLICATION_CREDENTIALS or configure ADC.');
  process.exit(2);
}
const topicId = 'AIforProduction-M1-T1';
const source = await readScorm('get_topic', { topicId }) as { topic: { version: number } };
const owner = await getSessionUser();
const imported = await importScormTopic(owner.id, 'AIforProduction', topicId, source.topic.version);
await activateScormPilot(owner.id, imported.id, imported.fingerprint);
const delivery = (await scormCourseDelivery('ai-for-production'))!;
const videos = getBlock(delivery.modules[0]!, 'explainer')!.videos!;
const people = [
  { id: 'vertex-pilot-mechanical', domain: 'other', domainOther: 'mechanical engineering', role: 'engineer', words: /mechanic|engineer|machine|manufactur|production/i },
  { id: 'vertex-pilot-healthcare', domain: 'healthcare', domainOther: undefined, role: 'admin', words: /health|clinic|patient|hospital|appointment/i },
];
const records: { profile: string; video: string; slide: number; narration: string; audioFile: string; model: string; bytes: number }[] = [];
function generate(input: unknown): Promise<{ content: unknown; model: string; metrics: Record<string, number> }> {
  const python = process.env.ADAPTIVE_PYTHON_BIN || path.resolve('apps/adaptive-api/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['-c', 'import json,sys; from adaptive_api.pipeline import generate; print(json.dumps(generate(json.load(sys.stdin))))'], { cwd: path.resolve('apps/adaptive-api'), env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; });
    // Provider responses and credentials are never copied into the report/log.
    child.stderr.on('data', () => {});
    child.on('error', () => reject(new Error('Python teaching service could not start.')));
    child.on('close', code => { if (code) reject(new Error('Vertex teaching generation failed; check model access, region and IAM.')); else { try { resolve(JSON.parse(output)); } catch { reject(new Error('Invalid teaching-service response.')); } } });
    child.stdin.end(JSON.stringify({ input }));
  });
}
try {
  for (const person of people) {
    await (await db()).insert(users).values({ id: person.id, name: person.id, email: `${person.id}@example.invalid` });
    await repo.saveProfile(person.id, { domain: person.domain, domainOther: person.domainOther, role: person.role, style: 'step_by_step' }, []);
    const enrollment = await repo.upsertEnrollment(person.id, 'ai-for-production', { answers: {}, supportOverride: 'auto', pace: null, precheck: null });
    for (const video of videos) for (let slide = 0; slide < video.slides.length; slide++) {
      if (process.env.SCORM_VERIFY_SAMPLE === 'true' && slide > 0) continue;
      const job = await queueSlide({ id: person.id, name: person.id, email: '' }, 'ai-for-production', 'M1', video.id, slide, 'initial');
      const claimed = (await claimJob('background'))!; assert.equal(claimed.id, job.id);
      const pulse = setInterval(() => void heartbeat(claimed.id, claimed.lease!).catch(() => {}), 15_000);
      try {
        const result = await generate(claimed.input);
        await finishJob(claimed.id, claimed.lease!, result.content, result.model, result.metrics);
      } finally { clearInterval(pulse); }
      const ready = (await jobsFor(enrollment.id, 'M1')).find(r => r.id === claimed.id)!;
      assert.equal(ready.status, 'ready');
      const content = ready.content as { sentences: string[]; narration: string };
      assert.equal(content.sentences.join(' ').trim(), content.narration);
      assert(ready.audio);
      const file = path.join(audioRoot(), enrollment.id, 'M1', 'clips', path.basename(ready.audio));
      const bytes = await fs.readFile(file); assert.equal(bytes.subarray(0, 4).toString(), 'RIFF'); assert(bytes.length > 1000);
      const audioFile = `${person.id}-${video.id}-s${slide}.wav`; await fs.copyFile(file, path.join(out, audioFile));
      records.push({ profile: person.id, video: video.id, slide, narration: content.narration, audioFile, bytes: bytes.length, model: ready.model! });
      await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ status: 'running', records }, null, 2));
      console.log(`${person.id}: ${video.title}, slide ${slide + 1}: text/audio ready`);
    }
    assert(records.filter(r => r.profile === person.id).some(r => person.words.test(r.narration)), 'Personalized teaching must contain relevant profile context.');
    assert.deepEqual(await repo.progressFor(enrollment.id), [], 'Verification must not submit learner completion.');
  }
  const first = records.filter(r => r.profile === people[0]!.id); const second = records.filter(r => r.profile === people[1]!.id);
  assert.equal(first.length, second.length); assert(first.some((r, i) => r.narration !== second[i]!.narration));
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ status: 'passed', coverage: process.env.SCORM_VERIFY_SAMPLE === 'true' ? 'first slide of every source lesson, two profiles' : 'all imported slides, two profiles', records }, null, 2));
  console.log('PASS: Vertex lesson generation and matching WAV narration for two isolated profiles.');
} catch {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ status: 'failed', reason: 'Live provider generation or validation failed. Partial outputs are not a passing result.', records }, null, 2));
  console.error('FAIL: Live Vertex verification did not complete. See the local report; no main learner data was modified.');
  process.exitCode = 1;
}
