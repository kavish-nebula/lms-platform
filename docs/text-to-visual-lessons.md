# Text-to-visual lesson authoring

The original creator pilot starts with Automation vs AI in AI for Production. Published topics remain available from their source card. New courses can also open **Remotion video production** from a Stage 3-approved module's Stage 4 page, using its saved SME hook and topic sources before publication. See [Stage 4 workflow](stage4-remotion-workflow.md) for Codex/MCP handoff and the reference style.

## Workflow

1. Create the source-linked starter or ask the configured text model for a draft. Review the teaching quotations and all generated explanations.
2. Edit section titles, visualization recipes, narration beats and visible labels. Add, reorder or remove sections. Save an immutable script revision.
3. Prepare narration. Local Kokoro produces each short beat; unchanged text/voice clips are reused. Readiness requires valid mono 24 kHz PCM files. Actual clip durations determine the visual cue timeline, rounded up to video frames, with explicit reading holds between sections.
4. Preview with Remotion Player. Pause, seek, change playback speed, enable captions or reduced motion. Unsaved text always gets a silent visual preview; an older audio revision is never paired with changed text. Preview estimates are labelled until matching speech is ready.
5. Export the saved revision in the background. The renderer uses the same React composition, audio and timeline as the Player. A full FFmpeg decode must succeed before the MP4 becomes ready. Download it from the creator-only media route.

Six data-driven SVG treatments cover comparison, rules, learned patterns, exceptions, hybrid workflows and recap. Narration beats activate visual elements rather than filling the screen with paragraphs. These are bounded templates, not arbitrary generated JavaScript. A creator must check semantic alignment, label readability and pacing; exact source quotations alone do not certify correctness.

## Persistence and recovery

Migration 0028 adds creator_visual_lessons (immutable scripts, source fingerprint and version) and creator_visual_jobs (audio/export state, dependency and expiring claim). Saves require the expected script and brief versions. Source or publication changes block new media until reconciled. Audio identity includes voice configuration; exports include the renderer fingerprint and matching audio job.

Jobs run outside the response through Next after(). Separate process-local speech and export lanes bound concurrent work. Database claims and renewable leases prevent duplicate execution; reopening/refreshing the editor resumes queued or stale jobs after a restart. This local-server implementation is not a dedicated distributed render worker: deployment must allow long-lived Node jobs and retain the runtime files. Failed export leaves the script and ready narration intact. Explicit retries reuse valid assets and rebuild missing ones.

Back up the PostgreSQL database and apps/web/.data/visual-lessons together. Clips, manifests, exports and private diagnostic logs live there. The renderer bundle cache in .data/visual-lesson-bundles can be rebuilt. Neither directory belongs in Git. The optional LMS_VISUAL_LESSON_DIR override supports isolated tests.

## Access and publication

APIs under /api/v1/content/courses/:course/visual-lessons/:video verify creator ownership. Media is private, supports byte ranges and rejects unlisted filenames. The export child receives only trusted composition data, allowlisted local audio and a minimal environment without model credentials. The current application still uses its existing demo identity adapter; owner scoping is not a replacement for production authentication.

This pilot saves creator drafts and exports only. It does not replace recordings, publish a course, personalize a learner edition or change progress/grades. Existing learner delivery and assessment rules remain authoritative.

## Verification

Run node tests/backend/run.mjs visual-lesson from apps/web, then the video-first, authored-publication and continuous-concept suites sequentially. Also run TypeScript, scoped ESLint and a production build. Live acceptance requires preparing real Kokoro clips, playing the Player, editing and saving a revision without stale audio, exporting and decoding a real MP4, and checking the published course and learner records remain unchanged.

MP4 optimization: capture the first 1.5 seconds of animation plus its settled endpoint for each beat, then hold that frame until the next beat. The composition has no later animation during that interval. Ordered PCM samples are copied into a frame-aligned WAV with silence only for frame rounding and explicit reading holds; FFmpeg muxes that unchanged narration into the concatenated picture. Tests cover exact window coverage, PCM order and hold duration.

## Live pilot verification — 18 November 2026

Verified AI for Production (affcb1b6-5539-431c-9a95-cce2bdb26b51), Automation vs AI (V126c585975b6fb716df0). Saved three creator script revisions; the configured text model revised the draft in 4.9 seconds. Final narration has 18 measured beats and lasts 176.75 seconds including holds. Changing one beat reused 17 clips and prepared the remaining clip in 6.4 seconds. The optimized H.264/AAC MP4 contains 4,242 frames at 24 fps, 1280×720, and exported in 71.7 seconds on this machine. Its complete decode and non-silence check passed. These are local measurements, not latency guarantees.

Browser checks covered live Player audio/visual/caption progression, section seeking, pause/resume, 1.25× matching audio, caption toggling, reduced motion, silent unsaved previews, revision saving and the ready MP4 download. Direct exported MP4 playback decoded and advanced unmuted without media errors. Owner-scoped range delivery returned 206; download HEAD returned 200 and a revision-specific filename. Protected-table checksums for profiles, enrollments, step progress, publications and course editions were unchanged. The new visual job/revision tables contain only this creator pilot.

Text-to-visual backend tests, motion-window/PCM tests, video-first, authored-publication and continuous-concept regressions, TypeScript, scoped ESLint and the production build passed. The optimized export keeps settled visual frames between measured beat cues; it never speeds up narration. Published learner delivery remains unchanged pending a separate review/publication decision.
