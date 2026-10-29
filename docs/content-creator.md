# Content Creator Studio — SME input through Stage 4 production

Open `/content`, or select **Content creator** from the sidebar role menu. Return to **Learner** through the same menu. Both views use the existing shared demo session; switching views is not authentication or a permission grant. Other roles remain unavailable.

## Available now

- Workspace with draft count, last-edited cards and the eight ILD stages.
- Searchable course draft list, creation, explicit save and resume.
- Course brief: title, subject, audience, prerequisites, outcomes, estimated duration, delivery context, raw source text, references, ordered dependencies, workplace contexts and difficulty areas.
- Editable objectives with Bloom's labels and optional physical-skills/practice notes.
- Incomplete saves, unsaved navigation/reload warnings, visible errors and revision conflicts that retain entered text.
- Gate 0 preparation checks for input presence and Bloom's variety. These do not establish factual accuracy, objective measurability or expert approval. Write “None known” where an explicit absence is appropriate.
- Settings explaining demo access and linking to the application's appearance/accessibility controls.
- Stage 2 AI processing of complete saved SME input, with seven readable blueprint sections, source/objective links, history, status polling and JSON download.
- Stage 3 module-level SME quality control with seven checks, approve/request revisions/reject decisions, feedback priority and append-only decision history.
- Stage 4 long-form production: five videos per approved module, 7–9 editable slides per video, reviewed plan and activities, source-linked scripts, resumable generation, exact-revision script approval and measured 5–7 minute audio per slide. Companion hook, worked examples, guided practice, scenario lab and quiz have a creator rehearsal.
- Legacy single-module scripts-first pilot: 12 AI-generated slides, six structured layouts, editable narration and pronunciation/activity notes, preview, stable IDs, revision history, JSON download and exact-revision script review. Local Kokoro audio is available after exact-revision script approval.

Reference links are stored as text, never fetched. Stage 2 explicitly sends the frozen course brief (including source notes and references) to the configured server LLM. Learner profiles, progress and assessment keys are excluded. Stage 3 saves human review decisions without AI calls. There are no uploads or publishing actions. Existing LMS content is read-only and is not automatically imported into the authoring workspace. Published original reading content and learner records are untouched.

## ILD roadmap

The source is `ch13-ild-pipeline-framework.html`. SME Input, AI Instructional Design, module SME QC and a Stage 4 scripts-first production pilot are available. Long-form authoring and activity rehearsal are also available. Learner publication, rendered MP4 exports, formal ILD QC, Final SME Sign-off, Learner Pilot and Monitoring & Iteration remain deferred. Generating a blueprint never approves it. Stage 3 and script approvals are explicit human decisions in the local demo, not production identity verification or final release approval.

1. Available AI blueprint: objective mapping, load audit, teaching blend, nine-step module structure, tasks, assessment and motivation; source traceability, tool/template suggestions and accessibility notes.
2. Asset production: slides, diagrams, narration/audio, assessment editing and selected-asset regeneration.
3. Review/pilot: SME task loops, nine-dimension ILD rubric, version-specific decisions and pilot feedback.
4. Publishing/improvement: **Approved for pilot → Pilot passed → Published**, versioned releases, rollback and analytics. Original reading and permitted adaptive variants stay separate.

Real identity, organisation isolation and reviewer permissions are prerequisites for external team access. The current studio is an internal local demo, not a production authoring service.

## Storage and API

Migration `0008_creator_courses` adds a separate table in the existing PGlite/PostgreSQL database. Each record contains a UUID, session-derived owner, structured JSON brief, revision, creation time and last-save time. No fixture generation or learner/adaptive writes occur. Migration applies automatically on database opening; existing installations retain their data.

| Endpoint | Contract |
| --- | --- |
| `GET /api/v1/content/courses` | `{courses: CreatorDraft[]}`, current owner only, newest save first |
| `POST /api/v1/content/courses` | `{brief: CourseBriefData}` → 201 `{course: CreatorDraft}` |
| `GET /api/v1/content/courses/:id` | `{course: CreatorDraft}`; invalid, absent or other-owner ID → 404 |
| `PATCH /api/v1/content/courses/:id` | `{brief: CourseBriefData, revision: number}` → `{course: CreatorDraft}` |
| `GET /api/v1/content/courses/:id/blueprints` | `{runs: BlueprintRun[], configured: boolean}`, owner scoped |
| `POST /api/v1/content/courses/:id/blueprints` | `{revision: number}` → 202 `{run}` while running; 200 when an existing ready result is reused |
| `GET /api/v1/content/courses/:id/blueprints/:runId/reviews` | `{entries, summary, writable}`, including current module decisions and all historical events |
| `POST /api/v1/content/courses/:id/blueprints/:runId/reviews` | `{moduleId, expectedVersion, verdict, checklist, feedback, priority}` → 201 updated review state |

