# Adaptive teaching pilot

This pilot adds a Python teaching service to the existing Next.js LMS. It covers the `ai-agent` course: profile and enrollment answers personalise Module 1; verified learning evidence shapes subsequent modules, with explicit prerequisite reminders from Module 1 into Module 2. Required objectives, assessment standards and saved stage keys remain authored.

The adaptive editor uses prompt version **4**, the complete eight-section ILD teaching prompt: authority/inputs, instructional design, Module 1 personalisation, later-module evidence, trigger behaviour, multimedia/accessibility, structural constraints, and quality/fallback checks. Course experience is included in `LEARNER_FOCUS`. These instructions support the ILD process; they do not certify factual accuracy, accessibility or SME approval. The existing validators and matching-audio publication checks remain enforced. Profiling and enrollment interview prompts are separate and unchanged by this update.

For a prompt deployment, stop the workers before superseding unfinished jobs from older prompt versions and restarting the app/editor. Completed revisions and learner progress are retained. Version 4 fingerprints prepare new content through normal lesson-opening/help triggers; playback still adopts revisions at safe boundaries. Claim-time and editor-time version checks prevent an older snapshot from being generated under newer instructions.

## Run locally

From the repository root, with Python 3.12+ and Node 22+:

```powershell
python -m venv apps/adaptive-api/.venv
apps/adaptive-api/.venv/Scripts/python.exe -m pip install -r apps/adaptive-api/requirements.lock
npm run dev:adaptive
```

On macOS/Linux, use `.venv/bin/python` for pip. The launcher detects the platform. If Python is elsewhere, set `ADAPTIVE_PYTHON_BIN` to its absolute executable path. The service dependencies are installed in this checkout's `.venv` on the development machine used to implement the pilot.

The launcher reads `apps/web/.env.local`, starts the LMS on **127.0.0.1:3002**, FastAPI on **127.0.0.1:8001**, and a separate worker. It generates an ephemeral internal credential shared by its child processes. `ADAPTIVE_WEB_PORT` and `ADAPTIVE_API_PORT` override these ports. Ctrl+C stops the process group. It does not edit `.env.local`.

For a stable demonstration with real generation, run `npm run build` followed by `npm run start:adaptive`. This serves the production build alongside the same Python API and worker, avoiding development hot reloads while generated files and logs change.

Set `ADAPTIVE_BACKGROUND_ENABLED=false` to reserve limited speech quota/CPU for learner-requested slides. Completed requested revisions are available when the lesson is reopened. Daily cloud speech quotas switch to the configured Kokoro fallback; that fallback may take longer than the interactive wait window.

For the automatic learning loop, leave `ADAPTIVE_BACKGROUND_ENABLED=true` (the default). Both worker lanes must run: the background lane prepares lessons automatically, while the interactive lane handles explicit help requests. The main local app uses this mode with Kokoro narration; cloud text generation remains configured. Opening a slide prioritises it ahead of the older background backlog without requiring a help-button click.

Use the existing `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL` and optional fallback settings; legacy `GLM_*` settings also work. Speech uses the existing `AUDIO_*` and `KOKORO_*` configuration on Next.js. Gemini is the fast speech path; optional Kokoro is slower and may miss the interactive deadline. A rewritten narrated slide becomes available only when matching audio exists. Without working generation or speech, the authored lesson remains available.

For separate processes, set `ADAPTIVE_PYTHON_ENABLED=true`, a shared server-only `ADAPTIVE_INTERNAL_TOKEN` of at least 24 random characters, `ADAPTIVE_LMS_URL` and `ADAPTIVE_API_URL`. Start:

```powershell
# Terminal 1, repository root (default port 3000)
npm run dev
# Terminal 2, apps/adaptive-api
.venv/Scripts/python.exe -m uvicorn adaptive_api.api:app --host 127.0.0.1 --port 8001
# Terminal 3, apps/adaptive-api
.venv/Scripts/python.exe -m adaptive_api.worker
```

Set `ADAPTIVE_LMS_URL=http://127.0.0.1:3000` for the separate-process example. These variables can live in `apps/web/.env.local`; Python loads that file without overwriting inherited environment settings. Ordinary `npm run dev` retains the previous implementation when the flag is unset or false. The current shared demo identity remains; this is a local pilot, not a public multi-user release.

## Learning loop

1. Enrollment stores its baseline plan and queues the opening, narrated slides in playback order, and worked examples. The Python feature flag replaces the older rewrite scheduler for this course.
2. Python receives an immutable job snapshot containing profile/enrollment context, the ready plan and its version, prior module summaries, source content, and the trigger. No assessment answer key is included.
3. The editor makes at most two model calls, then validates the authored structure. IDs, kinds, icons, numbers, cues, code and technical terms remain authored. Narration is rebuilt from sentences. Next.js independently validates the content again.
4. Python submits the revision to Next.js. Next.js voices its narration using the existing Gemini/Kokoro integration and publishes text and audio together. The local audio cache is scoped by enrollment/module and keyed by text plus voice settings. Hook clips and slides share that cache.
5. During concept playback, **Simplify** and **Give an example** pause the current audio. A ready revision replaces the current slide and restarts it from the beginning. A playing slide resumes; a paused slide stays paused. Volume, playback speed and captions are preserved. Ready background slides enter at slide boundaries, never halfway through a playing slide.
6. A wrong in-video answer requests a simpler explanation of the current slide. The short practice check can be retried after the explanation. Module and final assessment screens are not rewritten.
7. At 20 seconds, an interactive request stops waiting and offers resume/retry; later completion cannot unexpectedly replace that slide. Navigation also cancels client adoption. The durable server job may still finish for audit/cache purposes.
8. Verified question attempts and module-check responses feed versioned module summaries. Two misses in a lesson or a failed module check increase support. Missing evidence retains baseline support. Active visible playback time, replays and support requests supplement the summary; they do not independently trigger interruptions or imply mastery.
9. Module completion flushes queued signals, persists its summary and applies a rule revision before queuing the next module. A completed AI plan queues refreshed content again. Late evidence creates a new version and supersedes pending older background revisions; currently displayed content and completed progress remain stable.

