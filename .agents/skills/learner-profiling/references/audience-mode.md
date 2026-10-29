# Audience mode: authoring context

Use the provided frozen SME context or read it through `get_course_context` on the existing course-scoped MCP. Carry its actual course ID, brief revision, objective/source IDs and known draft version in the handoff. This mode does not read individual learner records.

Analyze the audience, prerequisites, outcomes, delivery context, dependencies, workplace contexts, known difficulties and explicitly supplied accessibility/practice constraints. Link each conclusion to the relevant SME field or source ID. Keep facts, assumptions, contradictions and missing information distinct. If accessibility information is absent, say it is unknown; do not infer a disability or learner preference.

Return `kind: audienceProfile` with `content` containing:

- `audienceSummary` and `prerequisites` supported by the brief.
- `learningNeeds`, `likelyMisconceptions` and `teachingRecommendations`, each with its evidence and stated uncertainty.
- `accessibilityAndDelivery` covering stated constraints and unknowns.

Use envelope assumptions, questions and dependencies for unresolved items. A misconception inferred from the task is a hypothesis, not an observed fact about learners. Recommend pacing, examples and scaffolding for the coordinator; do not invent module counts, assessments or a full course here.

Pass the result to `course-creation` when running the coordinated workflow. An audience-only request ends with this report and no persistent writes.
