---
name: lesson-generation
description: Generate or revise source-linked LMS lesson and module teaching, including hooks, editable slides and narration, worked examples, guided practice and scenarios. Use for teaching-content requests, not quiz generation, course-end projects, individual profiling or complete-course saving.
---

# Lesson Generation Skill

## 1. Purpose

Create source-linked module teaching with editable slides/narration, worked reasoning, practice and transfer scenarios.

## 2. When to Use

Use for new lessons/modules or focused teaching-content revisions. Quiz items, course-end projects and complete-course saving belong to their respective skills.

## 3. Inputs

Use the supplied course context, audience brief, course plan, exact objectives, source registry, time budget and relevant module/video/slide IDs. For edits, include the current draft and package version.

## 4. Instructions

Read [the shared workflow contract](../course-creation/references/workflow-contract.md). Preserve stable IDs, exact objectives, source traceability and unaffected fields. Keep slide text concise and narration complementary/editable; distinguish estimated narration seconds from activity time and measured audio. Do not fabricate media or unsupported domain facts.

### Course and module structure

- For every newly authored course, design **3-4 modules**, choosing three or four according to the subject, objective coverage and complexity. Explain the choice in the handoff; do not add filler to reach a count.
- Each module contains **3-4 distinct concept topics**, each taught by its own video in `conceptExplainer.videos`. Choose three or four based on meaningful topic boundaries and prerequisites.
- Follow **Hook -> Concept videos -> Worked Examples -> Guided Practice -> Scenario Lab** in every module. Complete the concept videos before the module's worked examples, guided practice and scenario lab. Include all three applied stages in every module.
- After the Scenario Lab, hand off to `quiz-generation` for a module-end quiz covering that module's concepts. This quiz is separate from the five teaching stages and does not replace any video checkpoint.
- Every video includes one midpoint checkpoint containing exactly two formative questions, supplied by `quiz-generation`. Preserve that specialist's ownership; the lesson handoff supplies the slot and first-half teaching evidence.
- Each video's planned playback must be **no longer than 7 minutes (420 seconds)**, including narration and planned visual pauses/transitions. Learner-controlled quiz time is separate activity time and is excluded from this playback limit. Use shorter videos when the concept is clear; do not pad to seven minutes or speed up speech to fit.
- These are authoring requirements, not new runtime schema fields. A focused edit to an existing course preserves unrelated content and reports structural mismatches to `course-creation`; it does not silently restructure approved courses.

### Clear, engaging video experience

- Give each video one clear learning outcome, a short relevant problem, a logically sequenced explanation and a concise recap. Use plain language, define unfamiliar terms and connect abstract ideas to concrete audience-relevant examples.
- Create a purposeful visual progression using concise slides, step-by-step reveals, annotated examples, comparisons or process walkthroughs as appropriate to the subject. Explain what changes and why; avoid dense text, reading bullets verbatim or decorative motion that distracts from the concept.
- Apply that progression to the Hook, Worked Examples, Guided Practice and Scenario Lab too. A title card with narration is not a complete teaching sequence. Choose enough distinct scenes to show the situation, reasoning/action and result or feedback; two to four scenes is often useful, but each scene must add meaning. A short opening card can introduce a sequence, not substitute for it.
- In worked examples show the starting evidence, reasoned steps and checked result. In guided practice separate the learner attempt, optional scaffold and model feedback; pause for the attempt before revealing the model. In scenarios separate the context, learner decision and evidence-based debrief. Hook scenes establish the actual problem before revealing the lesson's explanation.
- Report the scene sequence for every stage, with the visual change, matching narration and any learner-controlled pause. Verify the rendered preview as well as the script: stage navigation must expose these scenes, narration must match the current scene, and a continuous preview must advance the visuals while preserving practice/checkpoint pauses. Flag a missing player capability as a dependency rather than calling a static card a finished video.
- Place the midpoint check at a natural pause and teach enough before it to support two useful questions. Make the transition into the check and back into the explanation clear.
- Keep narration and visible content understandable together: describe essential visual information, avoid meaning conveyed only by color/motion, and plan readable text and a transcript/caption path. Any proposed motion must have a comprehensible static/reduced-motion alternative. These are production requirements, not claims that media or player controls have been implemented.
- Use the existing editable slide/narration schema. Put optional visual/interaction production notes in handoff dependencies keyed to actual video/slide IDs, with the responsible production workflow; do not invent animation fields, embed HTML, generate media or claim working interactions from a script alone.

