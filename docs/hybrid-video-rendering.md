# Remotion and Manim personalized videos

The personalized Chalkboard renderer now uses two local rendering engines. Manim
draws physical mechanisms, sensors and process diagrams. Remotion draws document,
spreadsheet, prompt, language-model and retrieval illustrations, then composes
the final MP4 with the existing personalized narration. Original recordings and
assessment rules remain separate and unchanged.

## Pipeline

1. Reuse the ready learner-specific narration and its ordered chapters.
2. Generate a structured storyboard with source-derived phrase anchors and a
   bounded visual catalog. Review findings must cite an actual source sentence
   and an actual visual label. Suggestions do not masquerade as factual blockers.
3. Align words locally with faster-whisper. Cue timing must have sufficient
   source coverage; a missing first word can use the first matched word within
   the same phrase. Related reveals in the same sentence may be co-introduced.
4. Render Manim chapters and hand the aligned timeline to Remotion. Explicit
   reveals follow their spoken cues; uncued structural parts of a diagram appear
   with its opening illustration. Conclusions still require their own cue.
5. Render short motion windows and hold their last frame during narration. Copy
   existing Manim frames instead of capturing them again in Chromium. Compose
   with FFmpeg and decode the entire output before marking it ready.

`apps/web/video-renderer/contract.json` owns renderer routing, resolution and fps.
The output is 1280x720 at 24 fps. The Node renderer serves only an allowlisted
Manim asset through a random, loopback-only URL; it never exposes the media folder.
Native render subprocesses receive no model-provider credentials.

## Failure recovery and privacy

- Native alignment/layout failures get one bounded storyboard repair attempt.
- Source-linked semantic blockers still reject the storyboard.
- A heartbeat and process-owner check recover stale render leases after crashes.
- Cache keys include enrollment, personalized revision, ordered audio and director
  version. Existing authenticated byte-range delivery enforces enrollment access.
- The queue is process-local, not a durable distributed worker. A later request
  recovers stale work; this is not a claim of multi-host orchestration.
- Original lessons remain available when preparation fails. Error messages identify
  the preparation stage without exposing provider responses or local paths.

## Setup

Run `npm install` for the pinned Remotion packages and use the existing Chalkboard
Python requirements, local timing model and FFmpeg setup. Chrome or Edge is
detected locally; `REMOTION_BROWSER_EXECUTABLE` can explicitly select the browser.
No additional narration provider is needed. Remotion licensing must be checked
for the intended organization/deployment before a broader commercial rollout.

## Verification, 16 November 2026

The standalone AI for Production Module 1 course
`dd1fec93-8c51-4f2d-9e0c-943823062c76` was regenerated using its existing Finance
personalization and narration:

| Lesson | Measured duration | Remotion chapters | Manim chapters |
| --- | ---: | ---: | ---: |
| Problem hook | 76.042 seconds | 4 | 1 |
| Automation vs AI | 356.000 seconds | 0 | 7 |
| What are Large Language Models | 414.917 seconds | 7 | 1 |

All outputs passed full-file decoding and duration checks. Decoded audio had
greater than 0.999 waveform correlation with the source WAVs. This verifies that
composition preserved the narration, not that speech recognition is perfect.
Local word-alignment coverage ranged from 83.49% to 95.65%; timing is approximate.
Chapter frame reviews inspect varied diagrams and readable holds. Useful symbols
may recur; no global uniqueness across courses is promised.

Relevant Chalkboard, continuous-player, concept-slide and video-first regressions,
Python alignment tests, timeline tests, TypeScript and production build passed.
Scoped lint passed. Repository-wide lint still reports existing unrelated errors
in imported SCORM assets and older components/tests.

Local verification artifacts: `outputs/hybrid-module1-verification.json` and
`outputs/hybrid-*-contact.jpg`. These contain learner-specific derivatives and
are not intended as public source assets. The seven-module edition and all other
learner profiles were not re-rendered as part of this check.

Browser verification sampled all three authenticated outputs with unmuted audio,
advancing playback time, matching captions and no media errors. The LLM sample
crossed the Manim-to-Remotion chapter boundary without resetting playback time.
Pause/resume, watched-position seeking, playback-speed changes, original recording
access and the Automation-before-LLM prerequisite link were checked. No assessment
answers or course-completion submissions were made. Fullscreen was unavailable
in the embedded verification browser; its existing fallback message appeared.

Final visual inspection also corrected missing structural layers, a misleading
outbound connector at the local/cloud boundary and misplaced language-model
labels. Generic model input, learned parameters and generated text are labeled
by their visual roles; authored keywords/model names remain separate caption
chips rather than being assigned to incorrect parts of the diagram.
