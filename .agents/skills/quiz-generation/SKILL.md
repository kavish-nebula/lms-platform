---
name: quiz-generation
description: Generate or revise video midpoint checks, module-end quizzes and one comprehensive course-end final assessment, including clearly labelled multiple-answer questions. Use for assessment requests after teaching exists, not lesson generation or project rubrics.
---

# Quiz Generation Skill

## 1. Purpose

Create source-linked video midpoint checks, a quiz at the end of every module and one comprehensive final assessment (Mastery Gate), with editable answer keys, hints and explanations.

## 2. When to Use

Use for assessment generation or focused revisions after teaching exists, including single-answer and multiple-answer questions. Lesson teaching and project rubrics belong to their respective skills.

## 3. Inputs

Consume the current course context, exact objectives, source registry, completed teaching for every topic, module boundaries, checkpoint slots and actual target IDs. Final-gate requests require the creator-configured pass percentage; revisions need the current package/version. Inspect the current question schema and learner selection/grading capabilities before claiming an assessment can be saved or delivered.

## 4. Instructions

Read [the shared workflow contract](../course-creation/references/workflow-contract.md). Preserve stable IDs, unrelated assessments and the creator pass rule. Keep final assessment independent of individual profiling and adaptation. Keep the key, hint and feedback editable as authoring data; never expose them through individual profiling. Validation is not proof of learner mastery.

Keep three distinct assessment levels: two formative questions at each video's midpoint, one module-end quiz after that module's Scenario Lab, and exactly one final assessment after the course-end Mini Project. Module quizzes do not replace midpoint checks or the final assessment. Do not add Spaced Review.

## 5. Workflow

1. Scope requested midpoint checks, module quizzes and the final assessment; preserve unaffected items in focused edits.
2. Map all taught concepts/topics and objectives to questions. Use first-half teaching only for each video checkpoint, the complete module for its end quiz, and the entire course for the final assessment.
3. Author questions using the rules below. Choose enough questions for coverage rather than imposing an arbitrary fixed count on module/final assessments.
4. Check wording, answer keys, coverage and delivery compatibility. Return scoped fragments, coverage evidence and dependencies; flag unsupported assessment features rather than silently dropping them.

### Formative checkpoints

- For each requested video, create exactly two questions after its middle slide. Preserve its actual `videoId` and `afterSlideId`. Use only facts and objective/source links supported by slides up to and including that slide.
- If first-half teaching is insufficient, return a dependency to `lesson-generation`; do not fill the check with later material or trivia. Slide reordering requires recalculating the slot and checking both items again.
- Use stable question IDs, 2-5 choices, an explicit answer key, a useful hint, explanatory feedback, objective IDs and source IDs. Use plausible distractors based on identifiable misconceptions. Correctness must be supported by the sources, not formatting or answer position.

### Module-end quizzes

- Create one quiz for every module after its Scenario Lab. Cover all of that module's taught concept topics and objectives, including application where appropriate; do not assess content introduced only in a later module.
- Link each question to its module and taught sources/objectives. Include feedback explaining the answer and why plausible alternatives are wrong. Report topic coverage in handoff dependencies using actual module/video/question IDs.
- Do not invent a new module pass percentage: preserve an explicitly configured module threshold, otherwise inherit the creator-configured final percentage. The module quiz uses the existing gate stage and completion behavior; no separate progression policy is introduced.

### Course-end Mastery Gate

- Create exactly one final assessment covering all taught concept topics across every module and every supplied course objective. Build an explicit coverage map in handoff dependencies so no topic is omitted. One question may cover several concepts only when answering it actually requires them.
- Use a mix of single-answer and multiple-answer questions. Include some genuine multiple-answer items with at least two correct choices and at least one plausible incorrect choice; do not force multiple answers when the source supports only one. Application objectives should require a decision or application of evidence, not merely selecting the objective's wording.
- Keep the creator-configured integer `passPercent`. Preserve an existing pass rule on an edit; if missing, return a question to the coordinator rather than inventing a creator decision.
- Keep final assessment independent of individual profiling and performance-based adaptation. Formative checkpoints and module quizzes are not substitutes for the comprehensive final assessment.

