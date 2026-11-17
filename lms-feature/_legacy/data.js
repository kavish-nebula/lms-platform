/* ============================================================
   Mock course content for the prototype.
   Integration points (later): real video, LLM-generated scenarios
   & bot answers, real adaptive engine.
   ============================================================ */

const PLATFORM = { name: "Proofcraft", tagline: "Learning you can prove" };

/* Course catalog — drives the courses page. Only courses with open:true are clickable. */
const CATALOG = [
  {
    id: "rest-api",
    open: true,
    title: "REST API Engineering",
    problem: "Apps that lose data when two people save at once, leak sessions, and fail silently. Fix that class of bug — by designing the API yourself.",
    capabilities: ["Design endpoints that survive scale", "Design authentication & authorization", "Build an error contract people can act on", "Build from requirements, unaided"],
    hours: "~6 hrs",
    known_topics: [
      ["http_basics", "HTTP — requests & responses"],
      ["urls_resources", "URLs and resources"],
      ["json", "JSON payloads"],
      ["status_codes", "Status codes (200, 404, 500…)"],
      ["auth", "Authentication & tokens"],
      ["errors", "Error handling"],
      ["pagination", "Pagination & scaling"],
      ["none", "I am not familiar with any of these"],
      ["other", "Other"],
    ],
  },
  {
    id: "sql-modeling",
    open: false,
    title: "SQL Data Modeling",
    problem: "Schemas that were \"obvious\" on day one and unbearable by month three. Design data that outlives its first feature.",
    capabilities: ["Model relationships before screens", "Normalize — and know when not to", "Design for the query you'll run at 2am"],
    hours: "~5 hrs",
    known_topics: [["none", "I am not familiar with any of these"], ["other", "Other"]],
  },
  {
    id: "web-perf",
    open: false,
    title: "Web Performance, Honestly",
    problem: "A page that scores 100 and still feels slow. Measure what users feel, then fix the thing that actually matters.",
    capabilities: ["Diagnose before optimizing", "Budgets instead of vibes", "Prove the improvement with numbers"],
    hours: "~4 hrs",
    known_topics: [["none", "I am not familiar with any of these"], ["other", "Other"]],
  },
];


/* Universal "familiar areas" list for the profiling questionnaire (Iteration 3:
   same common content for all learners — course-driven generation comes later). */
const UNIVERSAL_TOPICS = [
  ["http_basics", "HTTP — requests & responses"],
  ["urls_resources", "URLs and resources"],
  ["json", "JSON payloads"],
  ["status_codes", "Status codes (200, 404, 500…)"],
  ["auth", "Authentication & tokens"],
  ["errors", "Error handling"],
  ["pagination", "Pagination & scaling"],
  ["none", "I am not familiar with any of these"],
  ["other", "Other"],
];