Graded answers also queue the next module before completion, using the same server-scored evidence as the completion handoff. Replayed slides and elapsed playback time remain in the audit summary but do not invalidate otherwise identical teaching. Newer ready revisions enter untouched slides or the next visit to that slide; a revision never replaces the middle of active narration.

Weak prerequisites include their authored titles and key ideas, so the editor can connect the earlier teaching to the new slide. A brief visible and spoken “Quick reminder” makes that connection explicit without exposing scores or failure labels.

The fictional organisation is consistently called **Harbour Works**, with its activities adapted to the learner's field; Scout retains its name. Authored material remains the fallback while personalised pieces are preparing. Assessment questions and answers keep their authored meaning and grading.

## Service contracts and persistence

The browser talks only to Next.js. All browser endpoints use the existing session and enrollment scope:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/enrollments/:course/modules/:module/adaptation-requests` | `{videoId, slide, trigger, requestId, baseRevision?}` → `202 {job}` |
| `GET /api/v1/enrollments/:course/modules/:module/adaptation-events` | SSE `revision` events: ID, request ID, video/slide identity, status, and ready content/audio |
| `GET /api/v1/enrollments/:course/modules/:module/performance` | Internal evidence counts and reasons, scoped to the learner; not presented as learner levels |
| Existing `/signals` | Adds `slide_activity` and `support_request`; identifiable answer responses are scored server-side |
| Existing `/adapted` | Advertises `live: true` and returns ready personalised hook/worked pieces |

SSE reconnect sends a complete current snapshot. Clients deduplicate revisions and accept only their active request. Event IDs identify job/status timestamps. Input snapshots and operator errors are never included in browser events.

The Python API provides `GET /health`, `GET /ready` (configuration readiness, not a provider connectivity check), and authenticated `POST /v1/generate`. The worker calls it with `{input}` and receives `{content, model, metrics}`. The API remains private to the local processes.

Next.js exposes credential-protected `POST /api/internal/adaptation/:action`: `claim` accepts a lane (`interactive`, `background`, or `all`); `heartbeat`, `result` and `failure` require a job ID and lease token. Workers renew leases every 15 seconds; leases expire after 60 seconds. Claims use compare-and-set updates. A job gets at most three attempts. Superseded or expired lease holders cannot publish results. One worker lane reserves capacity for interactive requests; another prepares future content. Generation errors are logged by exception type without provider response bodies.

Migration `0006_adaptive_slide_jobs` adds `adaptation_jobs` and `module_evidence`, using the existing Drizzle migration mechanism for PGlite/Postgres. Jobs preserve input fingerprints, source/profile/plan/evidence versions, model/prompt metadata and timing measurements. Evidence summaries are append-only versions. Enrollment deletion cascades to both tables. Audio files follow the existing local audio-storage lifecycle.

Signal batches retain IDs in a browser-local retry queue across refreshes and retry after failure. The existing final-assessment rules are unchanged. For the pilot's generation policy, only server-verifiable answers affect correctness counts; older signals without responses are not treated as verified mastery.

## Validation

```powershell
npm run lint
npm run typecheck
npm run build
# From apps/web
node tests/backend/run.mjs live
node tests/backend/run.mjs adapt
node tests/backend/run.mjs
node tests/backend/run.mjs engagement
node tests/backend/run.mjs workflow
# From apps/adaptive-api
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

The live suite tests job deduplication, claims, leases, bounded retries, audio/text pairing, invalid generation rejection, server grading, module-summary versioning, Module 2 prerequisite context, late-evidence supersession, authorization and SSE delivery. Python tests cover bounded generation/repair, structural locks, provider failures, API authorization and worker receipts, without paid provider calls.

`apps/web/tests/backend/live-browser.mjs` exercises the actual React player using mocked generation events and audio. Run it from the root against an isolated Python-enabled server with no AI keys, `PGLITE_DIR` set to a separate test folder, and port 3003 (`TEST_BASE_URL` overrides this). It requires Playwright and installed Edge; `PLAYWRIGHT_MODULE` can name an existing local Playwright installation. The screenshot goes into the ignored `.data/tests` folder. It checks initial personalisation, the current-slide loading state, matching revised audio, preserved pause state, navigation cancellation and React errors.

Provider latency and teaching quality need review with the configured live models. `textMs`, `speechMs` and `totalMs` are recorded per revision; the 20-second deadline is a fallback policy rather than a latency guarantee. Automated verification uses mocked provider responses. Browser checks also cover preserving active playback, entering personalised content at the next slide boundary, and ignoring completion after the interactive deadline.

`node apps/web/tests/backend/loop-real.mjs` exercises paid/live generation against a separate app at `LOOP_DEMO_URL` (default port 3005), copying profile information from `LOOP_SOURCE_URL` (default port 3002). Start that test app with a fresh, separate `PGLITE_DIR`. It compares the same Module 2 slide before and after two explicitly simulated, server-scored Module 1 misses and module completion. Both generated WAVs and a report are saved under `apps/web/.data/loop-demo/`; the original progress is checked for changes. `LOOP_RESUME=true` retries generation using existing test evidence and the saved baseline without adding duplicate misses. The October 19 live run passed with the configured Gemini text model and Kokoro speech, including browser playback of the adapted slide.
