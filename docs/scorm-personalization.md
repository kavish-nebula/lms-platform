# SCORM imports and Vertex learner pilot

The creator workspace links to **Import from SCORM Builder** at `/content/import`. The importer reads the authenticated builder library over MCP; previews a course/topic revision; validates and normalizes teaching, media, transcripts, concept/topic quizzes and tasks; and saves an immutable source snapshot in migration 0022's `scorm_topic_imports` table. Credential values and source ownership metadata are not imported. Duplicate imports are idempotent, source-version mismatches are rejected, and pilot activation checks creator ownership and the selected fingerprint. This app still uses its existing local demo session model; the role dropdown is not production access control.

Source data is read through the documented MCP using the local `~/.scorm-auth/credentials.json` store (or `SCORM_AUTH_DIR`). The server never exposes the bearer key to the browser. The integration exposes no builder writes. Courses use source document IDs; module numbers and topic ancestry are retained. Objectives can be root-level or under `content`. Legacy concept questions with `single`/`multiple` types are normalized to `mcq`/`checkbox`, retaining answer indices and explanations. Missing/invalid objective or answer data blocks import.

## M1-T1 scope

The current learner pilot is `AIforProduction-M1-T1`, working source version 173: three concepts and ten sub-concepts. Its hierarchy shows seven topics under Module 1; T2–T7 remain visibly not imported. The original SCORM player at `/learn/imported/ai-for-production/M1` and revision-scoped package progress remain unchanged. Native progress has separate stable video IDs incorporating the source topic/sub-concept/part.

The native data adapter converts source transcripts to editable component-rendered slides without model-generated executable HTML. It preserves full narration and source reading text, splits long teaching into estimated clips below seven minutes, and retains concept checks. The topic knowledge check follows the last imported lesson and is labelled as a topic check; it is not a course-wide final. Activities are not relocated to invented video midpoints. Original uploaded videos remain source assets and are not represented as personalized MP4s.

Imported content is enabled as a clearly labelled learner **pilot**, not a human-approved published release. External practical tasks and their file-submission flow are retained as source content but not converted into a new sandbox. The guided project, missing midpoint checks and course-wide final remain later work. Do not describe this partial import as a complete approved course.

## Personalization and narration

The Vertex behavior below remains the default. Operators can explicitly choose
`IMPORTED_ADAPTIVE_PROVIDER=configured` to use the configured LLM API and speech
provider instead, including Gemini API-key generation with Kokoro narration.
This preserves imported-source validation and original recordings. See
[connected-course provider configuration](connected-scorm-courses.md) for setup.

The adapter registers active pilot content with the existing `getCourse`/`getModule` data accessors and course companion. Native enrollment and profiling apply. Existing Python generation, durable claims, leases, SSE, audio serving and learner progress are reused. Opening the module prepares the first two videos; later slide openings prioritize their own generation. Original text can be previewed while matching audio is unavailable, with explicit status. No unsplit source audio is paired with split or rewritten text.

Imported jobs explicitly select `vertex` in trusted server context. Python uses Google Application Default Credentials with refreshed OAuth access tokens and the project OpenAI-compatible Vertex endpoint. Next.js narration uses the Vertex `generateContent` endpoint and Gemini TTS audio output, validated/stored as WAV. These pilot jobs never silently switch to Gemini API-key generation or Kokoro. Other existing courses retain their configured provider. Source revision, profile context and voice configuration participate in generation identity; publication rejects stale source/profile content and incomplete narration. Quiz answer standards remain source-authored.

Configure `apps/web/.env.local`:

```dotenv
GOOGLE_CLOUD_PROJECT=nebula-lms
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=C:/credentials/service-account.json
LLM_MODEL=gemini-3.5-flash-lite
LLM_FALLBACK_MODEL=gemini-3.5-flash
AUDIO_MODEL=gemini-3.8-flash-lite-tts
AUDIO_VOICE=Charon
ADAPTIVE_PYTHON_ENABLED=true
ADAPTIVE_BACKGROUND_ENABLED=true
```

Use an actual local credential path or configure ADC; do not put JSON/private keys in API-key variables. Enable Vertex AI/billing and grant the service identity appropriate Vertex access. Text/speech models must be available in the selected region. `AUDIO_LOCATION` optionally selects a separately supported speech region; no region is silently changed. Restart the root `npm run dev` stack after credential/environment changes. To select Vertex for all other native courses too, explicitly set `LLM_PROVIDER=vertex` and `AUDIO_PROVIDER=vertex`.

## Verification

- `node tests/backend/run.mjs scorm-import` from `apps/web`: source versions, ownership, deduplication, normalization, native delivery, two isolated profile/job contexts, paired audio identity, stale-profile rejection and Vertex OAuth/WAV shape using provider doubles.
- `node tests/backend/run.mjs live` and `profiling-api`: existing adaptation and profiling regressions.
- `.venv/Scripts/python.exe -m unittest discover -s tests -v` from `apps/adaptive-api`: teaching validation and Vertex configuration/request contracts.
- `node scripts/verify-scorm-vertex.mjs` from the root: live paid Vertex generation plus matching speech for all imported slides and two synthetic profiles, in an in-memory database. This is the live check, not a mocked test. `SCORM_VERIFY_SAMPLE=true` limits it to the first slide of each lesson and records that limited coverage explicitly. Reports/audio are under ignored `apps/web/.data/scorm-vertex-verification`. It rejects unavailable authentication before creating synthetic learners; failed or partial runs cannot produce a passing report. It never modifies main learner profiles, progress or source content.

On November 3, 2026, real MCP import/activation and browser hierarchy checks succeeded. Production build, lint and mocked provider tests passed. The live Vertex check was **blocked before generation** because neither a credential-file path nor ADC was present. Live personalized narration playback for two profiles is not yet verified.


The legacy single-topic pilot described above is retained. Whole-course reviewed imports and edition-safe expansion now use the connected importer; see [connected SCORM courses](connected-scorm-courses.md). Source drafts can be staged for review without being treated as published releases.
