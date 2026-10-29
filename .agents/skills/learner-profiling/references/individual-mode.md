# Individual mode: advisory support

Use only learner-profile context explicitly supplied and authorized for this task. This may be a provided profile export, the learner's own answers or explicitly supplied learning evidence. The course-scoped MCP exposes a creator brief and draft, not learner records; do not invent a profile-reading MCP tool, call unrelated learner APIs, inspect the database, or retrieve other learners to fill gaps.

If no authorized individual context is available, return `needs_input` and request the minimum relevant experience, goal and learning constraints. Do not guess the profile. No course connection is required for an individual-only report; scope/version fields can be `null`. If course material is supplied, separate its source facts from personal context and do not include final assessment questions or answer keys in recommendations.

Return `kind: individualProfile` with `content` containing:

- `statedContext`: the learner's stated goals, experience, preferences and needs, retaining unknowns.
- `demonstratedEvidence`: only task evidence actually supplied, with its provenance and limits; keep self-report separate.
- `supportRecommendations`: actionable suggestions for pacing, terminology, examples, scaffolding and accessibility based on that context.
- `clarificationQuestions`: only questions that could materially improve those recommendations.

Do not infer diagnoses, disabilities, scores, ranks or proficiency levels. Do not manufacture demonstrated mastery from a fluent answer, job title or stated experience. Do not disclose raw telemetry or private identity fields in the result when they are unnecessary for teaching recommendations.

This skill does not write to profiles, enrollments, learning plans or progress; does not change pass rules or assessment difficulty; and does not rewrite the approved master course. Its result is advisory and is not automatically fed into the course-authoring chain. End an individual-only request with the recommendations, not a call to `course-creation` or `save_course_draft`.
