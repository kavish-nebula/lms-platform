/* Shared shell helpers: topbar, modals, toasts, gating logic. */

function topbar(active, opts = {}) {
  const lm = lmGet();
  const mount = document.getElementById("topbar");
  if (!mount) return;
  const profileChip = opts.hideProfile
    ? ""
    : lm
      ? `<span class="chip accent">${expLabel(lm.experience_level)} · ${styleLabel(lm.learning_style_preference)}</span>`
      : `<a class="chip" href="index.html">Set up how you learn →</a>`;
  const reset = `<button class="btn-quiet" style="font-size:.75rem;color:var(--faint)" onclick="localStorage.clear();location.reload()" title="Wipe learner model + progress">Reset demo</button>`;
  const unlock = `<button class="btn-quiet" style="font-size:.75rem;color:var(--faint)" onclick="unlockAll()" title="Demo shortcut: pass all gates so any module/final can be opened">Unlock all</button>`;
  mount.innerHTML = `
    <div class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="courses.html">
          <span class="brand-name">${PLATFORM.name}</span>
          <span class="brand-tag">${PLATFORM.tagline}</span>
        </a>
        <nav class="topbar-links">
          <a href="courses.html" class="${active === "courses" ? "active" : ""}">Courses</a>
          <a href="evidence.html" class="${active === "evidence" ? "active" : ""}">My Evidence</a>
        </nav>
        <div class="topbar-right">${profileChip}${unlock}${reset}</div>
      </div>
    </div>`;
}

/* Demo shortcut: mark every mastery gate passed so reviewers can open
   any module, the final build, and the evidence page instantly. */
function unlockAll() {
  const p = pgGet();
  p.gates = p.gates || {};
  COURSE.modules.forEach((m) => { p.gates[m.n] = { score: m.gate.length, total: m.gate.length, passed: true, at: Date.now() }; });
  pgSet(p);
  location.reload();
}

function openModal(title, kindTag, bodyHTML, opts) {
  const locked = !!(opts && opts.locked);
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "modal-backdrop";
  if (locked) backdrop.dataset.locked = "1";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head">
        <div>${kindTag ? `<span class="chip accent kind-tag">${kindTag}</span>` : ""}<h2>${title}</h2></div>
        ${locked ? "" : `<button class="modal-close" aria-label="Close" onclick="closeModal()">×</button>`}
      </div>
      <div class="modal-body">${bodyHTML}</div>
    </div>`;
  if (!locked) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener("keydown", escClose);
  document.body.appendChild(backdrop);
}

function escClose(e) {
  if (e.key !== "Escape") return;
  const b = document.getElementById("modal-backdrop");
  if (b && b.dataset.locked === "1") return; // locked modals answer-or-skip only
  closeModal();
}

function closeModal() {
  const m = document.getElementById("modal-backdrop");
  if (m) m.remove();
  document.removeEventListener("keydown", escClose);
}

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- progress helpers ---------- */
/* Quiz display rule: the correct answer is ALWAYS shown as option 2.
   Normalizes any question object at render time; scoring uses the returned
   correct index (always 1). */
function withCorrectSecond(q) {
  const options = q.options.slice();
  if (q.correct === 1) return { ...q, options, correct: 1 };
  const item = options.splice(q.correct, 1)[0];
  options.splice(1, 0, item);
  return { ...q, options, correct: 1 };
}
function expLabel(v) {
  return { complete_beginner: "Beginner", beginner: "Beginner+", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert" }[v] || "Learner";
}
function styleLabel(v) {
  return { quick_simple: "Essentials", balanced: "Balanced", deep: "Deep", hands_on: "Hands-on", project_based: "Project-based" }[v] || "";
}
function gatePassed(n) { const p = pgGet(); return !!(p.gates && p.gates[n] && p.gates[n].passed); }
function gateScore(n) { const p = pgGet(); return p.gates && p.gates[n] ? p.gates[n] : null; }
function moduleUnlocked(n) { return n === 1 || gatePassed(n - 1); }
function gatesPassedCount() { return COURSE.modules.filter((m) => gatePassed(m.n)).length; }
function allGatesPassed() { return gatesPassedCount() === COURSE.modules.length; }
function finalPassed() { const p = pgGet(); return !!(p.final && p.final.passed); }
function videosWatched(n) { const p = pgGet(); return (p.videos && p.videos[n]) || []; }

function markVideoWatched(n, v) {
  const p = pgGet();
  p.videos = p.videos || {};
  p.videos[n] = p.videos[n] || [];
  if (!p.videos[n].includes(v)) p.videos[n].push(v);
  pgSet(p);
}

function recordGate(n, score, total, passed) {
  const p = pgGet();
  p.gates = p.gates || {};
  p.gates[n] = { score, total, passed, at: Date.now() };
  // schedule a spaced review item
  p.reviews = p.reviews || {};
  const mod = COURSE.modules.find((m) => m.n === n);
  if (mod && mod.review && passed) p.reviews[n] = { done: false, at: Date.now() };
  pgSet(p);
}

function recordScenario(n) {
  const p = pgGet(); p.scenarios = p.scenarios || []; if (!p.scenarios.includes(n)) p.scenarios.push(n); pgSet(p);
}
function recordProject(n) {
  const p = pgGet(); p.projects = p.projects || {}; p.projects[n] = { at: Date.now() }; pgSet(p);
}
function recordIntervention(n, v, correct) {
  const p = pgGet(); p.interventions = p.interventions || []; p.interventions.push({ n, v, correct, at: Date.now() }); pgSet(p);
}
function recordFinal(score, total, passed, reflection) {
  const p = pgGet(); p.final = { score, total, passed, reflection, at: Date.now() }; pgSet(p);
}
function answerReview(n) {
  const p = pgGet(); if (p.reviews && p.reviews[n]) { p.reviews[n].done = true; p.reviews[n].nextDue = Date.now() + 3 * 864e5; } pgSet(p);
}
function dueReviews() {
  const p = pgGet(); const out = [];
  COURSE.modules.forEach((m) => {
    if (p.reviews && p.reviews[m.n] && !p.reviews[m.n].done) out.push(m.n);
  });
  return out;
}
