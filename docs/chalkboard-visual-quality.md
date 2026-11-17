# Chalkboard visual quality audit and redesign

Audit before implementation (16 November 2026):
- The 76-second hook redraws 12 complete diagrams, but only three diagram signatures exist; nine redraws repeat a composition.
- Automation vs AI redraws 50 times but has only five signatures; 45 redraws repeat a composition.
- The shortest concept beat lasts two seconds. Draw animations consume much of that interval, leaving little reading time.
- Word-count-based sentence timing does not follow actual spoken words. Regex routing also loses the narrative's subject.
- Passing the old layout checker proves bounds/timing budgets, not semantic accuracy, visual variety or teaching quality.

Design selected before implementation:
1. One coherent visual per teaching chapter. Evolve objects and highlight evidence within it; never reset a completed composition for the next sentence.
2. Design purpose-specific scenes: an establishing illustration, a spreadsheet walkthrough, growing backlog, AI claim/evidence inspection, a cooling simulation, comparison, decision prompt, data exploration and layered system.
3. Align cue phrases to locally transcribed word timestamps. Fail to a review state on poor alignment; do not silently use word-count timing.
4. Animate one meaningful action at a time over roughly 0.8–1.4 seconds, with at least a readable hold and no rapid drawing of every glyph. Preserve original narration and checkpoint times.
5. Keep illustrations fictional and separate from source evidence. Use AI-generated art only where it teaches context; no repeating background collage and no illustrative numeric values presented as measurements.
6. Validate duplicate compositions, source cue ownership, monotonically ordered events, minimum readable holds, on-screen labels, actual frames and matching audio before releasing a render.

Research:
- Chalkboard upstream exposes word cues, segment clocks, calm-motion rules, holds, transformation moves, template layouts and sampled visual QA: https://github.com/nicglazkov/Chalkboard and pipeline/agents/manim_agent.py, pipeline/pacing.py, pipeline/tts/kokoro_tts.py at the pinned checkout.
- Manim ImageMobject supports local raster art, including an externally generated illustration: https://docs.manim.community/en/stable/reference/manim.mobject.types.image_mobject.ImageMobject.html . The selected nicglazkov project does not itself provide an image-generation provider; the other similarly named Chalkboard repository does. Keep these distinct.
- Remotion's frame-driven React compositions can combine illustrations, media and UI walkthroughs with synchronized audio: https://www.remotion.dev/docs/api and https://www.remotion.dev/docs/media/audio . The skill advises frame-driven animation rather than CSS animation.
- Small scale: Remotion Player/Studio is useful for interactive previews; Node renderMedia renders MP4s on a persistent host. Larger scale: queued independent renders/chunks and Lambda are available, with explicit concurrency and resource budgets: https://www.remotion.dev/docs/renderer/render-media and https://www.remotion.dev/docs/lambda . Neither renderer fixes a bad storyboard automatically.
- GCP: the official @remotion/cloudrun integration is alpha and not actively developed; prefer an ordinary containerized Node render worker if GCP is required: https://www.remotion.dev/docs/cloudrun . No cloud deployment is part of this change.
- Licensing: free eligibility is limited to individuals/companies up to three people; larger organizations need the applicable company license: https://www.remotion.dev/pricing . Do not label Remotion MIT or assume unlimited free production usage.

Decision: improve the current Chalkboard pipeline first. Keep the educational storyboard independent of the renderer so Remotion can later render richer interface/image scenes without replacing assessment or personalization. Do not add a second production rendering dependency solely to repeat the same visuals in React. A real Remotion preview/export comparison remains separate unless implemented and measured.

## Implemented revision: directed Chalkboard chapters

The renderer now treats an approved source clip as an evolving visual chapter,
not a trigger to redraw a generic diagram at every sentence. Source-specific
chapters use distinct compositions, including an illustrated finance setting,
claim-versus-evidence inspection, a clearly labelled production analogy,
mechanical conveyors, variable inputs, a sensor/condition/fan mechanism,
coolant ageing, learned patterns, layered control and human goal setting.

The visual-director system prompt and renderer-role contract live in
`apps/web/src/server/adapt/visual-director.ts`. A separate configured-provider
critique checks the proposed teaching. Deterministic checks additionally reject
wrong source order, repeated kinds/visual identities, invented numeric labels,
added Fahrenheit/Celsius units and inverted system-layer labels. A model review
is fallible: early candidates passed its critique but used a finance image for
a factory and added an unsupported F unit. The deterministic checks were added
because those observed failures must not depend on a model's self-assessment.