An update atomically matches owner, ID and revision and increments the revision. Stale writes return 409 `draft_conflict`; validation errors return 400. Ownership fields and unknown input keys are rejected. Full brief replacement is deliberate: the editor saves one consistent snapshot. CreatorDraft timestamps are ISO strings. Empty fields are valid; objective Bloom's labels, maximum lengths and field types are validated server-side. Reference/source text is rendered as text, not executable HTML.

On conflict, copy unsaved content before opening the latest saved version; there is no automatic merge. Failed saves retain the editor's values. Unsaved values are held in memory until saved, so a crash cannot guarantee recovery.

## Stage 2 processing and limits

Migration `0009_creator_blueprints` adds independent run records containing the frozen brief, objective IDs, source paragraph IDs, input revision, prompt version, status, attempt token, model and token usage. The server derives ownership through the course. It rejects incomplete input (422), stale requested revisions (409), malformed bodies (400) and unconfigured AI (503). Repeated requests for the same course/revision/prompt share a run; ready outputs are reused. Later input revisions produce separate runs and older output is marked outdated.

The prompt in `src/server/blueprint-ai.ts` performs all seven operations in one coherent LLM pass. It uses the existing server transport, at most two configured models and one repair per model (four calls maximum; each call has a 90-second timeout and no HTTP retries). It asks for source-grounded fictional scenarios, flags gaps and missing facts, and never treats uploaded/pasted source text as executable instructions. Source references are not independently verified.

The response is checked against a bounded JSON schema and validated for real source/objective/module IDs, prerequisite order, nine-step ordering, duration arithmetic, three task tiers per module, objective coverage and L1–L4 assessment layers. Assessments include Bloom/SOLO classifications, timing, criteria, misconceptions and remediation. Psychomotor applicability follows the brief; L5 and physical-practice templates are conditional. These are structural checks, not semantic proof, accessibility certification or formal SME/ILD approval.

Processing uses Next.js `after()` in the current server process; it is not a separate durable worker. Database records and completed output persist. If that process stops, the next status read marks an expired eight-minute lease failed and offers an explicit retry. Attempt tokens prevent late results from overwriting a newer retry. A production deployment should move execution to an independent worker before relying on serverless process lifetimes. The history selector retains historical completed results; JSON download includes the exact input snapshot and an AI-draft review label. No slide, audio or learner content is generated or published by Stage 2.

## Stage 3 SME quality control

Open a ready blueprint and choose **Stage 3: SME quality control**. The URL includes the immutable run ID. Inspect each module's original objectives, nine-step sequence, tasks, assessment criteria and frozen source blocks. The full blueprint remains accessible for its overall recommendations and accessibility/motivation design.

For every module, review content accuracy, objective alignment, sequence validity, difficulty, workplace authenticity, completeness and assessment validity. All seven booleans must be true to approve. Rejecting or requesting revisions requires non-blank feedback; use numbered changes tied to the affected element. Priority is Critical, Recommended or Optional. Failed saves/conflicts preserve local edits; reload/navigation warn about unsaved work.

Migration `0010_creator_sme_reviews` stores append-only events with run ID, module ID, review version, decision, checklist, feedback, priority and session-derived reviewer identity/time. Updating a decision creates a new event. The API locks the course while checking the source revision and appending a version; concurrent stale saves return 409. Clients cannot supply reviewer identities. Invalid decisions return 400; unknown or other-owner resources return 404. Pending/failed runs and outdated input/prompt versions cannot receive new decisions. Existing historical reviews remain readable.

Gate 1 is shown complete only when every module's latest decision is approved with seven checks passed and the blueprint still matches the current input/prompt. Editing Stage 1 makes that old review historical/outdated; generating a new blueprint starts a separate pending review. Approval does not transfer, edit generated content, publish the course, award learner mastery or complete Stage 6 final release QC. Feedback is recorded for the creator and can be downloaded; it does not automatically regenerate modules. Real SME-role assignment and authenticated sign-off remain prerequisites for external production use.