const COURSE = {
  id: "rest-api",
  title: "REST API Engineering",
  problem:
    "Your team's app loses data when two users save at once, sessions leak, and error messages say nothing. You will fix it — by designing the API yourself.",
  goal: "Build a REST API from requirements — without following a tutorial.",
  loop: ["Real problem", "Concept", "Worked example", "Guided practice", "Scenario", "Mini project", "Mastery gate", "Reflection", "Spaced review"],
  modules: [
    /* ---------------- MODULE 1 ---------------- */
    {
      n: 1,
      title: "Foundations: how the web talks",
      problem: "Two users save at the same time and one edit silently disappears. Where did the data go?",
      revisit: null,
      videos: [
        {
          title: "What REST actually is",
          mins: 4,
          intervention: {
            q: "In REST, the URL names the ______ and the HTTP verb says the ______.",
            options: ["action / resource", "resource / action", "server / database", "user / password"],
            correct: 1,
            explain: "The URL is a noun (/books/42) and the verb (GET, POST, PUT, DELETE) is the action on it. That split is the whole mental model.",
          },
        },
        {
          title: "Verbs & status codes",
          mins: 4,
          intervention: {
            q: "A client asks for /books/999 but no book 999 exists. What should the server return?",
            options: ["200 with an empty body", "404 Not Found", "500 and crash", "301 redirect to /books"],
            correct: 1,
            explain: "404 means 'this resource does not exist'. 200 would force every client to guess whether the body is real.",
          },
        },
        {
          title: "Resources & URLs",
          mins: 4,
          intervention: {
            q: "Which URL follows REST conventions?",
            options: ["/getBook?id=42", "/books/42", "/api/retrieveBook42", "/books?action=get&book=42"],
            correct: 1,
            explain: "Nouns, plural collections, identifiers in the path: /books/42. Verbs in URLs duplicate what the HTTP method already says.",
          },
        },
        {
          title: "JSON payloads & content types",
          mins: 4,
          intervention: {
            q: "What does the header Content-Type: application/json tell the server?",
            options: ["The user prefers JSON", "How to parse the request body", "The response must be encrypted", "Which database to use"],
            correct: 1,
            explain: "Content-Type describes the format of the body you are sending, so the server knows how to parse it.",
          },
        },
      ],
      workedExample: {
        title: "Designing the books endpoint, step by step",
        steps: [
          { s: "Identify the resource", d: "We need to manage books, so the resource is 'book' — a thing, not an action. Collections are plural: /books.", note: "Rule: if your URL contains a verb, you are probably designing an RPC, not REST.",
            shot: { kind: "browser", url: "api.library.local/books/42", label: "The resource, addressed by the URL" } },
          { s: "Choose the verbs per action", d: "List → GET /books · Create → POST /books · Replace → PUT /books/42 · Delete → DELETE /books/42.", note: "The verb lives in the HTTP method, never in the path.",
            shot: { kind: "network", rows: [["GET", "/books", "200", "42ms"], ["POST", "/books", "201", "18ms"], ["PUT", "/books/42", "200", "23ms"], ["DELETE", "/books/42", "204", "11ms"]] } },
          { s: "Decide the status codes up front", d: "GET → 200 · POST → 201 + Location header · PUT on missing → 201, on existing → 200 · DELETE → 204.", note: "Status codes are part of your contract — decide them before writing handlers.",
            shot: { kind: "terminal", lines: ["$ curl -i -X POST localhost:3000/books …", "HTTP/1.1 201 Created", "Location: /books/43", "", "$ curl -i localhost:3000/books/999", "HTTP/1.1 404 Not Found"] } },
          { s: "Define the payload", d: "POST body: { \"title\": \"...\", \"author\": \"...\", \"year\": 1998 }. Response echoes the stored object plus an id.", note: "Send Content-Type: application/json or clients will guess.",
            shot: { kind: "json", title: "POST /books — response body", code: "{\n  \"id\": 43,\n  \"title\": \"Dune\",\n  \"author\": \"F. Herbert\",\n  \"year\": 1965\n}" } },
          { s: "Handle the failure cases", d: "Missing title on POST → 400 with which field failed. Unknown id → 404. Malformed JSON → 400.", note: "Designing failures first is what separates an API from a demo.",
            shot: { kind: "network", rows: [["POST", "/books (no title)", "400", "6ms"], ["GET", "/books/999", "404", "4ms"], ["POST", "/books (bad json)", "400", "3ms"]] } },
        ],
      },
      scenario: {
        title: "The disappearing save",
        situation:
          "Your app has a books list. A user opens the same list in two tabs, edits 'Dune' in both, and saves. One edit silently vanishes. The team wants to 'fix the database'. As the API designer, what do you do first?",
        bloom: "Analyze",
        choices: [
          { t: "Agree: add a database lock so only one write can happen", verdict: "poor", fb: "A lock might hide the symptom, but you haven't diagnosed anything. The API may be sending the wrong status codes or silently overwriting — that's an API contract problem before it's a database problem." },
          { t: "Open the network tab and look at what each tab actually sent: method, URL, body, and the status that came back", verdict: "best", fb: "Exactly the right instinct. Evidence first: if the second save returns 200 while overwriting, your contract allows silent data loss — you may need optimistic locking (e.g. If-Match / 409 Conflict). Diagnose the conversation before blaming the storage." },
          { t: "Add a loading spinner so users stop saving twice", verdict: "poor", fb: "Cosmetic. The data still vanishes; now it vanishes with a spinner. UI cannot fix a contract that permits silent overwrites." },
          { t: "Replicate it: two tabs, save in both, and watch the requests", verdict: "ok", fb: "Good — reproducing is half of debugging. Push one step further: inspect the actual requests and responses. The verdict lives in the status codes, not just in seeing it happen." },
        ],
      },
      project: {
        title: "URL map for a small library",
        brief:
          "A village library wants an API for books and members. Design the URL map before any code exists.",
        requirements: [
          "List 5 resources (plural nouns)",
          "For each: the 4 CRUD verbs with the URL and expected success status",
          "Show one collection route and one item route",
          "In 2 sentences: which REST rule guided your naming, and why",
        ],
        rubric: ["Resources are nouns, not actions", "Verbs live in HTTP methods, not URLs", "Status codes are intentional (201 vs 200 vs 204)", "Justification names an actual rule"],
      },
      review: {
        q: "Spaced review — Module 1: a client POSTs a valid book and the server stores it. Status code?",
        options: ["200 OK", "201 Created", "204 No Content", "302 Found"],
        correct: 1,
      },
      gate: [
        { q: "Which URL is the most RESTful way to address one book?", options: ["/book?id=42", "/books/42", "/getBook/42", "/api/books/get/42"], correct: 1, why: "Plural collection + identifier: /books/42." },
        { q: "POST /books with a missing title should return…", options: ["201, it will fix itself", "400 with which field failed", "500 internal error", "302 to the form"], correct: 1, why: "400 = the request is the client's fault, and good APIs say which field and why." },
        { q: "What does GET promise about the resource?", options: ["It may change it", "It is safe — read only", "It deletes cached copies", "It requires a body"], correct: 1, why: "GET must be safe: reading should never cause changes." },
        { q: "A successful DELETE usually returns…", options: ["200 with the deleted body", "204 No Content", "404", "202"], correct: 1, why: "204: it worked, there is nothing to send back." },
        { q: "The server created a new resource. Which response helps the client most?", options: ["200 and nothing else", "201 with a Location header pointing to /books/43", "204 silent success", "200 with a copy of the whole list"], correct: 1, why: "201 says 'created', Location says 'here it is' — the client never has to guess the new URL." },
      ],
    },

    /* ---------------- MODULE 2 ---------------- */
    {
      n: 2,
      title: "Designing endpoints & data that scale",
      problem: "Your API works beautifully for 10 books. It falls over at 10,000. What did the design miss?",
      revisit: null,
      videos: [
        {
          title: "Pagination: serving 10,000 rows",
          mins: 4,
          intervention: {
            q: "Offsets (skip 5000, take 20) get slow deep into a list. What scales better?",
            options: ["Bigger offsets", "Cursor-based pagination ('after this id')", "Sending everything once", " client-side sorting"],
            correct: 1,
            explain: "Cursors remember a position ('after book 5042') so the DB seeks instead of counting and discarding rows.",
          },
        },
        {
          title: "Filtering & sorting without chaos",
          mins: 4,
          intervention: {
            q: "The client wants books by 'Le Guin' sorted by year. Where does that belong?",
            options: ["In the URL path", "Query parameters: ?author=le-guin&sort=year", "In the POST body of a GET", "A new endpoint per author"],
            correct: 1,
            explain: "Path = which resource; query = which slice of it. One endpoint, many views.",
          },
        },
        {
          title: "Versioning: change without breaking",
          mins: 4,
          intervention: {
            q: "You must rename a field every client depends on. The safest move is…",
            options: ["Rename and hope", "Ship /v2 alongside /v1, deprecate later", "Return both names forever", "Rename at midnight"],
            correct: 1,
            explain: "Versions let the new contract live while the old one keeps its promises. Deprecation is communication, not a date on a calendar.",
          },
        },
        {
          title: "Consistent response envelopes",
          mins: 4,
          intervention: {
            q: "Why wrap every response in the same envelope (data / error / meta)?",
            options: ["It looks professional", "Clients parse one predictable shape", "It compresses better", "JSON requires it"],
            correct: 1,
            explain: "A predictable envelope means the client writes one parser, not one per endpoint. Consistency is a feature.",
          },
        },
      ],
      workedExample: {
        title: "A paginated GET /books, designed on paper",
        steps: [
          { s: "Accept the slice", d: "GET /books?limit=20&after=bk_5042 — a page size and a cursor.", note: "Defaults matter: no params should still return a sane first page.",
            shot: { kind: "browser", url: "api.library.local/books?limit=20&after=bk_5042", label: "Pagination lives in the query string" } },
          { s: "Define the envelope", d: "{ \"data\": [...], \"meta\": { \"nextCursor\": \"bk_5062\", \"hasMore\": true } }", note: "hasMore saves the client a pointless extra request.",
            shot: { kind: "json", title: "GET /books — response envelope", code: "{\n  \"data\": [ …20 books… ],\n  \"meta\": {\n    \"nextCursor\": \"bk_5062\",\n    \"hasMore\": true\n  }\n}" } },
          { s: "Cap the limit", d: "limit=10000 → clamp to 100 and return meta.limitApplied so the client knows.", note: "Silently accepting abuse guarantees the 10,000-row outage returns." },
          { s: "Add filtering", d: "?author=le-guin&sort=year&order=asc — whitelisted fields only.", note: "Whitelist beats sanitizing: unknown fields get a 400, not a surprise query." },
          { s: "Decide the empty case", d: "No matches → 200 with data: [] — not a 404. The collection exists; it's just empty.", note: "404 is for missing resources, not missing results.",
            shot: { kind: "json", title: "GET /books?author=nobody — empty case", code: "{\n  \"data\": [],\n  \"meta\": { \"hasMore\": false }\n}" } },
        ],
      },
      scenario: {
        title: "The 10,000-row page",
        situation:
          "A partner integration calls GET /books with no parameters. Your server happily builds a 10,000-item JSON array, the request takes 22 seconds, and their timeout kills it. They ask you to 'make the server faster'. What do you change?",
        bloom: "Evaluate",
        choices: [
          { t: "Add a bigger database server", verdict: "poor", fb: "More hardware delays the wall, doesn't remove it. The design sends unbounded responses — no machine fixes an unbounded contract." },
          { t: "Make pagination mandatory: default limit, maximum limit, and cursor-based next pages", verdict: "best", fb: "Right. The contract changes from 'everything' to 'predictable slices'. The response time becomes constant no matter how big the table grows — that is a design fix, not a hardware fix." },
          { t: "Compress the JSON harder", verdict: "poor", fb: "Gzip shrinks bytes, not rows. You still build and serialize 10,000 objects; it's now a slightly smaller 20-second response." },
          { t: "Return the first 100 and document it", verdict: "ok", fb: "A default limit is half the fix — but silently truncating breaks clients that expect everything. Add hasMore + a cursor so truncation is visible and continuable." },
        ],
      },
      project: {
        title: "Design the orders endpoint",
        brief: "A shop has 50,000 orders and a support team that searches by status and date. Design GET /orders.",
        requirements: ["Pagination strategy + why", "2 filters + 1 sort, whitelisted", "Envelope with meta", "What happens at limit=99999"],
        rubric: ["Cursor or bounded offset — justified", "Whitelisted filters with 400 on junk", "Meta exposes next cursor / hasMore", "Clamping is visible, not silent"],
      },
      review: {
        q: "Spaced review — Module 2: a collection exists but has no matching items. Return…",
        options: ["404 Not Found", "200 with data: []", "204 No Content", "400"],
        correct: 1,
      },
      gate: [
        { q: "Deep pagination (page 5000) gets slow with offsets. The scalable fix:", options: ["Bigger offsets faster", "Cursor-based pagination", "Disable pagination", "Client-side paging"], correct: 1, why: "Cursors seek instead of counting and discarding rows." },
        { q: "?author=le-guin&sort=year — where does this logic belong?", options: ["Path segments", "Query parameters on GET /books", "Separate endpoints", "POST body"], correct: 1, why: "Path picks the resource; query slices it." },
        { q: "You rename a field that all clients use. Safest:", options: ["Rename now", "Ship /v2, deprecate /v1 with notice", "Serve both names forever", "Rename for new users only"], correct: 1, why: "Versions keep old promises while new ones ship." },
        { q: "Purpose of a response envelope:", options: ["Decoration", "One predictable shape for every response", "Required by JSON", "Faster parsing only"], correct: 1, why: "Clients write one parser, not one per endpoint." },
        { q: "GET /books?limit=10000 should…", options: ["Return all rows", "Clamp to a max and say so in meta", "Return 500", "Ignore the parameter"], correct: 1, why: "Bounded responses keep latency constant; meta keeps it honest." },
      ],
    },

    /* ---------------- MODULE 3 ---------------- */
    {
      n: 3,
      title: "Authentication & protecting endpoints",
      problem: "Anyone on the office WiFi can call DELETE /books/42. Nothing in the design stops them.",
      revisit: { of: 1, note: "Continuity — Module 1's status codes return: 401 vs 403 now has a job to do." },
      videos: [
        {
          title: "Who are you? Auth fundamentals",
          mins: 4,
          intervention: {
            q: "Authentication and authorization are different. Which is which?",
            options: ["AuthN = what you may do, AuthZ = who you are", "AuthN = who you are, AuthZ = what you may do", "They are the same", "AuthZ happens in the browser"],
            correct: 1,
            explain: "First you prove identity (login), then every request checks permission (roles, ownership).",
          },
        },
        {
          title: "Sessions vs tokens",
          mins: 4,
          intervention: {
            q: "A JWT contains…",
            options: ["The user's password, encrypted", "Signed claims (who, role, expiry)", "The whole database row", "The server's private key"],
            correct: 1,
            explain: "Tokens carry claims and a signature — the server verifies, it doesn't store. That's why they scale across machines.",
          },
        },
        {
          title: "Storing passwords safely",
          mins: 4,
          intervention: {
            q: "Why hash passwords instead of encrypting them?",
            options: ["Hashing is faster", "Hashes can't be reversed — only verified", "Encryption needs a license", "Hashes are shorter"],
            correct: 1,
            explain: "You never need to see a password again — only to check it. One-way hashes (with salt) mean a leak isn't a password list.",
          },
        },
        {
          title: "Middleware: the gatekeeper pattern",
          mins: 4,
          intervention: {
            q: "Where should the token check happen for POST /books?",
            options: ["In the UI, hiding the button", "In middleware, before the handler runs", "After the DB write", "In the client's localStorage"],
            correct: 1,
            explain: "The server route is the only wall that matters. Middleware rejects before any handler logic runs.",
          },
        },
      ],
      workedExample: {
        title: "Protecting POST /books, designed on paper",
        steps: [
          { s: "The request arrives", d: "POST /books with header Authorization: Bearer eyJhbGci…", note: "Token in the header — never in the URL, URLs get logged everywhere.",
            shot: { kind: "terminal", lines: ["$ curl -X POST localhost:3000/books \\", "    -H \"Authorization: Bearer eyJhbGciOi…\" \\", "    -d '{ \"title\": \"Dune\" }'"] } },
          { s: "Middleware verifies", d: "Check signature, expiry, issuer. Invalid → 401 with WWW-Authenticate header.", note: "401 = 'I don't know who you are'. This is where Module 1's status codes earn their keep.",
            shot: { kind: "network", rows: [["POST", "/books (no token)", "401", "2ms"], ["POST", "/books (expired token)", "401", "3ms"], ["POST", "/books (valid token)", "201", "19ms"]] } },
          { s: "Authorization check", d: "Verified user, but is 'librarian' allowed to create books? Role check inside middleware or handler → 403 if not.", note: "403 = 'I know exactly who you are, and the answer is no'." },
          { s: "Handler runs safely", d: "Only now does the book get created. req.user comes from the verified token, never from the request body.", note: "Never trust an incoming userId field — that's how privilege escalation happens.",
            shot: { kind: "json", title: "req.user — built from the token, not the body", code: "{\n  \"id\": \"usr_7\",\n  \"role\": \"librarian\",\n  \"exp\": 1735689600\n}" } },
          { s: "Fail closed", d: "Missing header, garbage token, expired — all end in 401. Doubt means reject.", note: "Auth fails closed, features fail open. Know which kind of code you're writing." },
        ],
      },
      scenario: {
        title: "The admin route anyone can call",
        situation:
          "A security review finds that DELETE /users/7 works from a plain browser with no login — the admin UI simply hides the button for non-admins. Nothing else protects the route. What's the correct fix?",
        bloom: "Analyze",
        choices: [
          { t: "Restore the hiding logic in the admin UI", verdict: "poor", fb: "Hiding a button is not security — anyone with curl can still call the route. The client is a suggestion; the server is the wall." },
          { t: "Add server-side middleware on the route: verify token (401 if absent/invalid), then verify role 'admin' (403 if insufficient)", verdict: "best", fb: "Correct, and in the right order: authenticate first (401 — who are you?), then authorize (403 — you may not). The UI hiding can stay as courtesy, but the wall is now on the server." },
          { t: "Rename the route to something unguessable like /d3lete-user", verdict: "poor", fb: "Security by obscurity. Route names leak from JS bundles, logs, and links. Unguessable is not protected." },
          { t: "Require a special header X-Admin-Request: true from the UI", verdict: "poor", fb: "Anyone can set a header. It's not a secret unless the server verifies something cryptographic — like a signed token." },
        ],
      },
      project: {
        title: "Secure the library API",
        brief: "Design (on paper) the auth for the library system: who can log in, what tokens carry, and which routes are protected.",
        requirements: ["Login route + what it returns", "Token claims (3 minimum) + expiry choice", "Which routes are public vs protected, and the 401/403 map", "How passwords are stored, and why"],
        rubric: ["401 for unauthenticated, 403 for unauthorized — correctly split", "Token carries claims, not secrets", "Password storage = salted hash", "No trust in client-side checks"],
      },
      review: {
        q: "Spaced review — Module 3: a logged-in normal user calls an admin route. Status?",
        options: ["401 Unauthorized", "403 Forbidden", "400", "200 but empty"],
        correct: 1,
      },
      gate: [
        { q: "No token provided at all. The server returns…", options: ["403", "401", "400", "404"], correct: 1, why: "401: identity unknown. 403 is only after identity is proven." },
        { q: "Why hash instead of encrypt passwords?", options: ["Faster", "Hashes are one-way — a leak isn't a password list", "Shorter storage", "Encryption is deprecated"], correct: 1, why: "You only ever need to verify, never to read back." },
        { q: "Where does token verification belong?", options: ["Client JS", "Server middleware before the handler", "After the DB write", "The database"], correct: 1, why: "The server route is the only wall. Middleware rejects before handler logic." },
        { q: "A JWT contains…", options: ["The password, encrypted", "Signed claims: who, role, expiry", "Session state", "The DB row"], correct: 1, why: "Claims + signature. The server verifies instead of storing." },
        { q: "The request body includes userId: 7 (admin). Your handler should…", options: ["Trust it", "Ignore it and use the id from the verified token", "Log it", "Ask the client to confirm"], correct: 1, why: "Identity comes from the verified token, never from client-sent fields — that's privilege escalation." },
      ],
    },

    /* ---------------- MODULE 4 ---------------- */
    {
      n: 4,
      title: "Errors, debugging & the unreliable network",
      problem: "Checkout fails for one in ten users and nobody knows — the API returns 200 with an error buried in the body.",
      revisit: { of: 1, note: "Continuity — Modules 1 & 3 return: status codes and auth failures now appear inside error design." },
      videos: [
        {
          title: "Errors are an API feature",
          mins: 4,
          intervention: {
            q: "The best error response contains…",
            options: ["A stack trace", "What happened, which field, what to do next", "The word 'error'", "An empty 500"],
            correct: 1,
            explain: "Errors are part of your contract: machine-readable code + human-readable message + pointer to the problem.",
          },
        },
        {
          title: "Validation: fail early, fail clearly",
          mins: 4,
          intervention: {
            q: "A POST has 3 invalid fields. Best response?",
            options: ["First error only", "400/422 listing all invalid fields", "500", "Accept and fix silently"],
            correct: 1,
            explain: "Return everything that's wrong in one pass — otherwise users fix one field per request and hate you.",
          },
        },
        {
          title: "Logs that actually help",
          mins: 4,
          intervention: {
            q: "What belongs in a request log line?",
            options: ["Everything, including passwords", "Request id, route, status, duration, user id — never secrets", "Only errors", "The full body"],
            correct: 1,
            explain: "Context tells the story; secrets in logs are a breach waiting to happen. Correlation ids tie a client complaint to a server line.",
          },
        },
        {
          title: "Retries, timeouts & idempotency",
          mins: 4,
          intervention: {
            q: "Why must a retried POST /payments not create two charges?",
            options: ["It should — retries are rare", "Retries need idempotency keys so duplicates collapse", "Use GET for payments", "Charge twice, refund once"],
            correct: 1,
            explain: "Networks time out after the server did the work. Idempotency keys let the client retry safely.",
          },
        },
      ],
      workedExample: {
        title: "Designing a validation error response",
        steps: [
          { s: "Pick the status", d: "Syntactically fine JSON, semantically wrong fields → 422 (or 400 with a validation code). Decide and document one.", note: "The number matters less than the consistency." },
          { s: "Shape the body", d: "{ \"error\": { \"code\": \"VALIDATION_FAILED\", \"message\": \"2 fields invalid\", \"fields\": [{\"path\": \"title\", \"issue\": \"required\"}, {\"path\": \"year\", \"issue\": \"must be a number\"}] } }", note: "Machine path + human issue. Both audiences in one body.",
            shot: { kind: "json", title: "POST /books — 422 Unprocessable Content", code: "{\n  \"error\": {\n    \"code\": \"VALIDATION_FAILED\",\n    \"message\": \"2 fields invalid\",\n    \"fields\": [\n      { \"path\": \"title\", \"issue\": \"required\" },\n      { \"path\": \"year\",  \"issue\": \"must be a number\" }\n    ]\n  }\n}" } },
          { s: "Never leak internals", d: "No stack traces, no SQL, no file paths. Those go to logs, not responses.", note: "Error bodies are public; logs are private. Confusing them is a breach." },
          { s: "Log with context", d: "Log request id, user id, route, duration, then the validation details. One correlation id across services.", note: "The log line should answer: who did what, how long, and why it failed.",
            shot: { kind: "terminal", lines: ["[12:41:03] req=ab34f POST /books 422 6ms user=usr_7", "[12:41:03]   VALIDATION_FAILED title=required year=type", "[12:41:09] req=ab34g GET  /books/42 200 11ms user=usr_7"] } },
          { s: "Make the retry safe", d: "Client retries the fixed request — same idempotency key if it's a payment-like operation.", note: "Design the retry path before the first outage designs it for you." },
        ],
      },
      scenario: {
        title: "The checkout that fails silently",
        situation:
          "Roughly 10% of checkouts fail, but users see a success screen and no order exists. Support has nothing to go on. Where do you start?",
        bloom: "Evaluate",
        choices: [
          { t: "Restart the payment service during low traffic", verdict: "poor", fb: "Shotgun debugging. Even if it helps today, you still can't see failures — the silent 10% returns." },
          { t: "Trace one failing order end-to-end: find the request id in logs, check what status the payment call returned and what your API sent the browser", verdict: "best", fb: "Exactly. Correlation ids exist for this moment. You'll likely find the payment gateway returning an error your API swallowed and still returned 200 — 'fail silently' is a contract bug, and now you have the evidence to fix it." },
          { t: "Add try/catch around checkout and return 200 with {success: false} so the server doesn't crash", verdict: "poor", fb: "This is how the bug got here. A 200 that means failure breaks every client's trust: status codes are the contract. Errors deserve 4xx/5xx." },
          { t: "Email users whose checkout failed and ask them to retry", verdict: "poor", fb: "Treats the symptom, keeps the blindness. And how do you know who failed if your API doesn't record it? Fix observability first." },
        ],
      },
      project: {
        title: "The error contract",
        brief: "Write the error contract for the library API: six error responses a client should expect, each fully specified.",
        requirements: ["6 errors: at least 400, 401, 403, 404, 409, 422/500", "Body shape: code + message + fields/details", "For each: when it happens and what the client should do", "One rule for what never appears in an error body"],
        rubric: ["Status codes match Module 1 & 3 rules", "Codes are machine-readable and stable", "Client action is stated per error", "No internals (stacks/SQL) in any body"],
      },
      review: {
        q: "Spaced review — Module 4: checkout fails but must not double-charge on retry. The mechanism:",
        options: ["Bigger timeout", "Idempotency key", "GET request", "Rate limiting"],
        correct: 1,
      },
      gate: [
        { q: "Valid JSON, invalid fields. Best response:", options: ["500", "422 listing every invalid field", "200 with error word", "404"], correct: 1, why: "Fail early, fail completely — one round trip, all issues listed." },
        { q: "What never belongs in an error response body?", options: ["A stable error code", "A stack trace or SQL", "A human message", "The failing field name"], correct: 1, why: "Responses are public; internals are for logs." },
        { q: "The network drops after the server charged the card. The client retries. What saves you?", options: ["A faster server", "Idempotency key", "Try/catch", "Client-side flag"], correct: 1, why: "Idempotency keys collapse duplicate operations into one." },
        { q: "Good request logs contain…", options: ["Full bodies incl. passwords", "Request id, route, status, duration, user id — no secrets", "Only the errors", "Nothing: logs slow servers"], correct: 1, why: "Context without secrets; correlation ties complaint to cause." },
        { q: "An API returns 200 for failed checkouts. The core problem:", options: ["Ugly UI", "The status code contract is broken", "Missing gzip", "Slow database"], correct: 1, why: "Status codes are the contract; 200-that-fails poisons every client's logic." },
      ],
    },

    /* ---------------- MODULE 5 ---------------- */
    {
      n: 5,
      title: "Independence: building from requirements",
      problem: "A stakeholder hands you one vague paragraph. There is no tutorial for this one — only your process.",
      revisit: { of: 1, note: "Continuity — the full loop closes: this module's scenario reuses Modules 1–4 as one working system." },
      videos: [
        {
          title: "Reading requirements like an engineer",
          mins: 4,
          intervention: {
            q: "'Users can share their profiles.' Your first move is to…",
            options: ["Start coding the share button", "List what's undefined: share what, with whom, how private?", "Ask for a framework choice", "Copy a similar app"],
            correct: 1,
            explain: "Requirements are questions wearing a statement. Ambiguity you resolve in design is cheap; in production it's an outage.",
          },
        },
        {
          title: "Designing before coding",
          mins: 4,
          intervention: {
            q: "Contract-first means…",
            options: ["Code fast, document later", "Agree the endpoints & payloads before implementing", "Only build what's documented by others", "Skip design for small features"],
            correct: 1,
            explain: "The contract is the agreement frontend, backend, and partners code against. It's cheaper to move a box on paper.",
          },
        },
        {
          title: "Testing your own API",
          mins: 4,
          intervention: {
            q: "The most valuable automated test for an API checks…",
            options: ["That happy path returns 200", "The contract: status codes + shapes, including failure cases", "How fast the UI loads", "That the DB is up"],
            correct: 1,
            explain: "Clients depend on the contract, not the implementation. Test the promises: 201 + Location, 422 shapes, 401 before 403.",
          },
        },
        {
          title: "When to break the rules",
          mins: 4,
          intervention: {
            q: "A pragmatic engineer breaks a REST rule when…",
            options: ["Never, rules are rules", "The cost of the rule exceeds the value in this context — and the team documents why", "Whenever deadlines loom", "Only senior devs may"],
            correct: 1,
            explain: "Principles are defaults, not laws. A conscious, written exception is engineering; a silent one is debt.",
          },
        },
      ],
      workedExample: {
        title: "One vague paragraph → an endpoint list",
        steps: [
          { s: "Underline the nouns and verbs", d: "'Members can share their favorite books with friends.' Nouns: member, book, friend. Verbs: share, list favorites.", note: "Nouns become resources; verbs become methods." },
          { s: "List the questions", d: "Share = read access or a copy? Can friends comment? Revocable? Public link or login needed?", note: "Every unanswered question is a future rework — surface them now." },
          { s: "Draft the contract", d: "POST /me/favorites/shares {friendIds, expiresAt?} → 201 · GET /shares/{token} → 200", note: "Token-based share = revocable without touching the underlying data.",
            shot: { kind: "json", title: "The contract, written before any code", code: "POST /me/favorites/shares\n  → 201 { \"token\": \"sh_9f2\", \"expiresAt\": null }\n\nGET  /shares/sh_9f2\n  → 200 { \"owner\": \"Maya\", \"favorites\": [ … ] }" } },
          { s: "Design the failures", d: "Expired token → 410 Gone. Not a friend → 403. Unknown token → 404.", note: "Module 4's error contract applies to features you design, not just ones you inherit.",
            shot: { kind: "network", rows: [["GET", "/shares/sh_9f2", "200", "8ms"], ["GET", "/shares/sh_old", "410", "3ms"], ["GET", "/shares/zz_???", "404", "2ms"]] } },
          { s: "Write the tests first", d: "201 happy path, 410 expiry, 403 non-friend, 404 unknown. The contract is now executable.", note: "Tests are the requirement document that can't rot." },
        ],
      },
      scenario: {
        title: "The vague requirement",
        situation:
          "A stakeholder says: 'Make profiles shareable — like, people should be able to show their stuff around. By Friday.' You have modules 1–4 behind you. What do you do first?",
        bloom: "Create",
        choices: [
          { t: "Build a public /profiles/:id/share page — fastest thing that could work", verdict: "poor", fb: "'Fast' built on guessed requirements is slow: privacy, revocation and access questions will force a rebuild. You'd be shipping your unknowns to production." },
          { t: "Write down the ambiguities (public vs per-friend? revocable? expiry?), propose a small contract with 2 options, and get one decision before building", verdict: "best", fb: "This is the whole course in one move: design before code, contract as agreement, failures considered. One 20-minute decision conversation saves a week of rework — and the Friday deadline survives because the build is small and certain." },
          { t: "Reply that it's impossible by Friday", verdict: "poor", fb: "It's probably possible — 'shareable' is just undefined. Turning vagueness into options is your job; refusing it cedes the design to someone else." },
          { t: "Copy how a popular app does sharing", verdict: "poor", fb: "Their context (scale, legal, privacy) isn't yours. Copying looks like decisions but it's deferred decisions with someone else's debt attached." },
        ],
      },
      project: {
        title: "Capstone brief",
        brief: "This module has no guided project — its mini project IS the final assessment's independent task: build a working API for a fictional e-commerce application, from requirements alone.",
        requirements: ["Read the requirements in the final assessment", "Design the endpoint list first", "Implement with your Module 1–4 standards", "Bring your own error contract and auth map"],
        rubric: ["Contract-first", "Auth designed, not bolted on", "Errors follow your Module 4 contract", "You can defend every status code"],
      },
      review: {
        q: "Spaced review — Module 5: the most valuable API tests verify…",
        options: ["UI speed", "The contract: statuses & shapes, incl. failures", "Database uptime", "Code style"],
        correct: 1,
      },
      gate: [
        { q: "'Users can share profiles.' First move:", options: ["Code the button", "Surface the ambiguities and propose a contract", "Copy a big app", "Ask which framework"], correct: 1, why: "Ambiguity resolved in design is cheap; in production it's a rebuild." },
        { q: "Contract-first means:", options: ["Document after coding", "Agree endpoints & payloads before implementing", "Only build what's specified", "Skip design when small"], correct: 1, why: "The contract is what everyone else codes against." },
        { q: "Most valuable automated API tests check:", options: ["Happy path 200", "The contract incl. failure cases", "UI load speed", "DB connectivity"], correct: 1, why: "Clients depend on promises, not implementation details." },
        { q: "Breaking a REST rule is engineering when:", options: ["Never", "The exception is conscious, justified in context, and written down", "Deadlines demand it", "It's faster"], correct: 1, why: "A written exception is a decision; a silent one is debt." },
        { q: "Requirement: 'friends can see favorites'. A token-based share link is chosen because:", options: ["Tokens look cool", "It's revocable and expirable without touching the data", "URLs are cacheable", "JWTs are standard"], correct: 1, why: "Revocation + expiry directly answer the privacy questions in the requirement." },
      ],
    },
  ],

  finalAssessment: {
    title: "Independent build: the e-commerce API",
    intro:
      "No hints. No guided steps. Eight real-world scenarios — draw on everything from Modules 1–5. Answer as the engineer who will own this system.",
    passMark: 6,
    questions: [
      {
        q: "A teammate's frontend calls GET /products/17 and shows \"Item not available\" — but the product exists in the database. The API log shows the request returned 200 with an empty body. What is the correct diagnosis?",
        options: [
          "The database row is soft-deleted, so the empty 200 is correct behavior",
          "The route matched but the handler returned 200 without checking existence — a missing resource must return 404, not 200",
          "The frontend should parse the empty body and automatically retry the request",
          "The API should return 500 so the failure becomes visible in monitoring",
        ],
        correct: 1,
        why: "Module 1: a 200 that carries no data breaks the contract — clients can't tell 'exists but empty' from 'missing'. A missing resource answers 404.",
      },
      {
        q: "Your /articles endpoint takes 9 seconds when a client asks for page 400 using offset pagination. The database team confirms the query uses indexes. Which change fixes the root cause?",
        options: [
          "A bigger database cache so offset queries scan faster",
          "Cursor-based pagination ('after this id') so the database seeks to a position instead of counting and discarding thousands of rows",
          "A longer client timeout so slow pages still load eventually",
          "Return every article once and let the client do the paging",
        ],
        correct: 1,
        why: "Module 2: offsets count and throw away every skipped row — cost grows with depth. Cursors seek straight to a position, keeping latency constant.",
      },
      {
        q: "You must rename the field user_name to username. Three partner apps parse user_name from your v1 responses today. What is the safest rollout?",
        options: [
          "Rename the field now and email the partners a heads-up",
          "Ship /v2 with the new name while /v1 keeps serving user_name until the deprecation date you announced",
          "Return both fields forever with no plan to remove the old one",
          "Rename the field only for newly issued API keys",
        ],
        correct: 1,
        why: "Module 2: breaking changes ship as a new major version. Old promises keep running on /v1 while partners migrate — then you deprecate with notice, not surprise.",
      },
      {
        q: "A security audit shows DELETE /orders/12 succeeds when called with a VALID token that belongs to a normal customer. What is the correct fix?",
        options: [
          "Hide the delete button in the UI for non-admin users",
          "Keep token verification, then add a role/ownership check before the handler runs — return 403 when the user isn't allowed",
          "Require a special X-Admin-Request header that only the admin UI sends",
          "Rename the route to something unguessable like /d3lete-order",
        ],
        correct: 1,
        why: "Module 3: authenticate (401) then authorize (403) — both server-side. Hiding buttons, secret headers, and obscurity are not authorization.",
      },
      {
        q: "Your login endpoint returns the user's profile JSON including a passwordHash field. A reviewer flags it. Why is this wrong even though hashes are one-way?",
        options: [
          "JSON cannot safely encode hash strings",
          "Hashes can be brute-forced offline; an API must never expose credential material — return only safe profile fields",
          "It is acceptable — one-way hashes cannot be reversed",
          "The field should have been encrypted instead of hashed",
        ],
        correct: 1,
        why: "Module 3: a leaked hash is an offline cracking target. Verification never requires reading it back, so credential material never leaves the server.",
      },
      {
        q: "Checkout fails for ~5% of users. Logs show the payment gateway times out AFTER charging the card, and your client auto-retries — some users are double-charged. What is the complete fix?",
        options: [
          "Remove the auto-retry so a charge can only ever happen once",
          "Send an idempotency key with the payment so retries collapse into one charge — and return an honest 4xx/5xx (never 200) when checkout fails",
          "Return 200 for every checkout attempt so clients never retry",
          "Increase the gateway timeout to 60 seconds",
        ],
        correct: 1,
        why: "Module 4: networks fail after the work is done. Idempotency keys make retries safe, and real failures deserve real error statuses — not 200 with a sad body.",
      },
      {
        q: "A client developer reports: \"Your API returned 200 but the response body says success:false.\" What is the contract-level answer?",
        options: [
          "That's acceptable — the response body is the source of truth",
          "The API is at fault: a failed operation must return 4xx/5xx with a stable error code — 200 means the operation succeeded",
          "Ask the client to check the success field before rendering anything",
          "Add more fields to the body so failures are easier to detect",
        ],
        correct: 1,
        why: "Module 4: status codes are the contract. A 200-that-fails poisons every client's logic; failures belong in 4xx/5xx with a stable, machine-readable code.",
      },
      {
        q: "A stakeholder writes: \"Let buyers share their wish-list with friends, but I can stop sharing whenever.\" What do you send back before building anything?",
        options: [
          "Start with a public share URL — it's the fastest thing that could work",
          "List what the sentence leaves open (public vs invited-only, revocation, expiry), propose a small contract — POST /me/wishlists/shares → 201 with a revocable token, GET /shares/{token}, 410 once revoked — and get one confirmation",
          "Reply that revocable sharing isn't feasible by Friday",
          "Copy how a large marketplace implements wish-list sharing",
        ],
        correct: 1,
        why: "Module 5: requirements are questions in disguise. Surface the ambiguities, propose the contract, get one decision — then build once, correctly.",
      },
    ],
    reflectionPrompt:
      "In your own words: what can you now design and build that you couldn't before this course — and where would you still want help?",
  },

  evidence: {
    abilities: [
      { text: "Explain REST architecture — resources, verbs, status codes", needs: [1] },
      { text: "Design API endpoints that scale — pagination, filtering, versioning", needs: [2] },
      { text: "Design authentication & authorization — tokens, 401 vs 403, safe storage", needs: [3] },
      { text: "Design an error contract & debug from evidence", needs: [4] },
      { text: "Turn vague requirements into a working design, independently", needs: [5] },
    ],
    independentTask: {
      title: "Build an API for a fictional e-commerce application",
      note: "Completed without guided instructions.",
    },
  },
};

/* ---------- shared helpers ---------- */
function lmGet() { try { return JSON.parse(localStorage.getItem("pc_learner") || "null"); } catch { return null; } }
function lmSet(m) { localStorage.setItem("pc_learner", JSON.stringify(m)); }
function pgGet() { try { return JSON.parse(localStorage.getItem("pc_progress") || "{}"); } catch { return "{}"; } }
function pgSet(p) { localStorage.setItem("pc_progress", JSON.stringify(p)); }
