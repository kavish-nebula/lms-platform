/* ============================================================
   The Doubt Bot — context-aware Q&A with a verification loop.
   After every answer, the bot asks ONE question back about its own
   explanation. The learner must answer it, closing the
   misunderstanding gap before it forms.
   (Mock KB now; real LLM hookup is a marked integration point.)
   ============================================================ */

(function () {
  const KB = [
    {
      keys: ["verb", "get", "post", "put", "delete", "patch", "method"],
      answer:
        "HTTP verbs are the actions of REST:\n• GET — read, never changes anything (safe)\n• POST — create (returns 201 + Location)\n• PUT — replace a resource\n• PATCH — change part of it\n• DELETE — remove (returns 204)\nThe URL says WHAT you act on; the verb says WHAT YOU DO. That's why '/getBooks' is a smell — the verb is already in the method.",
      verify: {
        q: "Quick check so this sticks — you need to add a new book. Which request?",
        options: ["POST /books", "GET /books", "PUT /getBook", "/books/add"],
        correct: 0,
        yes: "Exactly — create = POST on the collection, and it should answer 201 Created.",
        no: "Not quite — creating a new resource is POST /books. GET never creates, and verbs don't belong in URLs.",
      },
    },
    {
      keys: ["status code", "404", "400", "500", "201", "204", "status", "response code"],
      answer:
        "The status code is your API's body language:\n• 200 OK — here's your data\n• 201 Created — made it, see the Location header\n• 204 No Content — done, nothing to send\n• 400 — your request is malformed\n• 401 — I don't know who you are\n• 403 — I know you; you still can't\n• 404 — that resource doesn't exist\n• 422 — I understand it, but it's invalid (field-level errors)\n• 500 — my fault, check my logs",
      verify: {
        q: "Check me on this: a logged-in normal user hits an admin-only route. Status?",
        options: ["401 Unauthorized", "403 Forbidden", "404 Not Found"],
        correct: 1,
        yes: "Right — 403: identity proven, permission denied. 401 would mean 'who even are you?'",
        no: "It's 403 Forbidden. 401 is for unknown identity; once you're identified but not allowed, it's 403.",
      },
    },
    {
      keys: ["401", "403", "unauthorized", "forbidden"],
      answer:
        "401 vs 403 — the distinction candidates mix up most:\n• 401 Unauthorized really means 'unauthenticated' — no token, bad token, expired token. 'Who are you?'\n• 403 Forbidden means 'authenticated, but not allowed' — logged in as a normal user hitting an admin route.\nOrder matters: authenticate first (401), then authorize (403).",
      verify: {
        q: "Verify it: a request arrives with no Authorization header at all. Which status?",
        options: ["403", "401", "400"],
        correct: 1,
        yes: "Correct — no identity, 401. You can't forbid someone you haven't identified.",
        no: "It's 401 — with no token there's no identity yet. 403 comes only after you know who they are.",
      },
    },
    {
      keys: ["rest", "restful", "architecture"],
      answer:
        "REST is a style, not a spec: resources as nouns (URLs), actions as HTTP verbs, standards as the contract.\n• /books is a collection; /books/42 is one book\n• The verb lives in the method, not the path\n• Status codes carry meaning\n• Stateless: every request carries everything needed\nIf your URLs contain verbs (/getBooks), you're probably building RPC and calling it REST.",
      verify: {
        q: "Test the model: which URL names the resource correctly?",
        options: ["/api/retrieveBook?id=42", "/books/42", "/books?action=getOne&b=42"],
        correct: 1,
        yes: "Right — noun, plural collection, identifier in the path.",
        no: "It's /books/42 — the noun names the thing, the method does the doing.",
      },
    },
    {
      keys: ["json", "payload", "content-type", "body"],
      answer:
        "JSON is the common language of request/response bodies. Two rules that matter:\n• Always send Content-Type: application/json — it tells the server how to parse you\n• Keep payload shape consistent (an envelope: data, error, meta)\nAn inconsistent shape means every client writes a special-case parser — that's how APIs rot.",
      verify: {
        q: "Sanity check: what does Content-Type: application/json actually control?",
        options: ["Which database is used", "How the receiver parses the body", "Whether the response is cached"],
        correct: 1,
        yes: "Yes — it's parsing instructions, nothing more.",
        no: "It tells the receiver HOW to parse the body. Nothing to do with databases or caching.",
      },
    },
    {
      keys: ["pagination", "cursor", "offset", "page", "limit", "scale", "10,000", "10000"],
      answer:
        "Pagination keeps responses bounded:\n• Offset (?page=5000) gets slow deep in lists — the DB counts and discards\n• Cursor (?after=bk_5042) seeks to a position — constant cost\nPair either with: a default limit, a hard max (clamped visibly), and meta (hasMore, nextCursor) so clients never need a request just to discover there's nothing left.",
      verify: {
        q: "Make sure it landed: why do cursors beat deep offsets?",
        options: ["They're shorter URLs", "The DB seeks instead of counting and discarding rows", "They encrypt the page"],
        correct: 1,
        yes: "Exactly — seek, don't scan-and-discard.",
        no: "Cursors let the DB seek straight to a position. Offsets count and throw away every skipped row.",
      },
    },
    {
      keys: ["versioning", "v1", "v2", "deprecat", "breaking change"],
      answer:
        "Versioning = keeping old promises while shipping new ones.\nShip /v2 alongside /v1, give clients a migration window, deprecate with notice — never with a countdown surprise.\nSmall additive changes (a new field) usually don't need a version; breaking ones (renames, removals, semantic changes) do.",
      verify: {
        q: "Confirm the rule: renaming a field every client reads requires…",
        options: ["A new major version", "A weekend deploy", "Both names forever with no plan"],
        correct: 0,
        yes: "Right — breaking change, new major version, graceful deprecation.",
        no: "Renames break parsers — that's a new major version with a deprecation window.",
      },
    },
    {
      keys: ["auth", "token", "jwt", "session", "login", "oauth"],
      answer:
        "AuthN (who are you) then AuthZ (what may you do).\n• Sessions: server stores state, client holds an id — simple, single-server\n• Tokens (JWT): signed claims travel with the request — stateless, multi-server\nJWT claims: who, role, expiry — signed so they can't be forged. Never put secrets in a token; it's readable, not encrypted.\nVerify in middleware before the handler. Fail closed.",
      verify: {
        q: "Lock it in: where does a JWT's trust come from?",
        options: ["Its secrecy", "The server's signature verification", "Its length"],
        correct: 1,
        yes: "Correct — tokens are signed, not secret. The signature is the trust.",
        no: "JWTs are readable by anyone holding them — trust comes from the signature only the server can verify.",
      },
    },
    {
      keys: ["hash", "password", "salt", "bcrypt", "encrypt password"],
      answer:
        "Passwords: salted one-way hashes (bcrypt/argon2), never encryption.\nWhy: you never need to read a password back — only verify 'does this input produce this hash?' A hash can't be reversed; a leak of hashes isn't a leak of passwords. Encryption IS reversible with the key — and keys get leaked.",
      verify: {
        q: "Check your model: why hash instead of encrypt?",
        options: ["Hashing is faster", "Hashes can't be reversed — only verified", "Encrypted passwords need more storage"],
        correct: 1,
        yes: "Right — one-way by design; verification doesn't need reversal.",
        no: "One-way is the point: you verify, you never read back. Encryption is reversible and keys leak.",
      },
    },
    {
      keys: ["error", "error handling", "422", "validation", "contract"],
      answer:
        "Errors are a feature of your contract:\n• Right status (422/400 for validation)\n• Stable machine code (VALIDATION_FAILED)\n• Human message\n• Field-level details: [{path, issue}]\n• What the client should DO next\nNever leak stack traces/SQL — those are for logs. And design the retry: idempotency keys for anything that costs money.",
      verify: {
        q: "One to verify: a POST has 3 invalid fields. The best response lists…",
        options: ["The first error only", "All 3 fields with issues", "A generic 'invalid input'"],
        correct: 1,
        yes: "Exactly — one round trip, every issue named. Fix-forward UX.",
        no: "List all of them — otherwise users fix one field per request and learn to hate your API.",
      },
    },
    {
      keys: ["log", "logging", "debug", "trace", "observ"],
      answer:
        "Debugging is evidence-gathering:\n• Log per request: request id, user id, route, status, duration — never secrets\n• Correlation ids tie a user complaint to the exact server line\n• Reproduce first, theorize second: the network tab + logs will name the failing conversation\nIf users can report 'nothing happened', your API returned 200 for a failure — a contract bug, not just bad luck.",
      verify: {
        q: "Quick verify: your log line should never contain…",
        options: ["The route and duration", "Passwords or full request bodies with secrets", "The status code"],
        correct: 1,
        yes: "Right — logs are context; secrets in logs are a breach.",
        no: "Secrets never go to logs — they're readable by everyone with log access.",
      },
    },
    {
      keys: ["retry", "timeout", "idempot", "network", "duplicate"],
      answer:
        "Networks fail after the work is done: the server charged the card, then the response died. The client will retry — design for it.\nIdempotency key: client sends the same key on retries; the server collapses duplicates into one operation.\nSafe by default: GET/PUT/DELETE are idempotent; POST is not — that's why payments need keys.",
      verify: {
        q: "Verify: why can a retried POST create two charges?",
        options: ["POSTs are slow", "POST isn't idempotent — each call is a new operation", "Servers are buggy"],
        correct: 1,
        yes: "Correct — and idempotency keys are the fix.",
        no: "POST means 'do it again' — every call is a fresh operation unless you add an idempotency key.",
      },
    },
    {
      keys: ["middleware", "gatekeeper", "interceptor"],
      answer:
        "Middleware = code that runs before your handler, per request.\nAuth middleware: verify token → attach req.user → reject with 401/403 before any handler logic. Logging middleware: request id + timing. Validation middleware: shape-check the body.\nThe pattern keeps handlers about the work, and policy about the wall.",
      verify: {
        q: "Position check: middleware runs…",
        options: ["After the handler", "Before the handler", "Inside the database"],
        correct: 1,
        yes: "Right — policy before work; rejected requests never reach handlers.",
        no: "Before — the whole point is rejecting bad requests before handler logic runs.",
      },
    },
  ];

  const CONTEXT_SUGGESTIONS = {
    "courses": ["What makes a course 'REST API Engineering'?", "How is progress measured here?"],
    "course": ["What are the 9 steps of the loop?", "What is a mastery gate?", "Why do modules revisit old topics?"],
    "lesson": ["What is a REST resource?", "Which status code for a missing book?", "Why is GET called safe?"],
    "assessment": ["401 vs 403?", "When do I use 201 vs 204?"],
  };

  /* ---------- the mascot ---------- */
  function mascotSVG(size) {
    return `
    <svg class="mascot" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
      <!-- body -->
      <path d="M17 64 q15 -12 30 0 z" fill="#14655a"/>
      <path d="M28.5 51 l3.5 6 3.5 -6 z" fill="#f3ead3"/>
      <!-- head -->
      <circle cx="32" cy="29" r="19" fill="#ffd9b3"/>
      <!-- hair -->
      <path d="M13 28 a19 19 0 0 1 38 0 q-4 -9 -19 -9 t-19 9z" fill="#5b4636"/>
      <circle cx="47" cy="16" r="3" fill="#5b4636"/>
      <!-- rosy cheeks -->
      <circle cx="19" cy="36" r="3.4" fill="#f4a688" opacity=".55"/>
      <circle cx="45" cy="36" r="3.4" fill="#f4a688" opacity=".55"/>
      <!-- glasses -->
      <circle cx="24.5" cy="30" r="6" fill="#fffdf8" stroke="#3a352c" stroke-width="1.6"/>
      <circle cx="39.5" cy="30" r="6" fill="#fffdf8" stroke="#3a352c" stroke-width="1.6"/>
      <line x1="30.5" y1="30" x2="33.5" y2="30" stroke="#3a352c" stroke-width="1.6"/>
      <!-- eyes -->
      <circle cx="24.5" cy="30.5" r="2" fill="#2a2620"/>
      <circle cx="39.5" cy="30.5" r="2" fill="#2a2620"/>
      <circle cx="25.2" cy="29.7" r=".6" fill="#fff"/>
      <circle cx="40.2" cy="29.7" r=".6" fill="#fff"/>
      <!-- smile -->
      <path d="M27 40.5 q5 4.5 10 0" stroke="#a4432f" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  /* ---------- build UI ---------- */
  const fab = document.createElement("button");
  fab.className = "bot-fab";
  fab.setAttribute("aria-label", "Ask the teacher");
  fab.innerHTML = mascotSVG(44) + `<span class="mascot-bubble">Ask me!</span>`;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.className = "bot-panel";
  panel.innerHTML = `
    <div class="bot-head">
      <div style="display:flex;align-items:center;gap:10px">
        ${mascotSVG(34)}
        <div>
          <div class="t">Professor Proofer</div>
          <div class="ctx" id="bot-ctx"></div>
        </div>
      </div>
      <button class="modal-close" id="bot-close" aria-label="Close bot">×</button>
    </div>
    <div class="bot-msgs" id="bot-msgs"></div>
    <div class="bot-suggest" id="bot-suggest"></div>
    <div class="bot-input">
      <input id="bot-input" type="text" placeholder="Ask anything about this topic…" aria-label="Ask the bot" />
      <button id="bot-send" aria-label="Send">↑</button>
    </div>`;
  document.body.appendChild(panel);

  const msgs = panel.querySelector("#bot-msgs");
  const input = panel.querySelector("#bot-input");
  const ctx = document.body.dataset;

  function contextLabel() {
    const topic = ctx.botTopic || "";
    const mod = ctx.botModule ? ` · Module ${ctx.botModule}` : "";
    return `${ctx.botPage || "this page"}${mod}${topic ? " · " + topic : ""}`;
  }

  function addMsg(text, cls) {
    const d = document.createElement("div");
    d.className = "msg " + (cls || "bot");
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function addVerify(v) {
    const d = document.createElement("div");
    d.className = "msg verify";
    d.innerHTML = `<strong>Let me verify — so there's no gap here.</strong><br>${v.q}<div class="verify-opts"></div>`;
    const opts = d.querySelector(".verify-opts");
    v.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "verify-opt";
      b.textContent = o;
      b.onclick = () => {
        opts.querySelectorAll("button").forEach((x) => (x.disabled = true));
        b.style.borderColor = i === v.correct ? "var(--good)" : "var(--warn)";
        addMsg(i === v.correct ? "✓ " + v.yes : "△ " + v.no, "bot");
      };
      opts.appendChild(b);
    });
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function answer(text) {
    const q = text.toLowerCase();
    const contextTopics = (CONTEXT_SUGGESTIONS[ctx.botPage] || []).join(" ").toLowerCase();

    // Prefer topics relevant to the current page context
    let hit = null, bestScore = 0;
    KB.forEach((t) => {
      let score = t.keys.filter((k) => q.includes(k)).length;
      if (contextTopics && t.keys.some((k) => contextTopics.includes(k) && q.includes(k))) score += 0.5;
      if (score > bestScore) { bestScore = score; hit = t; }
    });

    if (hit) {
      addMsg(hit.answer, "bot");
      addVerify(hit.verify);
    } else if (/^(hi|hello|hey|thanks|thank you)/.test(q)) {
      addMsg("Hey — I'm here for anything in this course's territory: REST, status codes, auth, errors, pagination, debugging. What's on your mind?", "bot");
    } else {
      // No-misunderstanding loop: clarify before answering
      const d = document.createElement("div");
      d.className = "msg verify";
      d.innerHTML = `<strong>I want to answer the right question.</strong> I couldn't map that to a topic with confidence — did you mean one of these?<div class="verify-opts"></div>`;
      const opts = d.querySelector(".verify-opts");
      const sugg = CONTEXT_SUGGESTIONS[ctx.botPage] || ["What is REST?", "401 vs 403?", "How should errors be designed?"];
      sugg.slice(0, 3).forEach((s) => {
        const b = document.createElement("button");
        b.className = "verify-opt";
        b.textContent = s;
        b.onclick = () => { addMsg(s, "user"); answer(s); };
        opts.appendChild(b);
      });
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
    }
  }

  function send() {
    const t = input.value.trim();
    if (!t) return;
    addMsg(t, "user");
    input.value = "";
    setTimeout(() => answer(t), 350);
  }

  function renderSuggestions() {
    const box = panel.querySelector("#bot-suggest");
    box.innerHTML = "";
    (CONTEXT_SUGGESTIONS[ctx.botPage] || ["What is REST?"]).slice(0, 2).forEach((s) => {
      const b = document.createElement("button");
      b.textContent = s;
      b.onclick = () => { addMsg(s, "user"); answer(s); };
      box.appendChild(b);
    });
  }

  function greet() {
    msgs.innerHTML = "";
    addMsg(
      "I answer questions about what you're learning right now — and after each answer I'll ask you one quick question back, to make sure nothing settled in wrong. What are you stuck on?",
      "bot"
    );
    renderSuggestions();
  }

  panel.querySelector("#bot-ctx").textContent = "Context: " + contextLabel();

  fab.addEventListener("click", () => {
    panel.classList.add("open");
    fab.style.display = "none";
    if (!msgs.children.length) greet();
    input.focus();
  });
  panel.querySelector("#bot-close").addEventListener("click", () => {
    panel.classList.remove("open");
    fab.style.display = "flex";
  });
  panel.querySelector("#bot-send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
})();
