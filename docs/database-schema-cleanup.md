# Database schema cleanup — 12 November 2026

The audit compared all 36 public tables against runtime code references and live
row counts. Only `project_work`, the retired Python code-and-run project store,
had no runtime readers/writers. It contained zero rows in the current PostgreSQL
database. The current workflow, authored sandbox and guided projects have their
own actively used tables.

Migration 0025 removes this empty retired table and its obsolete Drizzle mapping.
It takes an exclusive lock and rejects any installation containing historical
files. No `CASCADE` drop or automatic row deletion is used. On a nonempty older
installation, leave the data intact and explicitly export/archive it before
retrying; do not truncate it just to make migration pass. Earlier migrations and
their schema snapshots remain unchanged for reproducible upgrade history.

The other 35 tables remain. In particular:

- Empty `signals`, `step_progress`, `profile_drafts` and project tables support
  current learner features and must not be treated as unused storage.
- `adapted_content` still supports the non-Python adaptation path.
- `creator_codex_grants` preserves the existing course-scoped MCP connection.
- `scorm_topic_imports` and `imported_course_progress` support the original
  import/player path; connected imports have separate responsibilities.
- `professional_workspaces` and `platform_engagement` support optional features.
- Historical course revisions, reviews and editions are retained.

Test with `node --test scripts/tests/schema-cleanup.test.mjs`, then the workflow,
guided-project, project-sandbox, live and creator MCP backend regressions. The
cleanup guard is tested against both empty storage and historical learner files.

The 36-table ER diagrams are pre-cleanup snapshots and remain available as
historical exports. The active schema now has 35 tables after migration.
