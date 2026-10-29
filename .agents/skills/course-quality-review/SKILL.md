---
name: course-quality-review
description: Review an assembled editable LMS course for source support, objective alignment, teaching sequence, assessments, project feasibility, pacing and accessibility considerations. Return findings and a readiness recommendation; this skill does not author content, grant human approval or publish.
---

# Course Quality Review Skill

## 1. Purpose

Review an assembled course and return evidence-based corrections and a readiness recommendation for human review.

## 2. When to Use

Use for an independent course audit or the coordinator's assembled-course review. This skill reviews content; it does not author fixes, grant human approval or publish.

## 3. Inputs

Use the complete assembled package, current SME context/brief revision, audience brief, exact objectives, sources, constraints and package schema. For a focused edit, include the base package/version so unrelated content can be compared.

## 4. Instructions

Read [the shared workflow contract](../course-creation/references/workflow-contract.md). Review actual content rather than the coordinator's claim that it passed. Distinguish structural validation, semantic evidence, fetched research and human verification. Do not silently fix content, record human review checks, approve, publish, generate audio, save drafts or change learner records.

## 5. Workflow

1. Establish scope, current inputs and reviewable completeness.
2. Examine all dimensions below and record evidence for failures.
3. Assign each finding to its owning skill and set the recommendation.
4. Return the review without persistent changes; the coordinator handles corrections and its two-round limit.

- **Scope and evidence:** Current course/brief scope, exact objective wording, preserved source IDs, relevant source claims and citations, explicit assumptions, no invented facts or claimed tool successes. Distinguish structural source links, fetched research, and actual human verification.
- **Coverage and teaching:** Every objective is assigned, taught in narration/slides and assessed. Prerequisites and dependencies make sense. Hooks, explanations, worked reasoning, practice and transfer scenarios are coherent and follow the five-stage order.
- **Module/topic structure:** New courses contain 3-4 modules, each with 3-4 distinct concept topic videos, selected to suit the subject without filler. Every module follows its concept videos with worked examples, guided practice and a scenario lab. Focused edits preserve unrelated existing content and disclose structural mismatches rather than silently rebuilding approved courses.
- **Assessments:** Exactly two useful formative questions at each calculated midpoint, supported only by teaching through that slide; valid answer indices, plausible distractors, helpful feedback; complete final-objective coverage and the creator's pass rule. Require one end quiz after each module's Scenario Lab, covering all its taught topics/objectives. The single final assessment covers all course concepts/objectives, includes some genuine multiple-answer questions labelled Select all correct answers, and uses an explicit supported scoring policy. No Spaced Review.
- **Project and reflection:** One integrated practical project covers every taught concept topic and objective through connected tasks with numbered instructions, precise deliverables and observable grading criteria. Check the topic-to-task/evidence/criterion map and verify that all required building/editing, execution or simulation, testing, result inspection and submission happens in a sandbox inside the course without external practice environments. Distinguish actual sandbox capabilities from proposed controls, writing notes and unverified behavior; unsupported required actions block readiness. Separate automated grading from human rubric review, and do not treat a completion click as a graded artifact. Preserve project, Mastery Gate, then Reflection; reflection supports transfer without new assessment gates.
- **Option quality:** Correctness follows taught source evidence. All choices have similar length, detail and grammatical structure; the correct answer must not stand out as the longest or most qualified. Multiple-answer items have valid distinct answer indices and feedback for each choice.
- **Pacing and accessibility:** Concise visible text, complementary editable narration, clear language/instructions, stated accessibility needs and feasible time allocation. Separate narration estimates, activity time and measured media; do not certify accessibility or audio duration from scripts alone.
- **Video experience and duration:** Every video has a clear outcome, understandable examples, purposeful visual progression, a recap and clear transitions around its midpoint quiz. Require `plannedMinutes <= 7` and a credible narration-plus-visual budget at most 420 seconds, excluding quiz interaction time. Check script length at the stated natural speaking pace and budget pauses/transitions. If media exists, verify actual duration; otherwise label it unverified. Essential visuals need spoken explanation and any planned motion a comprehensible static/reduced-motion alternative; production notes must not imply implemented media or controls.
- **Package integrity:** Existing schema shape, globally unique content IDs, valid source/objective references and preserved unaffected content in a focused edit. When local code is available, run the existing package validator; otherwise disclose that local structural validation was not run. Inspect exact objective text and midpoint taught-content support separately because structural validation does not establish them.

## 6. Tools

Read supplied artifacts or use `get_course_context` and `get_course_draft` on the existing course-scoped MCP when needed. When local code is available, use `AuthoredCoursePackage` and `validateAuthoredCourse` for structural checks. Do not call `save_course_draft` or review/approval/publication write tools.

## 7. Validation

Apply every review dimension above. Inspect exact objective wording and semantic first-half question support separately from structural validation. Disclose checks that could not run. Missing/contradictory required evidence, invalid structure and unsupported assessments are blockers. A blocker-free result is eligible for draft saving and human review, never human-approved content.

Check module/video counts and the seven-minute playback limit explicitly: the existing package validator does not enforce these narrower authoring rules. Violations in newly authored courses require correction. Required module-end quizzes and multiple-answer questions must be supported by the actual package schema, player and grading path. Check module quizzes under `moduleQuiz`, multiple-answer keys under `selectionType: multiple` and `correctIndices`, and explicit or inherited module thresholds. Reject invalid keys, cross-module links, missing module coverage or custom scoring policies unsupported by the grader. Do not drop required assessments to make validation pass. An out-of-scope legacy structural mismatch is a disclosed limitation with a proposed scoped follow-up, not authorization to rewrite unrelated content.

## 8. Error Handling

For incomplete standalone context, identify uncheckable dimensions and return `needs_input`. Tool failures must be reported without claims of successful validation. Use `status: blocked` while review blockers remain. Normal pending human citation verification is a disclosed limitation, not proof of source accuracy or automatically an unfixable blocker. If blockers survive two coordinator correction rounds, return them without readiness claims.

## 9. Output Format

Return a `qualityReview` handoff with `content.recommendation` set to `ready_for_human_review` or `needs_revision`, a `checks` summary and `findings`. Each finding states `severity` (`blocker` or `recommendation`), affected target IDs, evidence/reason, a concrete correction, and `ownerSkill`. Route teaching issues to `lesson-generation`, assessment issues to `quiz-generation`, project issues to `mini-project-generation`, audience gaps to `learner-profiling`, and scope/assembly/reflection issues to `course-creation`.

Include the shared envelope's scope/version/target IDs, assumptions, unresolved questions and dependencies. A review-only request ends with findings and makes no persistent changes.
