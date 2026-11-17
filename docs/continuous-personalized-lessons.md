# Continuous personalized concepts — AI for Production

Only course `affcb1b6-5539-431c-9a95-cce2bdb26b51` opts into continuous
personalized concept playback. Other courses retain the scene player. Uploaded
original recordings and problem hooks are unchanged.

The existing concept endpoint returns an optional `playback` object containing
`kind: continuous`, one authenticated audio URL, measured `durationSeconds`,
`checkpointSeconds`, and ordered segments with scene IDs and start/end seconds.
These timestamps come from decoded PCM sample counts, not script estimates.

The server reuses the existing ready narration clips. Compatible 24 kHz mono
16-bit WAV samples concatenate losslessly; other valid formats normalize locally
with FFmpeg. No LLM, TTS or MP4 generation occurs. The combined file and timing
manifest are cached using enrollment, personalized revision, ordered clip hashes
and assembly version. Concurrent requests share preparation; temporary files are
renamed atomically. Missing/interrupted cache entries rebuild from the source
clips. Files stream through the existing owner-checked byte-range audio route.
An assembly failure returns a retryable error and keeps the original lesson
available. It does not mark a personalized revision failed or discard clips.

One audio element drives the entire HTML/CSS lesson. Visuals and captions follow
the global clock; section transitions do not reset time, swap audio or require
clicks. Scene counters, scene navigation and chapter cards are hidden. Playback
speed, pause, mute, captions, fullscreen, transcript and original access remain.

The player pauses at the reviewed first-half boundary. Until the midpoint check
is completed, seeks clamp to that timestamp and the later transcript remains
hidden. After the check, playback resumes from that point. Existing end checks
remain required. Played intervals are tracked separately from seeking; skipped
teaching is not credited merely because the audio reaches its end.

Resume storage advances to version 2: global seconds, checkpoint state, played
ranges and end-check completion. It retains the existing enrollment/revision
scope. When no v2 state exists, old scene-based state maps to that section's
measured start timestamp; completed scene evidence and checkpoint state carry
forward. It does not infer completion of an unrecorded end check.

Run `node tests/backend/run.mjs continuous-concept` for audio order/duration,
format normalization, concurrent/cache access, missing-file recovery, private
range streaming, course opt-in, resume migration, checkpoint gates and coverage.
Also run video-first/live regressions, TypeScript, lint and a production build.
