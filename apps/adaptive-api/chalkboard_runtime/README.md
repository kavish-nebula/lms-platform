# Pinned Chalkboard rendering runtime

The four `chalkboard_*.py` files are unmodified from
https://github.com/nicglazkov/Chalkboard at commit
`4d7d62dcd2f324a9c1b22e133e4b232298fd2394` (MIT; see LICENSE).

The LMS uses ChalkboardSceneBase, its measured segment clock, layout validation,
semantic tokens and ChalkBox components with Manim 0.21.0. It supplies a bounded
diagram scene rather than running upstream's Claude authoring agents. Existing
approved Gemini derivatives and Kokoro narration remain the teaching source.
No Anthropic key, third-party video upload, Docker daemon or LaTeX is required
for these non-mathematical diagrams. This is a render-runtime integration, not
an invocation of Chalkboard's full autonomous research/authoring pipeline.