## 5. Workflow

1. Scope the requested modules, videos or slides. For a new course, confirm the plan has 3-4 modules and 3-4 topic videos in each module; choose the counts from the subject and objectives. Preserve existing IDs, source IDs and exact objectives. For a focused edit, return only changed teaching fields and explicit dependencies; leave quizzes, the project and other modules intact.
2. Create the teaching in order: `problemHook`, `conceptExplainer`, `workedExamples`, `guidedPractice`, `scenarioLab`. Use the exact nested shapes in the current course-package schema. In the hook, establish a source-supported problem; in examples, explain the reasoning and result before asking learners to practise; in practice/scenarios, provide actionable tasks, hints and observable evidence.
3. Produce editable slide titles/body and full complementary narration with the video experience above. Respect the audience, prerequisites and time budget. Set each video's `plannedMinutes` to no more than 7 and supply realistic slide `plannedNarrationSeconds`. Estimate narration at a natural, stated speaking pace and budget visual pauses/transitions within 420 seconds; carry that breakdown in the handoff dependencies, separately from quiz/activity minutes. Do not label estimates as measured audio. Do not fabricate voice clips or point at nonexistent audio.
4. Teach each assigned objective in at least one slide. Link every instructional item to the objective and source IDs it actually supports. Label fictional variations and flag unsupported domain claims for human review.
5. Identify the middle slide of each video using the shared formula. Return the checkpoint slots and the objective/source evidence taught through that slide as dependencies for `quiz-generation`. Initial teaching fragments omit `midpointQuiz`; no placeholder question is part of the final package. Reordering or changing first-half teaching flags the existing checkpoint for reevaluation.

## 6. Tools

Use `get_course_context` and `get_course_draft` on the existing course-scoped MCP when a standalone request needs current brief/draft context. Supplied frozen context can be used directly. Do not call `save_course_draft`; requested saving continues through `course-creation`.

## 7. Validation

Check the five teaching stages, exact schema fragment shapes, objective teaching, actual source support, unique/preserved target IDs, usable practice evidence and realistic pacing. Verify each midpoint slot and list what is taught through that slide. A fragment may omit quizzes; it must not claim complete-package validation.

For new courses, count 3-4 modules and 3-4 concept videos per module. Verify each video has a distinct topic, a clear explanation/visual progression, an evidence-supported midpoint slot, `plannedMinutes <= 7`, and a narration-plus-visual timing budget of at most 420 seconds. Check that timing is credible for the script at the stated pace and includes transitions/pauses. If generated media is supplied, check its actual playback duration; otherwise mark duration as estimated and actual playback as unverified. Confirm worked examples, guided practice and a scenario lab follow the concepts in every module. Review readability, accessibility and the transition around each quiz.

## 8. Error Handling

Return `needs_input` for missing scope, objectives or source evidence. Report failed context reads rather than inventing a ready-to-save course. Flag checkpoint reevaluation when slides change, and return unsupported claims or missing prerequisites as dependencies to their owning skill.

If a video exceeds seven minutes, tighten its explanation or rebalance the module's 3-4 topics without dropping required objectives. If the subject cannot fit 3-4 modules of 3-4 videos within the stated budget, return a scope/time conflict to `course-creation` with concrete options; do not silently exceed the limits, omit applied stages or add unsupported filler. Flag unavailable visual/player capabilities as production dependencies rather than claiming implementation.

## 9. Output Format

Return a `lessonContent` handoff whose `content.modules` contains ID-keyed teaching fragments. For complete modules, include module title, duration, objective/source IDs and the five teaching stages, with the documented temporary quiz omission. For a slide edit, identify its module/video/slide and include only the changed slide fields. Scenario challenges and expected evidence belong here; graded midpoint/final assessment items belong to `quiz-generation`.

Include the module/topic count rationale, per-video timing breakdown and midpoint teaching evidence in the shared handoff's assumptions/dependencies. Keep visual production notes outside the persisted package schema.

A lesson-only request ends with the fragment, assumptions and dependencies. An explicit save request continues through `course-creation` for complete-package assembly and review.
