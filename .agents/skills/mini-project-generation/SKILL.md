---
name: mini-project-generation
description: Design or revise one practical course-end project covering all taught concepts, completed in a sandbox inside the course, with clear instructions, deliverables and grading criteria. Use for the capstone project, not module practice, quizzes or publication.
---

# Mini Project Generation Skill

## 1. Purpose

Design exactly one practical project at the end of the course that combines all concepts taught across its modules. Learners complete the project in a sandbox running inside the course, using clear instructions, defined deliverables and observable grading criteria.

## 2. When to Use

Use for a new course-end practical project or a focused revision to its brief, sandbox requirements, deliverables or rubric. Module guided practice, quiz items, actual learner submissions and publication are outside this skill.

## 3. Inputs

Use the course context, audience brief, exact objectives, all completed lessons/concept topics, time budget and registered sources. Identify the available in-course sandbox capabilities, starter assets, supported learner actions, execution/simulation controls, output formats, draft persistence/reset behavior and evidence-checking capabilities. For revisions, use the existing project, stable target IDs and package version. Read available app/schema contracts before requesting information already present in the repository or course context.

## 4. Instructions

Read [the shared workflow contract](../course-creation/references/workflow-contract.md). Require only taught skills and available inputs. Preserve unrelated lessons, quizzes, pass rules and reflection. A rubric is not a learner proficiency score or proof of an external action; label fictional cases and unsupported assumptions.

- Include **one integrated practical project covering every taught concept topic and course objective**. Several connected tasks may contribute to one final deliverable; do not replace the project with disconnected quizzes or separate projects per module.
- The learner must build, edit, test or simulate the solution **inside the course sandbox**. Supply the starter state, sample data, tools and instructions there. Do not require an external website, account, paid service, local installation, terminal, real credentials or production system. For subjects involving physical or external processes, use a faithful in-course simulation and disclose what it cannot demonstrate.
- Keep every required step, test, result inspection and deliverable submission inside the course. Export may be optional; it cannot be required for completion. Use synthetic data and mocked integrations where appropriate; practice must not cause real external actions.
- A written description of a solution is not a substitute when the taught concept requires practical execution or simulation. Existing text notes alone do not demonstrate an executable sandbox, automated grading or a completed learner action.
- Use the current editable package schema and read [the sandbox authoring contract](references/sandbox-contract.md). Store supported runtime configuration in `miniProject.sandbox`, retaining the brief, deliverable, rubric and source/objective links. Use handoff dependencies for semantic coverage explanations, limitations and unsupported capabilities; do not invent runtime fields.

## 5. Workflow

1. Inventory every taught concept topic and objective across the course. Map each to an actual project task, expected learner evidence and grading criterion using stable module/video/objective/source IDs. A concept is covered only when the learner must apply it, not merely read its name.
2. Design one coherent practical challenge that combines that inventory. Size its connected tasks for the audience and budget; use only taught skills. Define the sandbox starter state, sample inputs and expected kinds of outputs, including relevant normal and failure cases.
3. Write numbered instructions: open the in-course sandbox, inspect starter materials, build or edit the artifact, run/test or simulate it, inspect results, revise, and submit the in-course deliverable. Name the actual available controls and expected evidence. If controls are only proposed, mark them as requirements rather than presenting them as existing UI.
4. Specify the deliverable precisely: what artifact(s) form the single submission, required contents, expected output/evidence and how they are retained or submitted inside the course. State what the learner must change from the starter state; avoid providing the complete solution as starter content.
5. Write observable grading criteria for correctness, application of each taught concept, completeness and relevant edge-case handling. Explain the evidence needed to meet each criterion and any supplied scoring/weight rules. Separate automated sandbox checks from criteria requiring a reviewer. Do not invent a pass percentage or claim automated evaluation exists when it does not; artifact grades are not inferred learner proficiency scores.
6. Write the editable `miniProject` using `title`, `brief`, `deliverable`, `rubric`, `objectiveIds`, `sourceIds` and the supported `sandbox` configuration. Author instructions, artifact fields, synthetic inputs, incomplete starter steps, differing test cases and weighted grading criteria with source/objective/video coverage. Map every rubric item one-to-one to a criterion. Keep unavailable capabilities and additional semantic coverage explanations in handoff dependencies.
7. Place the project after the last module and its quiz, before the final Mastery Gate and Reflection. Validate the design and actual sandbox compatibility; return only the project fragment and its dependencies. Module practice and scenarios remain separate.

