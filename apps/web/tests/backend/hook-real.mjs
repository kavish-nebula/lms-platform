// Real-provider smoke test for an existing main-app enrollment. No answers or
// progress are submitted; GET preparation is the same trigger as opening a hook.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const base = process.env.MAIN_HOOK_URL || "http://127.0.0.1:3002";
const out = path.resolve(process.env.MAIN_HOOK_OUTPUT || "apps/web/.data/tests/main-hook");
await fs.mkdir(out, { recursive: true });
const get = async (url) => {
  const response = await fetch(base + url);
  assert(response.ok, `HTTP ${response.status} for ${url}`);
  return response.json();
};
const before = JSON.parse(await fs.readFile(process.env.MAIN_HOOK_BEFORE || "apps/web/.data/tests/main-hook-before.json", "utf8"));
let adapted;
const started = Date.now();
while (Date.now() - started < 360_000) {
  adapted = (await get("/api/v1/enrollments/ai-agent/modules/m1/adapted?piece=hook")).adapted;
  if (adapted.hook && adapted.pieces.hook.status === "ready") break;
  assert.notEqual(adapted.pieces.hook.status, "failed", "The current hook failed; inspect main-app service logs");
  await new Promise((resolve) => setTimeout(resolve, 8000));
}
assert(adapted?.hook, "Timed out waiting for the complete hook and matching audio");
const hook = adapted.hook;
assert.equal(hook.brand.name, "Harbour Works");
const field = before.profile.profile.answers.studyFieldOther || before.profile.profile.answers.domainOther || before.profile.profile.answers.domain;
const fieldWords = field.toLowerCase().match(/[a-z]+/g).filter(word => word.length > 3 && !["study", "studying", "engineering", "student", "other"].includes(word));
assert(fieldWords.some(word => hook.narration.toLowerCase().includes(word)), "Opening narration must use the current field");
assert(fieldWords.some(word => JSON.stringify(hook.film).toLowerCase().includes(word)), "Film must use the current field");
assert(!/\bOrbit\b|ORB-\d+|Trailhead|tent\b/i.test(JSON.stringify(hook)), "Original retail story must not appear in the personalised hook");
const expected = ["open", ...(hook.film?.shots || []).flatMap((shot, index) => [`s${index}`, ...(shot.then ? [`s${index}-then`] : [])]), ...hook.reveal.timeline.map((_, index) => `r${index}`)];
const recordings = [];
for (const key of expected) {
  const url = hook.audio[key];
  assert(url?.startsWith("/api/v1/adapted-audio/") && url.endsWith(".wav"), `Missing own-app audio for ${key}`);
  const response = await fetch(base + url);
  assert(response.ok, `Audio not available: ${key}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString(), "WAVE");
  assert(bytes.length > 44);
  await fs.writeFile(path.join(out, `${key}.wav`), bytes);
  recordings.push({ key, url, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
const profile = await get("/api/v1/profile");
const enrollment = (await get("/api/v1/enrollments/ai-agent")).enrollment;
assert.deepEqual(profile, before.profile, "The main profile must remain unchanged");
assert.deepEqual(enrollment.answers, before.answers, "The enrollment answers must remain unchanged");
assert.deepEqual(enrollment.progress, before.progress, "The main learner progress must remain unchanged");
const report = { testedAt: new Date().toISOString(), mainApp: base, title: hook.title, narration: hook.narration, firstFilmShot: hook.film.shots[0], brand: hook.brand, courseFocus: enrollment.answers.expect, profileField: profile.profile.answers.studyFieldOther, recordings, originalRecordsUnchanged: true };
await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(`PASS main hook: ${hook.title}; ${recordings.length} real WAV clips verified; current profile and course focus used; profile, answers and progress unchanged`);
