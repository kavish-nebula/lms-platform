# Adaptive teaching pilot

This pilot adds a Python teaching service to the existing Next.js LMS. It covers the `ai-agent` course: profile and enrollment answers personalise Module 1; verified learning evidence shapes subsequent modules, with explicit prerequisite reminders from Module 1 into Module 2. Required objectives, assessment standards and saved stage keys remain authored.

The adaptive editor uses prompt version **4**, the complete eight-section ILD teaching prompt: authority/inputs, instructional design, Module 1 personalisation, later-module evidence, trigger behaviour, multimedia/accessibility, structural constraints, and quality/fallback checks. Course experience is included in `LEARNER_FOCUS`. These instructions support the ILD process; they do not certify factual accuracy, accessibility or SME approval. The existing validators and matching-audio publication checks remain enforced. Profiling and enrollment interview prompts are separate and unchanged by this update.

Each model request also describes the validator's exact per-field character limits and list lengths. For narrated slides with an existing note, prerequisite bridges are directed to that note and an existing narration entry, rather than short flow-node labels or extra sentence-list entries. This guidance derives from the authored content; it does not relax structural, layout or reminder validation.

Problem hooks use a versioned text-edit contract (`textMapVersion: 7`): the model returns changed prose paths only, and Python retains unchanged teaching and restores the authored film, timeline, IDs, numeric values and prediction structure. Grouped string arrays are expanded only when they match exactly the allowed text leaves and length; protected and unknown paths remain rejected. Valid edits survive another entry's validation failure so the bounded repair can finish the story. Both services validate the complete reconstructed hook and reject the original Orbit story. Version 7 also requires the learner's field in the film and opening narration. The version is included in the hook fingerprint, so failed older-contract jobs do not block the replacement. The live view supplies Harbour Works branding and matching audio clips. A schema repair stays with the model that returned text; transport failures may use the configured fallback, within the same two-call bound.

Hook repairs accumulate valid text edits across the two bounded calls and request only corrections, rather than asking for a full film object. Fictional team members may remain for continuity; the authored organisation and its scenario must change. Contract 7 asks for one coherent scenario and a title naming the subject. For a mechanical engineering student it specifies a prototype stress-test workflow and rejects retail remnants such as shipping, parcels and tent branding, returning the affected paths for repair. Personalised film artwork uses a neutral “View details” label, so a student example does not inherit the original shopping action.

Saving a profile queues Module 1 for existing live enrollments; enrollment changes already do the same. Opening a hook promotes it above background slides. The live module response selects the current-input hook rather than an older ready revision. Enrolled live hooks disable Begin until the current text and all matching audio are ready, with visible preparation/failure status. Polling continues after readiness to detect later profile changes. A changed hook audio identity remounts the film at its start screen, stopping the previous audio rather than mixing scenarios. A new hook requires Begin again. Demo/non-live content remains available. Historical ready content and learner progress remain saved. Mechanical scenarios render a shaft/gear drawing instead of the authored tent or generic parcel; the renderer selects safe authored visual components from the generated prose, never executes model-generated HTML/CSS.

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

The saved profile is authoritative for person-level answers; the enrollment retains its course goal, course experience, requested focus and interview. An older enrollment snapshot cannot override a newer profile or reintroduce fields from a branch the learner left. Enrollments without a separate saved profile retain their existing answers. Both planning and lesson generation use this same merge, including the legacy adaptation path.

When an AI plan finishes, enrollment/setup refreshes Module 1 jobs automatically. Plans based on verified answers also refresh the following module even if the preceding module has not been completed. Pending jobs for older inputs are superseded; ready historical revisions and progress remain intact. Queuing failures are logged without marking a successfully validated plan as failed; normal lesson opening retries preparation.

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
node tests/backend/run.mjs adaptive-loop
node tests/backend/run.mjs adapt
node tests/backend/run.mjs
node tests/backend/run.mjs engagement
node tests/backend/run.mjs workflow
# From apps/adaptive-api
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

The live suite tests job deduplication, claims, leases, bounded retries, audio/text pairing, invalid generation rejection, server grading, module-summary versioning, Module 2 prerequisite context, late-evidence supersession, authorization and SSE delivery. Python tests cover bounded generation/repair, structural locks, provider failures, API authorization and worker receipts, without paid provider calls.

