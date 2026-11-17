# Connected SCORM Builder courses

The creator importer at `/content/import` connects an upstream course document ID to an existing creator course. Builder remains the source authoring system; this app never writes source courses or sends learner profiles to Builder. The legacy topic pilot and original packaged SCORM player remain separate.

## Creator workflow

1. Select the Builder course and LMS destination. Choose all topics or a subset, and explicitly select draft snapshots or exact published topic releases.
2. Preview topic, subtopic, objective, narration, video and task coverage. A changed source fingerprint requires another preview.
3. Stage and resume the import. Each durable step processes one topic and caches its supported media. A failed step retains completed topics and assets; retry resumes rather than duplicating the import.
4. Propose the audience brief and mapped LMS outcomes. Original objectives and task instructions remain in immutable source snapshots. Proposals do not establish real tool proficiency or constitute human approval.
5. Prepare the seven-module draft incrementally. Each source topic maps to one stable LMS module. Source narration and recordings stay available. Generated hooks, worked reasoning, guided practice, scenarios, two first-half-supported midpoint questions and module quizzes remain editable. Original source quizzes retain their answers and scope as supplementary formative checks. A single guided project, comprehensive 80% final assessment and reflection complete the draft.
6. Review the original-to-LMS objective mappings and save the source library. Generate the current blueprint and approve its modules through the existing creator flow. Assembly uses the existing full package validator and revision checks. Final human review and publication remain separate; no source import or generated quality recommendation approves a course.

External-tool objectives must be reviewed when replaced with ready-made workflows that learners run and explain. The bounded sandbox does not execute arbitrary source code or provide NotebookLM, Antigravity or live factory control. Source task code, media and task-page material remain source evidence, not executable application code.

The model supplies case evidence, explanation prompts and rubrics. A trusted app template constructs the executable project workflow, including labelled arithmetic checks where applicable. Module guided practice reuses the two supplied cases as interpretation exercises and preserves existing step IDs; it requires no outside accounts or uploads. The supplied AI results are claims to evaluate, not authoritative answer keys.

## Versions and learner editions

Migration 0023 adds connections, durable import runs and append-only published course editions. It backfills the current published snapshot and pins existing enrollments before any expansion. Publication keeps old learners on their pinned edition; new enrollments pin the current publication. Navigation, grading, project work, source media, narration and adaptive context resolve that edition.

An explicit upgrade archives the prior enrollment and creates a fresh enrollment for the newer edition. Existing progress, signals, plans, grades and submissions remain attached to the archived enrollment. They do not complete the expanded course. Browser state uses enrollment-scoped keys. The first legacy edition migrates existing course keys without deleting them; upgraded editions start with a separate scope.

## Synchronization and safety

Check for source updates is manual. A new import run never replaces a live publication. Reconciliation compares the last assembled baseline, creator edits and incoming content, merging stable-ID arrays so unrelated edits survive. True conflicts require creator choices; stale brief versions reject those choices. Unchanged module fragments can be retained. Changed teaching invalidates its dependent checks, activities and course-end coverage.

Media is stored in ignored `apps/web/.data/connected-scorm-media`, outside Git. Downloads accept only registered HTTPS CDN references, bounded supported media containers and complete responses, with SHA-256 identities. The media route supports byte ranges and requires creator ownership or inclusion in the learner's pinned enrolled edition. Include this directory, the database and other narration storage when transferring the app.

Connected-course personalization uses the existing Python worker. The default
`IMPORTED_ADAPTIVE_PROVIDER=vertex` requires Google ADC or
`GOOGLE_APPLICATION_CREDENTIALS`. An explicit
`IMPORTED_ADAPTIVE_PROVIDER=configured` setting instead uses the existing
`LLM_PROVIDER`/`LLM_BASE_URL`/`LLM_MODEL` and `AUDIO_PROVIDER` settings; Gemini's
OpenAI-compatible endpoint and `AUDIO_PROVIDER=kokoro` support local narration
without Vertex authentication. This is an operator-selected policy, not a silent
authentication fallback. Provider/model/voice settings scope generated revisions
and narration caches. Both a validated learner-specific script and matching
narration must be complete before adoption. Imported source checks, enrollment
editions and assessment exclusions remain enforced. Source recordings stay
available when generation is unavailable. No unsplit source recording is
represented as a matching personalised clip; long split concepts identify full
source media as reference material.

