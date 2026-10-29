---
name: course-creation
description: Plan, assemble, or revise a complete LMS course from a saved SME brief. Coordinates the profiling, lesson, quiz, mini-project, and quality-review skills and saves a complete editable draft through the existing course-scoped MCP. Use a specialist directly for a request limited to its content.
---

# Course Creation Skill

## 1. Purpose

Coordinate the six-skill authoring workflow to plan, assemble and save a complete editable LMS course from a saved SME brief.

## 2. When to Use

Use for a complete-course request, an assembled-course revision, or an explicit request to assemble and save specialist outputs. Use a specialist directly for a request limited to its content.

## 3. Inputs

Use the saved course brief and current draft: actual course ID, brief revision, package version, audience, prerequisites, exact objectives, sources, workplace context and constraints. Obtain the creator's time budget and pass rule where required; do not ask the user to repeat information already available through MCP.

## 4. Instructions

Read [the shared workflow contract](references/workflow-contract.md) before starting. It defines handoffs, ownership, source policy, revision checks, and the final package contract. Load each specialist's instructions when its stage is reached. Coordinate sequentially in this conversation; this is not an app background pipeline or permission to spawn agents.

Only this skill saves complete packages. Preserve stable IDs, unrelated content, exact objectives and creator-configured pass percentage. Human approval, publication, narration generation and learner-record changes are separate workflows.

## 5. Workflow

1. Call `get_course_context` and `get_course_draft` on the connected `lms-ild-course-creator` MCP server. Use its actual course scope, brief revision, source/objective IDs and latest package version. Do not invent a course ID. A missing or expired connection is an input/access problem, not permission to use another course.
2. Read [learner-profiling](../learner-profiling/SKILL.md) and run **audience mode** from the SME context. Individual learner records are not part of master course creation.
3. Produce a `coursePlan` handoff: course metadata, exact objective evidence, registered sources, ordered modules and dependencies, objective coverage, stable module/video/slide IDs, and a time budget separating playback from quiz/practice activities. For every new course, choose 3-4 modules and 3-4 distinct concept topic videos per module according to the subject, prerequisites and complexity; explain the counts without adding filler. Plan each video at no more than 7 minutes (420 seconds), including narration and visual pauses/transitions but excluding learner-controlled quiz time. Slide counts remain flexible. Include worked examples, guided practice and a scenario lab after each module's concepts. Reuse existing IDs and preserve unaffected content when revising; report structural mismatches rather than silently restructuring existing approved courses. Preserve an existing `passPercent`; if a new course has no creator-specified pass rule, obtain it before final saving.
4. Read [lesson-generation](../lesson-generation/SKILL.md) and obtain the module teaching fragments and their midpoint slots.
5. Read [quiz-generation](../quiz-generation/SKILL.md) and obtain exactly two formative questions per midpoint slot, one end quiz covering each module, and exactly one comprehensive final Mastery Gate covering all taught topics/objectives. Include some clearly labelled multiple-answer final questions. Questions must be based on completed teaching. Assemble each module quiz under its module's `moduleQuiz`; use `selectionType: multiple` with `correctIndices` for multiple-answer items. Preserve explicit module pass thresholds or inherit the final creator pass percentage when omitted. Read the shared assessment compatibility boundary before mapping handoff fields.
6. Read [mini-project-generation](../mini-project-generation/SKILL.md) and obtain one integrated practical project covering every taught concept topic and objective, with numbered instructions, precise in-course deliverables and observable grading criteria. Require the project to run inside the course sandbox without external practice environments. Check its topic-to-task/evidence/criterion map and actual sandbox capabilities; writing notes or a project brief alone do not establish executable sandbox support. Assemble supported configuration under `miniProject.sandbox`; the available runtime is the bounded data-workflow interpreter with criterion-linked test cases and server grading. Return known runtime gaps as blockers rather than silently substituting external work or omitting concepts.
7. Assemble a complete `schemaVersion: 1` package. Add course-end reflection prompts that help learners examine their decisions and transfer the learning. Merge each fragment only into its owned fields. Keep the module and course-end order in the shared contract. Do not send handoff envelopes, planning metadata, review reports, or individual profiles as package fields.
8. Read [course-quality-review](../course-quality-review/SKILL.md) and review the assembled package. Route each blocker to its owning skill, then reassemble and review. Allow at most **two automatic correction rounds** after the initial review. If blockers remain or evidence is unavailable, return the findings and unfinished work; do not save an incomplete package or claim readiness. Recommendations and pending human verification must be disclosed, not silently treated as verified facts.
9. Run the validation checks below before preparing the save.
10. Immediately before saving, re-read **both** course context and draft. Verify the brief revision and current package version still match the work. On change, reload and reconcile affected content and dependencies, preserving other edits; unresolved concurrent conflicts stop the save. Call `save_course_draft` with `expectedBriefRevision`, `expectedVersion`, and `packageJson` containing only the complete package. A rejected call is not a saved draft. Read back the resulting revision to confirm it.

For a focused revision, run only the responsible generators and their affected dependents, then quality-review the complete result. Changing slide order/content requires reassessing its checkpoint; changed objectives or sources require reassessing lessons, quizzes, project and reflection. Do not regenerate unaffected modules merely to assemble one edit.

## 6. Tools

Use the existing `lms-ild-course-creator` MCP server without changing its endpoint or authentication:

- `get_course_context`: read the current saved SME brief, course scope, objectives and sources at the start and immediately before saving.
- `get_course_draft`: read the latest package/version at the start, before applying focused edits, and immediately before saving.
- `save_course_draft`: save only the complete reviewed package using `expectedBriefRevision`, `expectedVersion` and `packageJson`; then read the draft back.

## 7. Validation

Validate against `AuthoredCoursePackage` and `validateAuthoredCourse` in the repository when local execution is available; disclose if local validation cannot run. Separately compare exact objective wording and semantic source support. Require all sections, unique stable IDs, valid links, five module teaching stages followed by a module-end quiz, exactly two first-half-supported midpoint questions per video, module and final topic/objective coverage, clearly labelled multiple-answer final questions, a feasible aligned project, reflection and the creator pass rule. Distinguish narration estimates from measured audio. Resolve review blockers before saving.

Apply the shared authoring limits separately from schema validation: new courses have 3-4 modules, each with 3-4 concept videos, every video has a credible playback budget no longer than seven minutes, and each module retains its three applied stages after concepts. Review clear language, purposeful visual progression and accessibility. The existing schema permits broader counts/durations; schema success alone does not establish these authoring requirements. Report scope/time conflicts instead of silently exceeding the limits.

## 8. Error Handling

For missing evidence, scope or pass rules, identify the minimum missing input and continue only independent work. On tool/access failure, report the failed operation without claiming success or switching courses. On stale brief/package versions, reload and reconcile affected content; unresolved conflicts stop the save. Allow at most two automatic correction rounds after the initial review; if blockers remain, return unsaved work and findings. Missing required skills/references are blockers. The package/player/grader supports module quizzes and exact-set multiple-answer questions. Unsupported custom scoring policies still block saving; return the concrete integration dependency rather than silently changing learner behavior.

## 9. Output Format

Return the actual saved revision and an editable-draft label, or clearly identify unsaved work and blockers. Only this skill calls `save_course_draft`; specialists return handoffs. Review approval, publication, narration generation and learner-record changes are separate existing workflows and are not performed by this authoring chain.

Use the shared handoff envelope for plans and intermediate outputs. Summarize saved course/version, validation and remaining human-review limitations, or identify the unsaved draft, blockers and required input.