The adaptive-loop suite follows enrollment through delayed AI-plan completion, personalised Module 1 jobs, a later profile edit, two server-graded Module 1 misses and an automatically refreshed Module 2 queue. It checks prerequisite teaching, matching audio publication and unchanged progress in an isolated in-memory database, using model/speech stand-ins.

If Turbopack cannot launch its CSS helper on the development machine, `npm run build --workspace=apps/web -- --webpack` provides a production-build fallback with the same translation alias and Tailwind processing.

`apps/web/tests/backend/live-browser.mjs` exercises the actual React player using mocked generation events and audio. Run it from the root against an isolated Python-enabled server with no AI keys, `PGLITE_DIR` set to a separate test folder, and port 3003 (`TEST_BASE_URL` overrides this). It requires Playwright and installed Edge; `PLAYWRIGHT_MODULE` can name an existing local Playwright installation. The screenshot goes into the ignored `.data/tests` folder. It checks initial personalisation, the current-slide loading state, matching revised audio, preserved pause state, navigation cancellation and React errors.

Provider latency and teaching quality need review with the configured live models. `textMs`, `speechMs` and `totalMs` are recorded per revision; the 20-second deadline is a fallback policy rather than a latency guarantee. Automated verification uses mocked provider responses. Browser checks also cover preserving active playback, entering personalised content at the next slide boundary, and ignoring completion after the interactive deadline.

`node apps/web/tests/backend/loop-real.mjs` exercises paid/live generation against a separate app at `LOOP_DEMO_URL` (default port 3005), copying profile information from `LOOP_SOURCE_URL` (default port 3002). Start that test app with a fresh, separate `PGLITE_DIR`. It compares the same Module 2 slide before and after two explicitly simulated, server-scored Module 1 misses and module completion. Both generated WAVs and a report are saved under `apps/web/.data/loop-demo/`; the original progress is checked for changes. `LOOP_RESUME=true` retries generation using existing test evidence and the saved baseline without adding duplicate misses. The October 19 live run passed with the configured Gemini text model and Kokoro speech, including browser playback of the adapted slide.

For a combined profiling/performance comparison, set `LOOP_INCLUDE_MODULE1=true` to record the opening Module 1 slide too, and `LOOP_OUTPUT_DIR` to a dedicated run folder. The report includes the authored Module 1 narration, the personalised version and before/after Module 2 recordings. It checks the source profile and enrollment answers as well as progress for changes. `LOOP_ONESHOT=true` requests `initial` revisions and runs the real background worker once per open slide; use the same internal credential and service URLs as the isolated app, and disable its continuous background lane to avoid preparing unrelated lessons. All credentials stay in process memory; do not persist environment snapshots. Ordinary live runs retain the existing interactive example-request path.

After a successful combined run, `node apps/web/tests/backend/render-loop-demo.mjs --serve` reads that output folder and serves the comparison on loopback port 3010 (`LOOP_REPORT_PORT` overrides it). Only the comparison and its three WAVs are served. Model responses can vary between runs: the performance assertion checks for a visible and spoken prerequisite reminder, not merely different wording. Provider failures log exception type/status without response bodies or credentials; validation failures name the violated constraint. Failed jobs preserve the authored fallback and keep their bounded retry history.

The October 21 combined run passed with the saved software-developer profile, course focus on tools/APIs, real Gemini Flash Lite text generation and local Kokoro audio. Two simulated Module 1 misses produced a visible and spoken Module 2 reminder. Module 1, baseline Module 2 and revised Module 2 took approximately 10.4, 11.1 and 12.5 seconds respectively. The isolated run used Flash Lite for both bounded attempts after the configured fallback returned HTTP 503; production model settings were unchanged. Source profile, enrollment answers and progress were verified unchanged. Artifacts are in the ignored `.data/loop-demo/live-2026-10-21-lite` directory; the comparison's revised audio was played successfully in the browser.

The October 22 main-app hook test used the current electrical/communication electronics student profile and the enrollment's step-by-step course focus. Real Gemini generation produced an electronics lab-report scenario; all 14 Kokoro WAV clips were fetched and verified. The already-open start screen adopted Harbour Works branding without a reload, and the film displayed the lab-report question and played personalised narration after Begin. No assessment responses or completion events were submitted. `node apps/web/tests/backend/hook-real.mjs` verifies this ready hook and compares profile, enrollment answers and progress against the snapshot taken before testing; its local report and recordings are under `.data/tests/main-hook`.

