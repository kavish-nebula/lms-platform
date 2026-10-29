# Authored course snapshots

## Clean Data to Clear Decisions

`clean-data-to-clear-decisions.json` is the complete package created with all six
updated skills and published as revision 1 on 29 October 2026. Its companion
`clean-data-to-clear-decisions-brief.json` preserves the corrected saved brief
(brief revision 2). The user selected an 80% final-assessment pass mark.

The workflow produced an audience profile, course plan, lesson fragment,
assessment fragment, project fragment and quality review before the coordinator
saved the assembled package through the existing MCP. A pacing correction raised
the nine video budgets to 150 seconds each and rebalanced the 90-minute total.
The three modules each contain three distinct concept videos, two midpoint
questions per video, worked examples, guided practice, scenarios and a four-item
module quiz. The final assessment has twelve items, including three select-all
items. The integrated data-workflow project covers all nine objectives and topics
with nine required criteria across two changing-input cases.

Sources are fictional training references authored from the local sandbox
contract, not independent human SME evidence or company policy. The separate
release review records automated checks and this provenance. Structural validation,
exact objective wording, ID/source links, midpoint placement, timing estimates and
project coverage passed. The model project passed; the blank starter, missing
required fields, hard-coded sample outputs and invalid numeric inputs failed the
appropriate checks. Learner-side enrollment, video midpoint feedback, module
select-all grading and project Run/Test/Save were exercised. The sandbox returned
90/90 points across both cases. Course-skill, sandbox, authored-assessment and
publication regression suites passed.

All 36 narration clips finished rendering. The nine measured narration totals
range from 113.58 to 145.93 seconds (all below seven minutes), totaling about 1,160
seconds. The published course was also confirmed in the learner catalog.

Subsequent learner-player checks sampled every slide clip across all nine videos:
the visible clock advanced with unmuted playback, midpoint resume and pause/resume
worked, and no browser console errors appeared. All 36 released WAV responses
contained a non-silent signal, matched their saved files and current narration
fingerprints, and supported byte-range requests for seeking. These are technical
playback checks, not a full-duration listening or pronunciation review.

These snapshots do not seed or publish a database automatically. Use the same
revision-safe authoring workflow described below to apply them to a compatible
saved brief. Learner records, local database files and generated audio are excluded.
Some existing learner navigation labels still refer to the older handoff course;
the package's lessons, objectives, questions and sandbox are course-specific.

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
