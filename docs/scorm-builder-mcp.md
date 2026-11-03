# SCORM Builder MCP connection

The local Codex connection named `scorm-builder` launches `scripts/scorm-builder-mcp.mjs` over stdio. The bridge connects to the authenticated production endpoint at `https://scorm-builder-app-759854934093.asia-south1.run.app/mcp`.

Authenticate with the documented `npx nebula-scorm-auth login` flow. The bridge reads the API key from `~/.scorm-auth/credentials.json` (or `SCORM_AUTH_DIR`). Never copy the key into repository configuration, `.env.example`, logs or chat. Existing browser sign-in alone does not authenticate the MCP client.

The bridge exposes seven inspection tools: `list_courses`, `get_course_structure`, `list_topics`, `get_topic`, `list_releases`, `get_release`, and `list_concepts`. It forwards resource listing/reading for schemas and guidelines. Writes, builds, cloning and publication are not exposed. The authenticated upstream server continues enforcing ownership and role permissions.

Register on a new checkout, substituting the checkout's absolute path:

```powershell
codex mcp add scorm-builder -- node C:/lms-platform/scripts/scorm-builder-mcp.mjs
```

Restart/reload the Codex client if its current tool list has not refreshed. This does not require restarting the LMS.

## Schema observations verified on November 3, 2026

- Resources include `scorm://schemas/course`, `scorm://schemas/topic`, `scorm://schemas/quiz-question`, and `scorm://schemas/task-step`. These are descriptive JSON field models, not complete machine-enforceable JSON Schema documents; tool inputs separately provide JSON Schema.
- Courses use Firestore document IDs, distinct from names. Modules are identified by topic IDs such as `AIforProduction-M1-T1`; the topic schema says module numbers are encoded, not separate persisted module records.
- Topic teaching is nested under concepts/sub-concepts: Markdown, images, local/embed videos, audio files/transcripts, and chat/voice tutor context. The descriptive resource places objectives and task completion mode under `content`.
- The live topic response differs from that descriptive resource: M1-T1 returns `learning_objectives` at the topic root, while its `content` object contains task/assessment/media settings. The importer must normalize both documented and observed layouts and validate objective presence. It also returns video `durationSeconds`, which the descriptive topic schema omits.
- Questions use `mcq` with zero-based `correct_answer`, or `checkbox` with zero-based `correct_answers`. Concept quizzes and topic quizzes are separate.
- Tasks have concept-based unlock conditions and ordered steps, code, images, video, task pages and hints.
- The working `version`, workflow `status`, and published `current_version` are distinct. `get_topic` may also include `draft`, `has_draft` and draft assets; an importer must explicitly select and normalize its source revision.
- Live AI for Production structure returned one module and seven draft topics. M1-T1 returned no published releases. These are observations, not permanent constraints.
- M1-T1's observed working version was 173, `current_version` was null, `has_draft` was false, and its root contained three concepts. A draft workflow status does not imply that a separate `draft` object exists.

No source content, releases, learner records or approvals were changed during inspection. Schema snapshots and read results are stored only in the ignored `apps/web/.data/scorm-mcp-inspection` folder.
