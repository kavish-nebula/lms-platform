// Real-provider prompt smoke test. Run only against a fresh isolated PGLITE_DIR.
// Synthetic responses belong to this test copy, never the main learner.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";

const base = process.env.PROMPT_SMOKE_URL || "http://127.0.0.1:3007";
const original = process.env.PROMPT_SOURCE_URL || "http://127.0.0.1:3002";
assert.notEqual(new URL(base).origin, new URL(original).origin, "Use an isolated app instance");
const out = "apps/web/.data/prompt-v4";
await fs.mkdir(out, { recursive: true });
async function api(url, body) {
  const r = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await r.json();
  assert(r.ok, `API failed: ${r.status}`);
  return data;
}
const profile = (await api(`${original}/api/v1/profile`)).profile;
const enrollment = (await api(`${original}/api/v1/enrollments`)).enrollments.find((e) => e.courseId === "ai-agent");
const course = `${base}/api/v1/enrollments/ai-agent`;
await api(`${base}/api/v1/me/import`, { profile, enrollments: [{ courseId: "ai-agent", answers: enrollment.answers, supportOverride: enrollment.supportOverride, precheck: enrollment.precheck }], progress: {} });
assert((await api(`${course}/modules/m1/performance`)).summary.insufficientEvidence, "Use a fresh test database");

async function generate(label, moduleId, videoId, slide) {
  const started = Date.now();
  const moduleUrl = `${course}/modules/${moduleId}`;
  const { job } = await api(`${moduleUrl}/adaptation-requests`, { videoId, slide, trigger: "example", requestId: randomUUID() });
  console.log(`${label}: queued ${job.id}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  let buffer = "", ready;
  try {
    const r = await fetch(`${moduleUrl}/adaptation-events`, { signal: controller.signal });
    assert(r.ok);
    for await (const chunk of r.body) {
      buffer += new TextDecoder().decode(chunk);
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const line = block.split("\n").find((s) => s.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6));
        if (event.id !== job.id) continue;
        assert.notEqual(event.status, "failed", `${label}: real generation failed`);
        if (event.status === "ready") { ready = event; break; }
      }
      if (ready) break;
    }
  } finally { clearTimeout(timer); controller.abort(); }
  assert(ready?.content && ready.audio);
  assert.equal(ready.content.narration, ready.content.sentences.join(" "));
  const voice = await fetch(base + ready.audio);
  const bytes = Buffer.from(await voice.arrayBuffer());
  assert(voice.ok && bytes.subarray(0, 4).toString() === "RIFF" && bytes.length > 44);
  await fs.writeFile(`${out}/${label}.wav`, bytes);
  const result = { ...ready, seconds: (Date.now() - started) / 1000, audioBytes: bytes.length, audioHash: createHash("sha256").update(bytes).digest("hex") };
  await fs.writeFile(`${out}/${label}.json`, JSON.stringify(result, null, 2));
  console.log(`${label}: matching narration and WAV ready in ${result.seconds.toFixed(1)}s`);
  return result;
}
const module1 = await generate("module1", "m1", "m1-2", 3);
const videos = JSON.parse(await fs.readFile("fixtures/videos-ai-agent.json", "utf8")).videos;
const quiz = videos.find((v) => v.id === "m1-1").midQuiz;
const signals = quiz.slice(0, 2).map((q, i) => ({ id: `prompt-smoke-${randomUUID()}`, kind: "video_check", moduleId: "m1", payload: { videoId: "m1-1", section: "mid", question: i, response: (q.correct + 1) % q.options.length } }));
assert.equal((await api(`${course}/signals`, { signals })).accepted, 2);
const evidence = await api(`${course}/modules/m1/performance`);
assert(evidence.summary.weakLessons.includes("1.1"));
const module2 = await generate("module2", "m2", "m2-1", 1);
assert.match(module2.content.narration, /quick reminder/i);
assert.match(JSON.stringify(Object.fromEntries(Object.entries(module2.content).filter(([k]) => !["sentences", "narration"].includes(k)))), /quick reminder/i);
const after = (await api(`${original}/api/v1/enrollments`)).enrollments.find((e) => e.courseId === "ai-agent");
assert.deepEqual(after.progress, enrollment.progress);
assert.deepEqual((await api(`${original}/api/v1/profile`)).profile, profile);
await fs.writeFile(`${out}/smoke-report.json`, JSON.stringify({ simulated: true, originalRecordsUnchanged: true, evidence, module1, module2 }, null, 2));
console.log("PASS prompt v4 live smoke: personalised Module 1 and prerequisite-aware Module 2 with matching audio; actual learner unchanged");