### Question instructions and answer keys

- Clearly label single-answer items **Select one answer** and multiple-answer items **Select all correct answers** in the visible question instructions. Do not present a multiple-answer item as a single-choice question.
- Multiple-answer authoring fragments identify `selectionType: multiple` and distinct zero-based `correctIndices`; single-answer fragments use the supported single-answer representation and label. Include an explanation for every correct choice and each distractor.
- Use exact-set scoring for multiple-answer items: a response is correct only when it selects every correct choice and no incorrect choices. State this rule in the assessment instructions; the current player/grader supports it. Do not silently introduce partial credit. If the creator requests another scoring policy, flag the unsupported policy rather than changing scoring through content alone.
- Determine correctness from source evidence. Keep all options similar in length, detail and grammatical structure, including single-answer and multiple-answer items. Do not make the correct answer identifiable by being the longest, most detailed or most qualified choice. Revise wording to remove length cues without changing factual correctness or the answer key; do not pad distractors with irrelevant text.

## 6. Tools

Use supplied context or read `get_course_context` and `get_course_draft` through the existing course-scoped MCP. Do not call `save_course_draft`; only `course-creation` assembles and saves a requested course revision.

The current `schemaVersion: 1` package supports single-answer questions with numeric `correct` (optional `selectionType: single`) and multiple-answer questions with `selectionType: multiple` and `correctIndices`. Use exactly one key representation. Module quizzes persist under each module's `moduleQuiz` with `title`, `instructions`, `questions` and optional `passPercent`; an omitted module threshold inherits the creator-configured final percentage. Multiple-answer keys require at least two unique valid indices and at least one incorrect choice. Module/final grading uses server-selected released keys and exact-set scoring. Preserve the current MCP tools and package revision checks.

## 7. Validation

Verify exactly two first-half-supported questions at each calculated video midpoint; one end quiz per module covering every module topic/objective; and exactly one final assessment covering every course topic/objective with some valid multiple-answer items. Check unique IDs, sources, 2-5 choices, answer-index bounds, no duplicate multiple-answer indices, explicit selection labels, useful feedback and preserved final pass percentage. Check exact-set scoring expectations against delivery capabilities. Compare option lengths, detail and grammar to remove cues that reveal correct choices; preserve source correctness. No Spaced Review.

Validate supported fragments against the current schema separately from desired-design review. Schema success alone cannot prove topic coverage or multiple-answer/module-quiz support. Unsupported required features block complete-course readiness until schema, player, grading and relevant export/review paths can represent them.

## 8. Error Handling

If only a topic title or untaught objectives are available, return `needs_input` with the required teaching/evidence. Insufficient first-half material goes back to `lesson-generation`; never substitute later material. Missing pass rules go to the coordinator. Report MCP failures without claiming successful reads or saves.

If a topic cannot support a genuine multiple-answer item, use another suitable taught concept rather than fabricating a second correct answer. Missing required schema/player/grading support returns `status: blocked` with the authoring proposals and a concrete dependency assigned to `course-creation` for reporting; it is not permission to change app code or tools within a quiz-only request. If balancing option length would distort meaning, rewrite the choices or question while preserving the taught concept and source support.

## 9. Output Format

Return `quizContent` with scoped `content.midpointQuizzes` entries (`videoId`, `afterSlideId`, `questions`), `content.moduleQuizzes` entries (`moduleId`, title, instructions, optional creator-configured `passPercent`, questions), and `content.masteryGate` when in scope. Preserve the shared envelope, scope/version, assumptions and unresolved questions. Include topic/objective coverage and scoring/compatibility dependencies keyed to actual IDs.

These are intermediate authoring fragments: the coordinator maps each `moduleQuizzes` entry to the matching module's `moduleQuiz`, stripping the handoff-only `moduleId`, and merges midpoint checks and the final gate into their existing locations. Multiple-answer fields stay on the supported question shape. Never persist the handoff envelope or a top-level `moduleQuizzes` field. A focused checkpoint edit preserves module quizzes, the final check and unaffected checkpoints.