## Legacy Stage 4 scripts-first module pilot

From an approved module in Stage 3, choose **Open Stage 4**. The page `/content/courses/:id/production/:runId/:moduleId` targets one module. The HR pilot targets M1, Foundations of Policy Grounding. Other modules may remain pending; this explicitly does not complete course-wide Gate 1 or Gate 2. No approval is inferred or recorded on behalf of the user. A direct visit to an unapproved module shows a disabled generation control and the prerequisite.

The configured LLM receives a frozen approved blueprint, SME sources, audience, selected module specifications and its exact Stage 3 approval/feedback. It does not receive learner profiles or adaptive performance data. Generation targets 12 slides with all nine stages in order, bounded schema/traceability checks, at most two models and one repair per model. The six layouts map to the existing slide renderer: title, definition, comparison, bullets, worked example and recap. In this legacy pilot, no generated HTML/CSS, external media links or interactive activity runtime is accepted. Activity instructions remain authoring notes. Local audio is generated separately after script review. Structural checks do not prove factual or teaching quality.

Migration `0011_creator_module_production` adds independent generation jobs, append-only content revisions and script-review events. Jobs bind to blueprint run/module, approval event and generation-prompt version. Retries use attempt tokens and eight-minute leases, with Next.js `after()` execution as in Stage 2. Repeated requests reuse current jobs. Interrupted runs become failed/retryable; late attempts cannot overwrite newer work. Completion after a source change retains the paid result as historical/read-only content. Production execution still needs an independent worker before a robust multi-user/serverless rollout.

The editor saves snapshots with expected revision checks. Slide IDs survive editing and reordering; new slides receive new IDs. Reordering remains within a teaching stage, and each stage needs a slide. Source/objective links and concise layout limits are validated. Narration sentence arrays are derived deterministically from the script; SHA-256 hashes are stored per slide for audio reuse. Estimated spoken time (130 words/minute) is shown separately from activity time and the blueprint budget. These are planning estimates, not measured media duration.

Script review requires a saved current revision and confirmation of source accuracy, visual/narration alignment, pronunciation notes and pacing. Unresolved flags or missing scripts block approval. A revision request requires feedback. Every subsequent content save requires renewed script review; prior decisions remain historical. Editing Stage 1, replacing/withdrawing Stage 3 approval or changing the prompt makes old production sources outdated. A fresh approval needs a new production package. Script approval enables an explicit audio-generation action; it never publishes learner content. The JSON download is the selected saved revision, not unsaved editor text.

| Production API | Contract |
| --- | --- |
| `GET /api/v1/content/courses/:id/blueprints/:runId/modules/:moduleId/production` | Eligibility, approval, job/revision/script-review history and AI configuration status |
| `POST` same route | `{approvalId}` starts/reuses generation; 202 when launched, 200 when reused |
| `PATCH` same route | `{jobId, expectedRevision, content}` appends a validated content revision |
| `POST` same route + `/review` | `{jobId, expectedRevision, expectedReviewVersion, verdict, checklist, feedback}` records a script decision |

Ownership and reviewer identity come from the session. Cross-course/run/module IDs are rejected; outdated approvals and conflicting saves return 409. Source references are text and are not fetched. Audio generation, learner publishing and adaptation are not invoked.

### Verification

From `apps/web`, run `node tests/backend/run.mjs content-creator` for isolated in-memory migration, ownership, validation, API and concurrent revision checks. Run repository type checking, lint, original-reader tests and a production build. Manually exercise role switching, incomplete save, reopen, search, objectives, failure/conflict preservation and responsive keyboard navigation. To verify persistence across restarts, use a separate `PGLITE_DIR` test database and reopen its saved draft after restarting the server.

Run `node tests/backend/run.mjs creator-blueprints` for Stage 2 schema/traceability, bounded repair, duplicate starts, frozen input, stale history, owner isolation, failures, retry tokens, interrupted leases and API validation. Real-provider generation is a separate smoke test and must report its actual result; no authored fallback is passed off as AI output.

Run `node tests/backend/run.mjs sme-review` for Stage 3 checklist requirements, rejection feedback, per-module decisions, immutable history, concurrent conflicts, ownership, stale versions, pending-run protection and unchanged blueprint/learner records. Smoke-test approve, reject/request revisions, changing a decision, failed-save retention and persistence in an isolated course; do not pre-approve the user's real modules.

