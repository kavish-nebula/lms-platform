// Serves only the completed, isolated test report and its three generated WAVs.
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";

const out = path.resolve(process.env.LOOP_OUTPUT_DIR || "apps/web/.data/loop-demo");
const report = JSON.parse(await fs.readFile(path.join(out, "report.json"), "utf8"));
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function visible(slide) {
  const details = [slide.kicker, slide.sub, slide.note?.text].filter(Boolean);
  const nodes = slide.nodes?.map((node) => `<li><strong>${esc(node.label)}</strong><span>${esc(node.sub)}</span></li>`).join("") || "";
  return `<h3>${esc(slide.title)}</h3>${nodes ? `<ol class="flow">${nodes}</ol>` : ""}${details.map((text) => `<p>${esc(text)}</p>`).join("")}`;
}
function panel(label, slide, audio) {
  return `<article><p class="eyebrow">${esc(label)}</p>${visible(slide)}<h4>Narration</h4><p class="narration">${esc(slide.narration)}</p>${audio ? `<audio controls preload="metadata" aria-label="${esc(label)} narration" src="/${audio}"></audio><a class="download" href="/${audio}" download>Download this narration</a>` : "<p class='muted'>Original authored narration shown for comparison.</p>"}</article>`;
}
const profile = report.profile || {};
const field = profile.studyFieldOther || profile.domainOther || profile.studyField || profile.domain || "Not provided";
const focus = report.enrollmentAnswers?.expect || "Not provided";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Real adaptive learning test</title><style>
:root{color-scheme:light;--ink:#142c42;--muted:#536779;--line:#ccd7df;--blue:#1655a5;--paper:#fff;--bg:#f3f6fa}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:36px 28px 64px}h1{font-size:clamp(28px,4vw,42px);line-height:1.15;margin:0 0 12px}h2{font-size:28px;margin:36px 0 8px}h3{font-size:23px;line-height:1.3;margin:4px 0 18px}h4{font-size:16px;margin:24px 0 8px}.muted{color:var(--muted)}.status{font-weight:650;color:#08745f}.context{border-left:4px solid var(--blue);padding:10px 20px;background:var(--paper);margin:26px 0}.context p{margin:4px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}article{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:26px;min-width:0}.eyebrow{font-size:14px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;color:var(--blue);margin:0 0 12px}.narration{line-height:1.8}.flow{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0}.flow li{padding:12px;border:1px solid var(--line);border-radius:10px}.flow span{display:block;font-size:14px;color:var(--muted);margin-top:5px}audio{display:block;width:100%;margin-top:18px}a{color:var(--blue);text-underline-offset:3px}.download{display:inline-block;margin-top:12px;font-size:14px}.app-link{display:inline-block;margin-top:16px;font-weight:650}a:focus-visible{outline:3px solid var(--blue);outline-offset:4px}footer{margin-top:30px;color:var(--muted)}@media(max-width:800px){.grid{grid-template-columns:1fr}main{padding:24px 16px}article{padding:20px}}
</style></head><body><main><h1>Your adaptive learning loop</h1><p class="status">Real Google Gemini text generation · Local Kokoro audio</p><p class="muted">An isolated test using a copy of your learning preferences. The Module 1 answers below were simulated for this demonstration.</p><section class="context" aria-label="Learning context"><p><strong>Your field:</strong> ${esc(field)}</p><p><strong>Your course focus:</strong> ${esc(focus)}</p><p><strong>Performance input:</strong> two server-graded incorrect Module 1 answers about what an agent is.</p><p><strong>Your actual profile and progress:</strong> ${report.originalRecordsUnchanged ? "verified unchanged" : "not verified"}.</p></section>
<h2>1. Your profile changes Module 1</h2><p class="muted">Compare the authored lesson with the personalised version. Play the generated narration to hear the change.</p><div class="grid">${panel("Original Module 1", report.module1Authored)}${panel("Personalised Module 1", report.module1.content, "module1.wav")}</div><a class="app-link" href="${esc(report.testApp)}/learn/courses/ai-agent/m1/explainer?v=m1-1" target="_blank" rel="noopener">Open this Module 1 slide in the isolated app ↗</a>
<h2>2. Module 1 performance changes Module 2</h2><p class="muted">The same Module 2 slide, generated before and after the two simulated misses. Look and listen for “Quick reminder” in the second version.</p><div class="grid">${panel("Before Module 1 evidence", report.before.content, "before.wav")}${panel("After Module 1 evidence", report.after.content, "after.wav")}</div><a class="app-link" href="${esc(report.testApp)}/learn/courses/ai-agent/m2/explainer?v=m2-1" target="_blank" rel="noopener">Open Module 2 in the isolated app, then choose slide 2 ↗</a><footer>These are recorded outputs from the real services. Text and matching WAV audio were published together. Repeated LLM generations can vary; this test verifies the added visible and spoken prerequisite reminder.</footer></main></body></html>`;
await fs.writeFile(path.join(out, "comparison.html"), html);
if (process.argv.includes("--serve")) {
  const files = new Map([["/", ["comparison.html", "text/html; charset=utf-8"]], ["/module1.wav", ["module1.wav", "audio/wav"]], ["/before.wav", ["before.wav", "audio/wav"]], ["/after.wav", ["after.wav", "audio/wav"]]]);
  http.createServer(async (request, response) => {
    const entry = files.get(new URL(request.url, "http://127.0.0.1").pathname);
    if (!entry) { response.writeHead(404); response.end(); return; }
    try { const body = await fs.readFile(path.join(out, entry[0])); response.writeHead(200, { "content-type": entry[1], "content-length": body.length, "cache-control": "no-store" }); response.end(body); }
    catch { response.writeHead(500); response.end("Report file unavailable"); }
  }).listen(Number(process.env.LOOP_REPORT_PORT || 3010), "127.0.0.1", () => console.log("Comparison with playable real narration: http://127.0.0.1:3010"));
}