A subsequent October 22 main-app regression used the learner's newly saved mechanical engineering profile and testing/launch course focus. Gemini generated a mechanical stress-test scenario, lab-record conversations and narration; all 14 real Kokoro WAVs passed retrieval/header checks. The current Module 1 opening slide also used mechanical systems and design reports with aligned narration and a real WAV. The open hook adopted the new revision automatically and returned to Begin. Saved profile, enrollment answers and progress matched the pre-test snapshot. Reports, audio and browser evidence are under `.data/tests/mechanical-hook-final`; override `MAIN_HOOK_BEFORE` and `MAIN_HOOK_OUTPUT` when running the smoke test with a new saved profile. Generation is asynchronous; automatic presentation after both text and audio are ready does not imply instant synthesis. Visuals are safe app components, including mechanical bracket/shaft drawings, rather than LLM-generated executable HTML/CSS.

`node apps/web/tests/backend/module1-real.mjs` checks all 40 current Module 1 slide revisions against the main mechanical engineering profile, their authored structure/locked fields, layout limits, sentence-derived narration, real WAV downloads and original-story remnants. It records changed narration and explicit subject context separately. `MODULE1_REPAIR_SLIDES` accepts comma-separated zero-based targets, for example `m1-1:2,m1-3:5,m1-4:4`, to request fresh examples through the normal API. Reviewed revision IDs are scoped to a hash of the profile and enrollment answers and retained for repeat checks. These learner-requested revisions also remain available when the lesson is reopened; older initial revisions are preserved.

The full October 22 review found and corrected an old ORB identifier, a gift-card/refund example and an event phrase incorrectly inserted into a goal sentence. Example requests now explicitly ask for a fresh coherent scenario, reject authored organisation identifiers, reject gift-card/refund examples for mechanical engineering students, and detect the profile event phrase being incorrectly used as the object of “answering”. Repairs remain bounded. All 40 real recordings and content checks passed after three reviewed revisions; all 40 previews rendered with the actual slide component without frame overflow at the tested desktop size. This is not a comprehensive grammar, factual or instructional-quality guarantee.

`node apps/web/tests/backend/serve-module1-review.mjs` serves a loopback-only review at port 3011 with the real app's slide renderer/CSS, authored comparisons and all recorded audio. It also presents a fresh isolated mechanical-profile Module 2 before/after test: two server-scored simulated misses in lesson 1.1 introduced a visible and spoken “Quick reminder”, retaining the token-prediction teaching and producing distinct audio. Main profile, enrollment answers and progress were verified unchanged. By default it reads `.data/tests/mechanical-module1` and `.data/loop-demo/mechanical-2026-10-22`; override `MODULE1_TEST_OUTPUT`, `LOOP_OUTPUT_DIR` and `MODULE1_REVIEW_PORT` for other runs. The review contains recorded outputs and never submits learner answers.

For profile-specific example requests, the editor identifies an existing visible
text field and narration sentence when the slide supports them. The prompt and
its bounded repair point to those fields explicitly; the field-specific
validation, existing layout limits, sentence counts and source constraints
remain in force. If the model cannot satisfy them, the original lesson remains
available and the request fails rather than publishing an invalid adaptation.

## Automatic adaptation for enrolled courses

With `ADAPTIVE_PYTHON_ENABLED=true`, every available course uses live adaptation
after enrollment. Enrollment queues the first module automatically; lesson opening
prepares any missing revisions, and verified learning evidence informs later modules.
New published courses need no configuration changes. The former
`ADAPTIVE_AUTHORED_COURSE_IDS` allowlist is no longer used. Set the global flag to
false for a web-only/offline preview. Run the root `npm run dev` with the Python
dependencies and model credentials configured to start the app, service and worker.

For released courses, hooks, worked examples, guided practice, scenarios, project and
assessments remain the approved release; only learner-specific concept slides and
matching audio are adapted. The master package remains unchanged. The prompt uses
the released slide and its course topic rather than the AI Agent workplace, and
checks preserve the slide structure and numerical facts. These checks do not prove
all generated statements factually correct; failed generation retains the original.
The stream and worker reject stale results when the learner profile or published
revision changes. Audio uses bounded sentence chunks, with a separate cache policy.
