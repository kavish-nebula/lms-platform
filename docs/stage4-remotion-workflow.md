# Stage 4: approved SME sources to Remotion videos

After reviewing a module in Stage 3, open its Stage 4 production page. The
**Remotion video production** panel lists one problem-hook target and every
concept topic with supplied teaching evidence. This works before a complete
course package exists or is published. It reuses migration 0028's immutable
visual scripts and durable narration/export jobs; no new tables are required.

## Codex handoff

Connect an MCP client using the existing **Content Creator → Connect Codex**
configuration. The app supplies a copyable prompt and downloadable, owner-scoped
SME handoff. It does not automatically launch Codex or change its credentials.

The authenticated course-authoring MCP now exposes:

- `get_visual_module`: approved targets, scoped evidence, objectives, module
  instructions and shared system prompt.
- `get_visual_lesson`: current source identity, script versions and media jobs.
- `save_visual_lesson`: validated editable storyboard with optimistic versions.
- `prepare_visual_media`: matching local narration or optional MP4 export.

The contract is available at `lms://schemas/visual-lesson`. Use the repository
skill `.agents/skills/reference-style-course-video/SKILL.md` for reference-style
direction. The older course-scoped three-tool MCP remains unchanged.

Targets use `draft_<moduleId>_hook` and `draft_<topicId>`. Source identities
include the exact blueprint, latest approval, brief revision, selected evidence
and authoring context. Stage 3 revocation, changed input, ownership mismatch and
stale saves prevent new preparation. Save transactions lock the course and
recheck the current approval. Queued jobs also recheck their source before work.
Historical media is retained. Nothing here grants final approval or publishes.

## Reference and assets

The user supplied **WhatsApp Video 2026-11-17 at 11.10.22.mp4**, duration 220.067
seconds. The local reference review includes the complete timeline sampled at
two-second intervals in `outputs/reference-video-review`. Its reusable direction
is dark rose ambience, progressive documents, workspace demonstrations, journey
paths, highlights and reading holds. Medical/product claims in the reference are
not course evidence.

`apps/web/public/video-style/reference-ambient.jpg` is the clean 0.1-second
background frame extracted locally from that supplied video at 1280×720. It has
no product logo or patient document. Document screens, symbols, callouts and
journeys are recreated as code-native graphics populated with the course's
actual teaching. The flattened MP4 does not provide editable source assets.
No uploaded reference or learner profile is sent to an external model by this
workflow. Optional AI drafting explicitly uses the configured text provider;
Codex-authored drafts can be saved without that call.

## Playback and exports

`reference-cinema` is additive to the existing classic treatment. Every beat can
store an editable artifact heading, detail, icon and status. Compositions change
those artifacts at the corresponding measured narration start. Motion settles
after 2.4 seconds; section holds are normally three seconds. Reduced motion
settles immediately. Audio is measured local Kokoro PCM, never an estimate
labelled as measured. Scripts are limited to 850 words and media to 420 seconds.
Editing a script hides stale narration until its matching audio is ready.

Player and export use the same composition and timeline. The export bundles only
the small style asset folder, not the full public course-media library. Renderer
and asset fingerprints invalidate export caches when visuals change. The
existing authenticated range route serves narration and exports. Real original
recordings, learner editions, quizzes, grades and progress are unchanged.

## Checks

From `apps/web`, run `node tests/backend/run.mjs stage4-video`, `visual-lesson`
and `creator-mcp`, then `node --test video-renderer/visual-timeline.test.mjs`,
TypeScript, scoped ESLint and a production build. Live acceptance additionally
requires actual Kokoro preparation and normal-speed browser inspection of
successive beats, audio progression, captions and readable artifacts. MP4
readiness requires a successful real export and full decode, not a queued job.

## Live draft verification — 20 November 2026

For Everyday AI: Better Emails, Meetings and Decisions
(`f3332e82-2ac7-44cd-8fa2-69f9278e99df`), the creator had already approved all
three modules of brief revision 1 in Stage 3. Saved 12 reference-cinema scripts:
three hooks and nine concept lessons. All 67 local Kokoro clips are ready and
non-silent. Measured preview duration including visual holds ranges from 46.792
to 92.083 seconds. The saved SME brief is unchanged. The source/evidence and
duration report is `outputs/courses/everyday-ai/remotion-verification.json`.
These are narrated Player previews for creator review; this run does not claim
that all 12 have been exported to MP4 or published to learners.

## Published learner delivery — 20 November 2026

Subsequently assembled complete package revision 1 with the creator's selected
80% final pass mark, three module quizzes, eighteen midpoint questions, twelve
final items and one read-only guided exploration with nine explanation criteria.
All twelve MP4 exports completed and passed the renderer's full decode check.
The creator explicitly requested approval/publication; revision
`ce3c5b93-be62-4458-a343-833d475f4f9e` was approved and published.

Optional package `remotion` references bind the visual revision, narration job
and export job. Concepts retain exact editable beat transcripts and their two
midpoint items. Learner media is served through the enrolled learner's pinned
edition at `/api/v1/courses/:course/visual-lessons/:revision`, with `?media=1`
for seekable MP4. The continuous player preserves its playback coverage, seek
guard, quiz pause/resume and progress. Other courses' playback remains compatible.

The guided project runs supplied examples, not a live external AI model; grading
checks required runs, length and declared concept groups. It does not establish
expert semantic quality. Publication added no enrollments or learner progress.
Backend verification includes source/transcript binding, enrollment denial,
edition membership, byte ranges, server assessment grading and guided submissions.