## 6. Tools

A standalone request may use `get_course_context` and `get_course_draft` on the existing course-scoped MCP. Do not call `save_course_draft`, submit learner work, award completion, approve or publish. Requested saving goes through `course-creation`.

The course-scoped MCP reads course content and saves assembled drafts; learner execution/grading uses the app's existing course session, separate from MCP. Configured authored projects now have an in-course `data-workflow` sandbox supporting structured fields, bounded operations, synthetic test cases and server-computed rubric grades. Read the sandbox reference for exact capabilities. This does not support arbitrary code or every subject-specific simulation; report unsupported requirements. Existing courses without configuration retain writing notes and are not automatically upgraded. Do not implement new runtime kinds merely because this authoring skill is invoked.

## 7. Validation

Check all of the following before claiming readiness:

- Exactly one integrated project follows all modules/quizzes and precedes Mastery Gate and Reflection.
- Every taught concept topic and objective maps to a practical task, reviewable evidence and at least one grading criterion; no untaught dependency is introduced.
- Numbered instructions, supplied inputs, expected deliverables, revision/testing steps and grading criteria are unambiguous and fit the time budget.
- All required work runs inside the course sandbox without external accounts, installations, credentials, uploads to outside services or required exports.
- The actual sandbox supports the required editing/building, execution or simulation, result inspection, reset/retry and in-course evidence/submission behavior. If not exercised, disclose which checks remain unverified; do not claim an end-to-end sandbox pass from a content review alone.
- Grading criteria distinguish automated checks from human review, cover all concepts, cite sources/objectives and preserve any creator-supplied scoring policy. A visible completion button alone is not evidence that the artifact was graded.
- The persisted fragment matches `miniProject` including its supported `sandbox` schema; semantic coverage notes and unsupported runtime requirements remain handoff-only.

## 8. Error Handling

If feasibility depends on unavailable evidence or untaught skills, return `needs_input` and identify the owning skill. Do not invent policy requirements, paid-service dependencies or live actions to fill gaps. Report tool failures and unresolved prerequisites without claiming readiness.

If the in-course sandbox cannot perform the required project actions, return `status: blocked` with the proposed practical project and a concrete runtime/schema/workspace dependency for `course-creation` to report. Do not redirect learners to an outside environment or silently downgrade execution to written notes. If full concept coverage cannot fit the budget, identify the scope/time conflict and connected-task options without omitting concepts or creating multiple projects. Missing source/context information remains `needs_input`; an identified unsupported runtime capability is a blocker.

## 9. Output Format

Return the shared `miniProject` handoff with:

- `content.miniProject`: supported editable project fields and `sandbox` configuration, including practical instructions, deliverables, starter state, test cases and grading criteria.
- `dependencies`: a concept/objective-to-task/evidence/criterion map and an ID-targeted sandbox specification covering starter assets, required capabilities, learner actions, execution/simulation, expected outputs, checks, persistence, reset/retry and submission. Identify the responsible workflow and any capability gaps.
- `assumptions` and `unresolvedQuestions`: distinguish supplied facts, fictional case details, unverified sandbox behavior and missing creator decisions.
- `status`: `ready` only when the required content and sandbox support are established, `needs_input` for missing evidence, or `blocked` for known capability gaps.

A project-only edit preserves lessons, quizzes, pass rules and reflection. Saving an assembled course continues through `course-creation`; a project proposal is not a deployed sandbox, graded submission or completed course.