For a local Gemini/Kokoro setup, retain `LLM_API_KEY` and use:

```dotenv
IMPORTED_ADAPTIVE_PROVIDER=configured
LLM_PROVIDER=openai
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-3.5-flash-lite
LLM_FALLBACK_MODEL=gemini-3.5-flash
AUDIO_PROVIDER=kokoro
KOKORO=on
```

Restart the web service and Python worker after changing providers. Obsolete
pending imported-course jobs are superseded before worker generation. Existing
published content, enrollments and grades stay intact; reopening a concept queues
the current provider-scoped derivative. The first local speech preparation can
take minutes; completed clips are cached. An existing `gcloud auth login` does not
configure ADC for the Vertex mode. Use the separate Google ADC setup when choosing
Vertex again.

## Verification

- `node tests/backend/run.mjs connected-scorm`: exact source selections, ownership, deduplication, source changes, answer/task retention, interrupted asset import/resume, candidate brief isolation, midpoint repair and three-way reconciliation.
- `authored-publication`, `authored-assessment`, `guided-project`, `project-sandbox`, `scorm-import`, `video-first` and `live` cover edition isolation and existing delivery contracts.
- `node scripts/verify-scorm-vertex.mjs` performs the separate live Vertex check with isolated profiles. Authentication failure is a blocked live check, not a passing mocked result.

The live AI for Production inventory on 4 November 2026 has seven topics, 61 narrated subtopics, 21 objectives, two source videos and nine tasks. All sources are drafts. Imported media totals 120 assets; source/asset completeness does not establish instructional quality or human approval.

AI for Production was published on 4 November 2026 as package revision 5 (`c38b0964-1b8a-421d-870d-730f860bf833`) after the creator explicitly requested review and publication. It contains seven modules, 61 concept lessons, 122 midpoint questions, 128 retained source checks, seven module quizzes, one ready-made guided project and a 64-question final assessment (80% pass mark). The needless short split at the end of Automation vs AI was merged into its original lesson. Review corrections address savings/OEE arithmetic, deployment guarantees, diagnostic uncertainty, required route stops, model metrics and natural-language project checks. Source recordings and imported answer keys remain intact; visible review notes qualify upstream claims. Original-source playback now presents its retained end checks before completion. Recorded lessons do not create duplicate TTS jobs.

The final review record identifies the work as AI-assisted review under the creator's explicit instruction, not independent human SME certification. No supplemental research citations are used. The existing enrollment remained byte-for-byte unchanged across publication and is offered an explicit upgrade; new enrollments pin the seven-module edition. Production build and relevant regressions pass. All 61 audio and two video asset streams pass byte-range delivery checks. Fresh two-profile Vertex narration remains unverified because Google ADC or a service-account credential path is unavailable.

Large source-library blueprints send complete source evidence once in `input.sources`, with only source metadata repeated in the brief. The saved input snapshot remains unchanged. Blueprint requests allow up to 180 seconds per provider call to accommodate reviewed multi-module imports.

Blueprint generation resolves only uniquely declared topic-to-source references and separates known entry-prerequisite prose from module dependencies; unknown references still fail validation. Creator review and publication links use the existing `/authoring` workspace.

Original hook narration accepts both uploaded recordings and connected source audio/video, and resolves the requesting learner's pinned edition. This prevents connected imports from failing with `Published hook not found` while retaining enrollment and ownership checks. The video-first regression covers connected-media hook preparation and access by an enrolled learner.
