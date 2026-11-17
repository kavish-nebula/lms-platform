# Personalized Chalkboard videos

Video-first personalized concepts and problem hooks now render to real MP4s with
the MIT-licensed nicglazkov/Chalkboard Manim runtime, pinned at
`4d7d62dcd2f324a9c1b22e133e4b232298fd2394`. The vendor license and provenance are
in `apps/adaptive-api/chalkboard_runtime/`. Legacy authored slide lessons keep
their existing player. Original recordings remain separately available.

The LMS owns educational content and assessment. It reuses validated Gemini
derivatives and existing matching Kokoro/other narration clips. Chalkboard's
scene base, segment clock, design tokens, components and layout checker render
the diagrams. Upstream's Claude research/script-writing agents are not run;
this avoids changing approved teaching or introducing another API key. No
learner content is uploaded to a video service by this rendering integration.

## Flow

1. Resolve the active enrollment, pinned source and current personalized job.
2. Preserve source narration, phase boundaries, source IDs and objective IDs.
3. Decode/normalize and concatenate existing clips. Measure PCM duration.
4. Compile sentences into a bounded visual grammar: rule routing, learned
   patterns, language-model token flow, retrieval, evidence checking and
   local/cloud boundaries. Profile context selects fictional administrative
   analogies. Literal source examples take precedence over a profession.
5. Render data with trusted Python scene code and the pinned Chalkboard runtime.
   Never execute model-generated Python or learner-supplied commands. The native
   process receives local files, not provider credentials. Render one job at a
   time per web process; status, manifest, error log and video live on disk.
6. Run layout/timing checks, mux matching audio, validate duration and atomically
   release `final.mp4`. Cache by renderer version, source derivative, storyboard
   and audio checksum under the enrollment. Concurrent identical requests share
   a filesystem lock. A failed render stays failed until explicitly retried;
   interrupted locks expire after 20 minutes.
7. Stream through the enrollment-authorized byte-range route. The continuous
   player uses one video clock, midpoint seek gate, original source checks,
   playback coverage, resume, speed, mute, captions, fullscreen and transcript.
   Seeking does not add watched coverage. No skip or grade is awarded by render.

The original baseline used proportional sentence cues. The current directed pipeline replaces those estimates with local audio word alignment; see docs/chalkboard-visual-quality.md. Historical baseline details: sentence cue positions within each clip
are estimated from word proportions, **not forced-aligned word timestamps**.
The manifest and render report state this. Precise phoneme/word alignment would
require stored TTS timestamps or an additional local aligner. Diagrams are
bounded teaching illustrations, not photorealistic footage or avatars.

## Prerequisites

Module 1's LLM topic recommends the earlier Automation vs AI foundation if no
recorded completion or diagnostic evidence covers it. It links back to that
topic; the learner can also use the existing independent knowledge check.
Unknown knowledge is never inferred from profession or years of experience.
This is a recommended route, not a new forced prerequisite or assessment waiver.
The existing pre-enrollment LLM/chatbot checks for the AI Agent course remain.
Broader topic dependency maps require reviewed authoring metadata.

## Setup

Use Python 3.12 and install the optional dependencies:

```powershell
apps/adaptive-api/.venv/Scripts/python.exe -m ensurepip
apps/adaptive-api/.venv/Scripts/python.exe -m pip install -r apps/adaptive-api/requirements-chalkboard.txt
```

The checked Windows configuration uses Manim 0.21.0, NumPy 2.2.6 and SciPy 1.15.3.
Newer NumPy native wheels were rejected by Windows application control on this
machine; no Windows security policy was changed. Non-math diagrams use native
Text and shapes, so Docker and LaTeX are unnecessary. FFmpeg is the app's existing
`ffmpeg-static` dependency. `CHALKBOARD_PYTHON` can select another Python install.
`CHALKBOARD_ENABLED=false` restores existing delivery; default is enabled.

Assets live at `apps/web/.data/chalkboard-video/<enrollment>/<module>/<hash>/`.
The directory is ignored by Git and must be included in full local backups.
Rendering requires a persistent Node/Python host; a short-lived serverless
deployment needs a durable external render worker before enabling this feature.

## Verification, 16 November 2026

AI for Production standalone Module 1 (`dd1fec93-8c51-4f2d-9e0c-943823062c76`):
Automation vs AI rendered at 1280x720/24 fps, 356.575 seconds, 50 visual beats in
72.69 seconds. Personalized Finance problem hook: 76.025 seconds, 12 beats in
18.31 seconds. These are measured render times on this machine, excluding prior
text/audio generation; cache hits reuse the files. Concept layout report passed
with zero violations and 50 cue events. Original course package and grades were
not rewritten.

Run `node tests/backend/run.mjs chalkboard` from `apps/web`. The suite verifies
source order, source IDs, concise diagram labels, Finance/Healthcare context,
prerequisite recommendations, caching, concurrent reads, failure fallback and
cross-enrollment denial. Native render and browser checks are separate from
mocked/cache tests. Existing continuous-concept, concept-slide, personalized
learning, video-first and profile-hook regressions also pass.

The second Module 1 concept, What are Large Language Models, also rendered:
401.875 seconds, 50 beats, 81.45 seconds rendering, zero layout violations.
Browser verification confirmed both MP4s decode at 1280x720 and advance with
unmuted audio, the concept midpoint pauses at 182.9 seconds, the case reaches
completion, and a refresh preserves the completed case's Continue action.
The current learner's recorded Automation vs AI diagnostic is recognized by
LLM prerequisite routing. Missing-evidence recommendations are covered by the
isolated tests. Authenticated MP4 ranges return 206; another enrollment path
returns 404. The live example uses the learner's currently saved Finance profile.