Run `node tests/backend/run.mjs module-production` for Stage 4 approval gating, six-layout compatibility, bounded repair, source/coverage checks, deduplicated jobs, save conflicts, stable IDs, narration hashes, script decisions, source revocation and late/interrupted attempts. Smoke-test real generation only on an isolated approved copy unless the actual module has an explicit saved human approval. Verify speech calls require script approval, generation → edit → save → reopen → script review → edit again, historical preview, mobile layout and keyboard focus.


## Approved-script audio narration

After Stage 3 approval, generate and save a production package, review its scripts, then choose **Generate approved narration** in Stage 4. One local Kokoro WAV is generated per slide. The audio panel shows its revision, voice, measured duration, history and matching narration text, with manual playback and individual downloads. Unsaved edits disable generation and playback. Pronunciation notes remain human listening-review guidance; they are not spoken or applied automatically.

Migration 0012 adds audio jobs bound to production revision, script approval event and a frozen voice fingerprint. The owner-scoped /production/audio GET/POST API derives identity from the server session. Media requests use the same owner checks and support byte ranges. Changed scripts, withdrawn approval or changed voice settings make previous audio historical. Existing media and reviews are retained. Only unchanged script/notes/voice fingerprints are reused; missing clips can be regenerated. Learner profiles, assessments, original reading audio and course publication are untouched.

The pilot uses the existing scripts/tts-worker.mjs child process, coordinated through Next.js after(). This is separate CPU synthesis, not a durable distributed worker queue. Jobs persist progress, use attempt tokens and become explicitly retryable after a 35-minute lease; synthesis is bounded to 30 minutes per attempt. Completed clips survive partial failures. Files live under apps/web/.data/creator-audio; back up that directory together with the database. Shared durable object storage remains production work.

Set AUDIO and KOKORO to values other than off. KOKORO_MODEL, KOKORO_VOICE (default am_michael), KOKORO_DEVICE and KOKORO_DTYPE configure the local worker. First use may download model assets; narration text is synthesized locally. Creator narration does not call the external Gemini speech API. Run node tests/backend/run.mjs production-audio for approval gating, ownership, deduplication, changed-clip reuse, retries, interrupted attempts, WAV validation and range-serving tests.

Blueprint prompt version 2 explicitly supplies exact Bloom/SOLO labels, permitted output keys and required L1-L4 assessment coverage. It requires final-deliverable objectives to be taught, practised and assessed within the module structure. Validation and the existing bounded repair limit remain unchanged. Older blueprint runs and production packages remain historical; new generation uses the current saved brief and a distinct prompt-version fingerprint.

## Codex-assisted full-course authoring (Codex ILD v2)

The **Build the full course from the SME brief** workspace is a distinct authoring path, selected for new creator drafts by default. It uses Codex during authoring through a course-scoped Streamable HTTP MCP connection; the LMS does not run this Codex workflow as a background service. Start with `.agents/skills/course-creation/SKILL.md`, which coordinates `learner-profiling` in audience mode, `lesson-generation`, `quiz-generation`, `mini-project-generation` and `course-quality-review` in the same chat. Each specialist also supports a focused request and returns its owned fragment/report; only the coordinator assembles, reviews and saves complete packages. The old monolithic skill is retired; existing MCP endpoint/configuration stays unchanged. The workspace provides the Codex `config.toml` server entry and a Windows PowerShell command for storing the expiring token as an environment variable, so the token is not embedded in the MCP settings file. See [Codex-assisted ILD course creation](codex-ild-course-creator.md) for routing, handoffs and the MCP contract.

Each module follows Problem Hook → Concept Explainer → Worked Example → Guided Practice → Scenario Lab. Each concept video has exactly two formative questions after the midpoint slide. After all modules, the course has one Mini Project → objective-aligned Mastery Gate (creator-set pass percentage) → Reflection. Spaced Review is omitted. Module/video/slide counts and spoken time are author-selected recommendations based on objectives and the SME time budget. Narration length and learner activity time are tracked separately.