`chalkboard_alignment.py` transcribes existing audio locally with faster-whisper
base.en, matches recognized words to the immutable narration, and anchors visual
cues to those audio word times. Recognition does not replace the script. Source
coverage below 82%, unaligned cue phrases, crowded cues or insufficient final
holds stop a render. Closely packed cues can move to the spoken lead-in of the
same sentence; a redundant analogy badge may be omitted while preserving every
spoken word and its caption. These adjustments are recorded. There is no silent
fallback to proportional word-count timing. ASR timestamps are model-derived
estimates, not original TTS ground-truth timestamps.

One reveal runs about 0.95 seconds; a meaningful document-routing action runs
1.1 seconds. Existing objects remain visible and develop in place. Chapter
transitions wait until the new idea is spoken, even when that is after the start
of an arbitrary audio clip. No decorative animation loops or full-composition
replays are used. Original narration, quiz boundary, source checks and completion
requirements remain intact. The prototype's current short labels and diagrams
are still bounded scene components; it is not unrestricted AI-generated code.

The generated finance illustration is stored locally in
`apps/adaptive-api/chalkboard_assets/`, including the requested transparent PNG.
It is a fictional establishing asset, never source evidence. Its checksum is
part of the render cache identity. Model calls use approved narration and a
bounded field label, never credentials, assessment keys or full learner records.
Cached reviewed storyboards can run with `CHALKBOARD_DIRECTOR_ENABLED=false`;
a missing storyboard then returns a preparation failure and preserves original
lesson access. Native rendering receives no provider credentials.

Verification: the revised hook has five unique compositions and zero full-scene
replays, compared with 12 redraws/three signatures previously. Automation vs AI
has seven unique compositions and zero full-scene replays, compared with 50
redraws/five signatures. Minimum adjacent cue gaps are 3.36 and 3.44 seconds;
minimum matched-source word coverage is 95.65% and 99.05%. Frame contact sheets
were inspected alongside their aligned captions. Source-specific semantic
checks, local-alignment tests, enrollment isolation, existing player/assessment
regressions, TypeScript, lint and the production build are included in validation.

Remotion is now integrated with Manim for local production compositions. See
[hybrid video rendering](hybrid-video-rendering.md) for the current implementation,
failure recovery, validation evidence and deployment limitations. The historical
verification below describes the earlier Manim-only version.

### Local setup additions

Install the updated optional requirements (including the pinned Whisper/Pillow
compatibility versions), then download the public timing model once:

```powershell
apps/adaptive-api/.venv/Scripts/python.exe -m pip install -r apps/adaptive-api/requirements-chalkboard.txt
apps/adaptive-api/.venv/Scripts/python.exe -c "from faster_whisper import WhisperModel; WhisperModel('base.en', device='cpu', compute_type='int8', download_root='apps/web/.data/chalkboard-models')"
```

Audio analysis then runs offline; missing local model files fail clearly instead
of uploading learner audio. New local backup directories are
`.data/chalkboard-models`, `.data/chalkboard-alignment` and
`.data/chalkboard-storyboards`. Use `CHALKBOARD_DIRECTOR_ENABLED=false` when only
cached reviewed storyboards should be used. The existing configured LLM is used
for new storyboards and critique; render subprocesses never receive its key.

### Module 1 browser verification — 16 November 2026

Restarted the production stack with `.next-visual-director`. The previous running
build still served the earlier renderer. The current learner revisions required
new renders; their source technical narration matched the earlier reviewed
storyboards exactly. Finance bridge cues were checked locally and updated to
those revisions without uploading the newer personalized payload.

- Hook: 76.025 seconds, 5 unique compositions, 13 cues, minimum gap 3.36 seconds.
- Automation: 359.425 seconds, 7 unique compositions, 26 cues, minimum gap 3.32 seconds.
- LLMs: 401.75 seconds, 8 unique compositions, 30 cues, minimum gap 3.12 seconds.
- No full composition repeats within any of these lessons. This does not claim
  global uniqueness across courses or remove useful recurring diagram symbols.
- Complete audio tracks decoded successfully with nonzero signal. Browser
  samples played unmuted, with progressing media time and no media error.
- Sample frames from every composition were compared with aligned captions.
  Speech recognition provides approximate word timings, not human-certified alignment.
- Seeking beyond watched content was clamped. No quiz answers or completion
  submissions were made during verification. Full uninterrupted learner completion
  was not repeated in this check.
- Fixed unreliable LLM cue anchors and removed one crowded boundary cue while
  retaining the security clarification. Source claims about guaranteed RAG accuracy
  and local security remain subject to the existing explicit review cautions.

Local report: `outputs/chalkboard-module1-verification.json`; visual contact sheets:
`outputs/chalkboard-current-hook.jpg`, `outputs/chalkboard-current-automation.jpg`,
`outputs/chalkboard-current-llms.jpg`.
