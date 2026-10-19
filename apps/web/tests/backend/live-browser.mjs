// Run against an isolated, Python-enabled dev server with no AI keys.
// Set PLAYWRIGHT_MODULE to a local Playwright module path when it is not installed in the repo.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3003";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__streams = [];
    window.__audio = [];
    window.EventSource = class extends EventTarget {
      constructor() { super(); window.__streams.push(this); }
      close() { this.closed = true; }
    };
    window.Audio = class extends EventTarget {
      constructor() { super(); this.currentTime = 0; this.duration = 100; this.paused = true; window.__audio.push(this); }
      set src(value) { this.url = value; this.currentTime = 0; setTimeout(() => { this.onloadedmetadata?.(); this.dispatchEvent(new Event("loadedmetadata")); }, 0); }
      get src() { return this.url; }
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
    };
  });
  let request;
  await page.route("**/adaptation-requests", async (route) => {
    const input = route.request().postDataJSON();
    if (input.trigger !== "initial") request = input;
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ job: { id: input.requestId, status: "queued" } }) });
  });
  await page.goto(base + "/auth/sign-in");
  let response = await page.request.put(base + "/api/v1/profile", { data: { answers: { domain: "healthcare", role: "admin" }, needs: [] } });
  assert(response.ok());
  response = await page.request.post(base + "/api/v1/enrollments", { data: { courseId: "ai-agent", answers: { domain: "healthcare", role: "admin" }, supportOverride: "auto", pace: null } });
  assert(response.ok());
  await page.goto(base + "/learn/courses/ai-agent/m1/explainer?video=m1-1");
  const simplify = page.getByRole("button", { name: "Simplify", exact: true });
  await simplify.waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__streams.length > 0);
  const initial = { id: "initial", videoId: "m1-1", slide: 0, status: "ready", trigger: "initial", audio: "/test-initial.wav", updatedAt: new Date().toISOString(), content: { kind: "title", icon: "bot", title: "Health desk agents", kicker: "Your work", sub: "Booking support", sentences: ["An agent helps your booking desk."], narration: "An agent helps your booking desk." } };
  const emit = (r) => page.evaluate((r) => { for (const stream of window.__streams.filter((s) => !s.closed)) stream.dispatchEvent(new MessageEvent("revision", { data: JSON.stringify(r) })); }, r);
  await emit(initial);
  await page.getByText("Health desk agents", { exact: true }).first().waitFor();
  await simplify.click();
  await page.getByText("Preparing your explanation and narration…").waitFor();
  assert(await simplify.isDisabled());
  await page.waitForTimeout(100);
  assert.equal(request.trigger, "simplify");
  const revised = { ...initial, id: request.requestId, requestId: request.requestId, trigger: "simplify", audio: "/test-simplified.wav", content: { ...initial.content, title: "A simpler booking example", sentences: ["Think of Scout as your desk assistant."], narration: "Think of Scout as your desk assistant." } };
  await emit(revised);
  await page.getByText("A simpler booking example", { exact: true }).first().waitFor();
  assert(await simplify.isEnabled());
  assert(await page.evaluate(() => window.__audio.some((a) => a.preload === "auto" && a.src === "/test-simplified.wav" && a.paused)), "A request made while paused keeps the matching audio paused");
  await page.getByRole("button", { name: "Play the video", exact: true }).last().click();
  await simplify.click();
  await page.waitForTimeout(100);
  await emit({ ...revised, id: request.requestId, requestId: request.requestId, audio: "/test-playing.wav", content: { ...revised.content, title: "An explanation while playing" } });
  await page.getByText("An explanation while playing", { exact: true }).first().waitFor();
  await page.waitForFunction(() => window.__audio.some((a) => a.preload === "auto" && a.src === "/test-playing.wav" && !a.paused));
  await simplify.click();
  await page.waitForTimeout(100);
  const timedOut = { ...request };
  await page.getByText("Preparation is taking longer than expected. You can resume or retry.").waitFor({ timeout: 25000 });
  assert(await simplify.isEnabled());
  await emit({ ...revised, id: timedOut.requestId, requestId: timedOut.requestId, content: { ...revised.content, title: "TIMED OUT CONTENT MUST NOT APPEAR" } });
  assert.equal(await page.getByText("TIMED OUT CONTENT MUST NOT APPEAR").count(), 0);
  // A background revision is held until its slide opens, even during continuous playback.
  await emit({ ...initial, id: "next-initial", slide: 1, audio: "/test-next.wav", content: { ...initial.content, title: "The next personalised slide" } });
  await simplify.click();
  await page.waitForTimeout(100);
  const lateRequest = { ...request };
  await page.getByRole("button", { name: /next slide/i }).click();
  await page.getByText("The next personalised slide", { exact: true }).first().waitFor();
  await emit({ ...revised, id: lateRequest.requestId, requestId: lateRequest.requestId, content: { ...revised.content, title: "STALE CONTENT MUST NOT APPEAR" } });
  assert.equal(await page.getByText("STALE CONTENT MUST NOT APPEAR").count(), 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  await page.screenshot({ path: "apps/web/.data/tests/live-player.png", fullPage: true });
  console.log("PASS browser: initial personalisation, current-slide request, matching audio, paused/playing state, timeout recovery, slide boundaries, navigation cancellation and no React errors");
} finally { await browser.close(); }
