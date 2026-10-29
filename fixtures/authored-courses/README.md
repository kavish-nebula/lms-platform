# Authored course snapshots

## Clear Task Handoffs

`clear-task-handoffs.json` is the complete editable course package published as
revision 2 of **Clear Task Handoffs — MCP Setup Verification** on 29 October 2026.
It uses the existing `schemaVersion: 1` contract and brief revision 1.

The focused update preserves the original single-module lessons, stable content
IDs, sources, objectives, midpoint checks, final assessment and 80% pass rule. It
adds a six-question module quiz with single-answer and select-all questions, plus
one practical project in the in-course data-workflow sandbox. The project has nine
editable fields, three template steps, two test cases and five required criteria
worth 20 points each. Estimated course time is now 28 minutes.

This file is a portable authoring snapshot, not an automatic database seed. To
apply it to a compatible saved brief, use the `course-creation` workflow: read the
current context and draft, validate exact objective/source references and brief
revision, and save the complete package through `save_course_draft` using the
current package version. Review and publication remain separate existing steps.
Do not overwrite another course or bypass current revision checks. The snapshot
contains no learner records, credentials, approval records or generated audio.

### Verification

The package passed the existing course validator. Additional checks confirmed
unchanged teaching and IDs, exact objective wording, source references, module
coverage, and a passing project solution. Removing any required project field
fails its checks; hard-coding the conflict order fails the reversed-input case.

The running app was checked through the existing learner enrollment:

- Opening decision, video playback and both midpoint questions.
- Worked-example execution, guided-practice checkpoints and both scenarios.
- Module quiz: 5/6 passed at 80%; an incomplete select-all response received no
  credit.
- Sandbox: blank starter scored 0/100; completed work ran, passed both test cases,
  saved and survived reload, then submitted at 100/100 across all five criteria.
- Final assessment: 2/3 failed; a retry passed at 3/3.
- Reflection completed and a course credential appeared. Existing progress was
  preserved, including the newly completed module quiz. No browser console errors
  were observed during this walkthrough.

The legacy finale navigation still labels the project as four minutes; the
project instructions correctly budget about seven minutes. The existing final
and midpoint wording remains unchanged, including historical option-length
differences. Sandbox grading checks the stated facts, terms and generated outputs;
it does not assess every semantic nuance of free writing.
