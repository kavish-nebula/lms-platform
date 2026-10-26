// Live-provider demonstration. Use a separate PGLITE_DIR and app instance;
// simulated answers must never be submitted to the learner's normal database.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const base = process.env.LOOP_DEMO_URL || "http://127.0.0.1:3005";
const original = process.env.LOOP_SOURCE_URL || "http://127.0.0.1:3002";
assert.notEqual(base, original, "Use a separate test instance");
const out = process.env.LOOP_OUTPUT_DIR || "apps/web/.data/loop-demo";
await fs.mkdir(out, { recursive: true });
async function api(url, body) {
  const response = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  assert(response.ok, JSON.stringify(data));
  return data;
}
const course = `${base}/api/v1/enrollments/ai-agent`;
const runId = `loop-test-${randomUUID()}`;
const sourceProfile = (await api(`${original}/api/v1/profile`)).profile;
const sourceEnrollment = (await api(`${original}/api/v1/enrollments`)).enrollments.find((e) => e.courseId === "ai-agent");
const resume = process.env.LOOP_RESUME === "true";
if (!resume) await api(`${base}/api/v1/me/import`, { profile: sourceProfile, enrollments: [{ courseId: "ai-agent", answers: sourceEnrollment.answers, supportOverride: sourceEnrollment.supportOverride, precheck: sourceEnrollment.precheck }], progress: {} });
const originalProgress = sourceEnrollment.progress;
const baselineEvidence = await api(`${course}/modules/m1/performance`);
if (!resume) assert(baselineEvidence.summary.insufficientEvidence, "The demo database must start without test evidence; use a fresh PGLITE_DIR for each run");