Codex receives the saved SME brief, source blocks, references and latest current blueprint. SME text is treated as untrusted reference material. Research references must include title/publisher/URL; IDs and links are kept with course items. Links are stored but not fetched or verified by the LMS. The JSON package supports editable native LMS content, a PowerPoint export, narration text and local Kokoro WAVs. Audio is generated only after script authoring and retained by revision; unchanged narration fingerprints can reuse clips. Every edit creates an immutable package revision. A final review decision is bound to the exact saved revision and requires the full human checklist; approval does not publish.

Migration `0016_codex_authored_courses` stores append-only package revisions, final review events and hashed short-lived Codex grants. Migration `0017_authored_course_audio` stores revision-bound local audio jobs. Owner IDs are derived from the app session; MCP course scope comes from the bearer grant rather than tool arguments. The current session remains a shared local demo identity, so this is not production tenant isolation. The JSON-schema/traceability checks and author checklist are aids, not factual, instructional or accessibility guarantees.

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/v1/content/courses/:id/authoring` | Read revision history / append a validated full-course revision with expected brief and package versions |
| `POST /api/v1/content/courses/:id/authoring/review` | Request changes or approve the exact latest revision after all final checks |
| `POST/DELETE /api/v1/content/courses/:id/codex-connection` | Issue one-time eight-hour grant / revoke a grant |
| `GET /api/v1/content/courses/:id/codex-context` | Download the saved SME context and its stable objective/source IDs |
| `POST /api/mcp/ild-course-creator` | Stateless Streamable HTTP MCP tools for reading context/draft and saving a revision |
| `GET/POST /api/v1/content/courses/:id/authoring/audio` | Read audio history / start or retry local script narration |

Audio jobs run local Kokoro synthesis coordinated by the current Next.js process; they are not durable distributed workers. The UI visibly labels the shared demo identity and the lack of publishing. Later LMS generation still needs a durable server-side queue and provider credentials. It should retain the same package contract, validation, append-only history and final human sign-off.


## Long-form Stage 4

Choose the five-video format in the course brief's Stage 4 production settings, or open /content/courses/:id/production. Format metadata is separate from SME content revision: enabling it does not silently rewrite or approve the blueprint. Migration 0013 adds a course production format and per-job unit key while retaining all pilot jobs, revisions, decisions and media.

Each approved module starts with one production-plan unit. It contains exactly five distinct video outlines, each with 7–9 stable slide IDs, plus a problem hook, 2–3 worked examples, 6–8 guided steps, exactly three scenario cases and 5–10 quiz questions. All items carry objective/source links. The minimum slide time plus activity allocation must fit the blueprint's planned module budget. Review and approve the saved plan before generating individual videos.

Each video is its own generation job with saved revision and script review. Its input freezes the exact plan revision AND plan-review event. Plan edits or a replaced/withdrawn plan review make dependent video jobs historical. Source changes continue to invalidate production. Video generation and edits retain the reviewed slide IDs/order and objective/source links. New scripts target 650–700 substantive words per slide as a planning estimate; approval enforces the 600-word planning floor. The floor is not proof of five minutes or quality: generated audio is independently measured and every clip must be between 300 and 420 seconds inclusive. There is no silent fallback, silence padding or playback slowing. A short clip stays failed, is available for preview, and requires script revision and renewed approval before retry. Unchanged clips from the same video are reused after edits.

Long-form Kokoro synthesis uses bounded narration chunks and concatenates their samples without adding silence. This avoids the single-call tokenizer's truncation of long text. Long-form voice fingerprints use speech version 2; legacy pilot/adaptive worker calls retain their original path and existing cached clips. Audio still uses a child process and local disk; distributed queues and shared object storage remain production work.

The activities editor includes a creator rehearsal: the hook and scenario questions offer hints and retries; guided steps expose evidence for self-checking; wrong quiz answers retain the current question and prior progress. No learner grades, course completion or published fixtures are changed. Correct answers are visible only through the owner-scoped creator interfaces. The role switch remains demo navigation, not production authentication.

Module readiness requires a reviewed plan/activities, exactly five approved video scripts, and complete current audio with every clip meeting the duration minimum. Readiness is an asset milestone, not release approval. The API adds unitKey (plan/v1/v2/v3/v4/v5) to generation requests; unit lineage is derived server-side. GET /production/readiness reports the combined state. PATCH /content/courses/:id/production-format changes format using an expected-format comparison. All endpoints retain session-derived ownership.

Plan generation allows at most two configured models and one repair per model. Video generation applies that bound per slide, with a 12-minute attempt budget checked before each call. Each call has a 180-second timeout; unit jobs have a 16-minute lease and become explicitly retryable after interruption. Speech attempts are bounded to 30 minutes with a 35-minute lease. Generate/review videos separately rather than launching course-wide media batches. Save errors retain local drafts and stale writes are rejected.

Validation: node tests/backend/run.mjs longform; node --test tests/tts-chunks.test.mjs; existing creator, blueprint, SME, production, audio and reader suites. Real-service smoke tests use an isolated approved copy; no actual SME approval is fabricated.

Long-form video scripts are generated one slide per request. Validated slides are checkpointed in `creator_production_jobs.partial_slides` (additive migration 0014); explicit retries reuse them. Each slide allows at most two model candidates with one repair each, within a bounded video attempt. A worker interruption does not discard already validated script slides.

Timing limits: the plan budget check uses the contractual five-minute slide minimum plus activity allocation. Scripts and the chosen voice can produce longer clips; completed video cards and audio history show measured time. Review actual assembled narration plus activities against the blueprint budget before final quality review. Asset readiness does not certify pacing or a course-duration claim.

Long-form CPU speech sessions use a bounded ONNX intra-operation pool (default two threads per worker) to avoid oversubscribing cores when producing several videos. `KOKORO_CPU_THREADS` accepts 0–64; zero opts into automatic ONNX threading. This changes scheduling only, preserving model, dtype, voice, speed, script, chunking and sample rate. Legacy short/adaptive speech keeps its previous loader. CPU concurrency still needs an external bounded queue for production deployments.

A completed long-form video also has a creator-only continuous preview. Its selected slide, matching script and owner-scoped audio clip stay together by stable slide ID. Play video advances at clip end; native audio controls and previous/next slide controls remain available. Continuous playback requires current, complete approved audio. Unsaved authoring changes remove playable audio, and historical audio cannot start the current-video continuous mode. This records no learner progress and does not export an MP4 or publish the course.

Unchanged input saves are idempotent: after the owner/revision check, an identical brief keeps its revision and saved timestamp. Blueprint currency compares the entire validated brief (including objectives, sources, references, audience, duration and all other authored fields) and prompt version, rather than trusting only a counter. This also preserves frozen runs and existing decisions after legacy no-op saves advanced a counter. Input snapshots, revision counters, approval events and production/media history are never rewritten. Any actual field change still invalidates downstream generation and approvals; equality is exact after schema parsing, not fuzzy or LLM-based. The Stage 2 view explains when an identical saved brief reuses an older frozen input revision.

Narration duration policy (5–7 minutes per slide): 300 and 420 seconds pass; below 300 or above 420 blocks audio readiness and repeat generation of the same reviewed script. Old ready media is rechecked against the current duration policy and retained for historical preview. Revise the affected narration, save and approve its new revision, then regenerate at normal speed. Never pad, truncate or accelerate clips to satisfy timing. Script length is only a planning estimate; measured audio is decisive. The policy does not change voice fingerprints or overwrite historical source/approval records.

Course delivery structure v1: creator courses can opt into a separately persisted six-stage module sequence (Problem Hook → Concept Explainer → Worked Example → Guided Practice → Scenario Lab → Quiz). Migration 0015 defaults existing courses to legacy. Owner-scoped delivery-structure PATCH uses an expected-value conflict check; it leaves SME revisions and reviewed media untouched. Mastery Gate, Reflection and Spaced Review occur only after the final module, with no mini-project. Creator brief, blueprint, review and long-form views show this policy. Existing frozen blueprints remain source records; a new prompt-v3 blueprint freezes the policy and existing module IDs/order and requires fresh review. Approved prompt-v2 source/media remain supported, never rewritten or implicitly reapproved. Course-end assets require separate authoring and review; this setting does not publish content or change learner progress.

Long-form midpoint checkpoints: newly generated plans require exactly two source-linked formative questions after the midpoint slide of each video (after slide 4 for an eight-slide deck). Questions cover only first-half source/objective links. The reviewed plan freezes the checkpoint in the video package; changes require plan revision and renewed review. Creator playback pauses at that boundary, retains prior correct answers during hint/retry, then resumes the next matching clip after both questions are correct and the user chooses Continue video. Quiz time is activity time, excluded from the 300–420-second measured clip range. The module-end quiz stays separate; these checks do not award grades or mastery. Existing Module 1 plans and media without checkpoint metadata remain unchanged.