async function generate(label, moduleId = "m2", videoId = "m2-1", slide = 1) {
  const started = Date.now();
  const targetModule = `${course}/modules/${moduleId}`;
  const oneShot = process.env.LOOP_ONESHOT === "true";
  const { job } = await api(`${targetModule}/adaptation-requests`, { videoId, slide, trigger: oneShot ? "initial" : "example", requestId: randomUUID() });
  console.log(`${label}: job ${job.id} queued for real AI and speech`);
  if (oneShot && job.status !== "ready") {
    // Run the real worker once against the open slide's promoted background job.
    // Other queued lessons stay durable without spending provider quota on them.
    const code = `import os, httpx\nfrom adaptive_api.worker import run_once\nfrom adaptive_api.config import settings\nc=settings()\ndef remote(job):\n r=httpx.post(os.environ['ADAPTIVE_API_URL']+'/v1/generate',headers={'Authorization':'Bearer '+c['token']},json={'input':job['input']},timeout=120)\n r.raise_for_status()\n return r.json()\nwith httpx.Client(base_url=c['lms']+'/api/internal/adaptation/',headers={'Authorization':'Bearer '+c['token']},timeout=600) as client:\n assert run_once(client,remote,'background'), 'Expected an open-slide job'\n`;
    const worker = await promisify(execFile)(process.env.ADAPTIVE_PYTHON_BIN || path.resolve("apps/adaptive-api/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), ["-c", code], { cwd: path.resolve("apps/adaptive-api"), env: process.env, timeout: 650_000, windowsHide: true });
    if (worker.stderr) console.error(worker.stderr.trim());
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  let buffer = "", ready;
  try {
    const response = await fetch(`${targetModule}/adaptation-events`, { signal: controller.signal });
    for await (const chunk of response.body) {
      buffer += new TextDecoder().decode(chunk);
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const line = block.split("\n").find((s) => s.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6));
        if (event.id !== job.id) continue;
        if (oneShot && event.status !== "ready") throw new Error(`${label}: one-shot worker left job ${event.status}; inspect the isolated service log`);
        if (event.status === "failed") throw new Error(`${label}: generation failed; inspect the isolated service log`);
        if (event.status === "ready") { ready = event; break; }
      }
      if (ready) break;
    }
  } finally { clearTimeout(timeout); controller.abort(); }
  assert(ready?.content && ready.audio, "Matching slide and narration must be ready");
  const audio = await fetch(base + ready.audio);
  const bytes = Buffer.from(await audio.arrayBuffer());
  assert(audio.ok && bytes.subarray(0, 4).toString() === "RIFF" && bytes.length > 44);
  await fs.writeFile(`${out}/${label}.wav`, bytes);
  const result = { ...ready, moduleId, elapsedSeconds: (Date.now() - started) / 1000, audioBytes: bytes.length, audioHash: createHash("sha256").update(bytes).digest("hex") };
  await fs.writeFile(`${out}/${label}.json`, JSON.stringify(result, null, 2));
  console.log(`${label}: real slide + WAV ready in ${result.elapsedSeconds.toFixed(1)} seconds`);
  return result;
}

const firstModule = process.env.LOOP_INCLUDE_MODULE1 === "true" ? (resume ? JSON.parse(await fs.readFile(`${out}/module1.json`, "utf8")) : await generate("module1", "m1", "m1-1", 0)) : null;
const before = resume ? JSON.parse(await fs.readFile(`${out}/before.json`, "utf8")) : await generate("before");
assert(!before.content.narration.toLowerCase().includes("quick reminder"));
const videos = JSON.parse(await fs.readFile("fixtures/videos-ai-agent.json", "utf8")).videos;
const q = videos.find((v) => v.id === "m1-1").midQuiz;
const signals = q.slice(0, 2).map((question, i) => ({ id: `${runId}-miss-${i}`, kind: "video_check", moduleId: "m1", lesson: "1.1", payload: { videoId: "m1-1", section: "mid", question: i, response: (question.correct + 1) % question.options.length, testRunId: runId } }));
if (!resume) {
  const signalResult = await api(`${course}/signals`, { signals });
  assert.equal(signalResult.accepted, 2);
}
const evidence = await api(`${course}/modules/m1/performance`);
assert.equal(evidence.summary.concepts["1.1"].misses, 2);
assert(evidence.summary.weakLessons.includes("1.1"));
console.log("Two simulated misses were server-scored; lesson 1.1 now requires prerequisite support");

// Exercise the actual module-completion handoff on this test enrollment.
const mod = JSON.parse(await fs.readFile("fixtures/module-ai-agent-m1.json", "utf8"));
for (const stage of mod.blocks.map((b) => b.stage)) await api(`${course}/progress`, { moduleId: "m1", stage });
const planDeadline = Date.now() + 60_000;
let enrollment;
do {
  enrollment = (await api(course)).enrollment;
  if (!enrollment.pending) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
} while (Date.now() < planDeadline);
assert(!enrollment.pending, "Wait for the evidence-driven plan revision before generating Module 2");
console.log("Module completion and plan revision persisted; generating the same Module 2 slide again");
const after = await generate("after");
assert(after.content.narration.toLowerCase().includes("quick reminder"));
const visible = JSON.stringify(Object.fromEntries(Object.entries(after.content).filter(([k]) => !["narration", "sentences"].includes(k)))).toLowerCase();
assert(visible.includes("quick reminder"));
assert.notEqual(before.audioHash, after.audioHash);
assert.notEqual(before.content.narration, after.content.narration);
const finalOriginal = (await api(`${original}/api/v1/enrollments`)).enrollments.find((e) => e.courseId === "ai-agent");
assert.deepEqual(finalOriginal.progress, originalProgress, "Original saved progress must remain unchanged");
assert.deepEqual((await api(`${original}/api/v1/profile`)).profile, sourceProfile, "Original profile must remain unchanged");
assert.deepEqual(finalOriginal.answers, sourceEnrollment.answers, "Original enrollment answers must remain unchanged");
const report = { runId, simulated: true, originalRecordsUnchanged: true, testApp: base, profile: sourceProfile.answers, enrollmentAnswers: sourceEnrollment.answers, module1: firstModule, module1Authored: firstModule ? videos.find((v) => v.id === "m1-1").slides[0] : null, evidence, planVersion: enrollment.plan?.version, planChanges: enrollment.plan?.changes, before, after };
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log("PASS real feedback loop: verified Module 1 evidence -> plan revision -> changed Module 2 slide and narration; original progress unchanged");
