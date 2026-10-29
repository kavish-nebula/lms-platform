# In-course sandbox authoring

Read this when authoring `courseEnd.miniProject.sandbox`. The authoritative schemas and interpreter are in `apps/web/src/lib/project-sandbox.ts`; cross-course coverage checks are in `apps/web/src/lib/authored-course.ts`.

The supported runtime is `data-workflow`: learners edit structured artifact fields and create ordered operations, then run them against synthetic inputs. This is a bounded simulation, not arbitrary JavaScript/Python, a terminal, live integration, physical practice or an execution container. If the course needs another runtime, report a capability blocker; do not label this runner as supporting it.

The optional `sandbox` property keeps legacy packages valid. Include it for newly authored practical projects and provide:

- `version: 1`, `runtime: "data-workflow"`.
- `instructions`: numbered learner instructions as an array of strings.
- `fields`: `{ id, label, help, starter }` entries for editable artifact fields. All values are strings. Do not put a full solution into the starter.
- `inputs`: `{ id, label, sample }` entries. Learners reference them as `input.id`.
- `starterSteps`: an array, usually empty or deliberately incomplete, of `{ id, output, operation, expression }` steps.
- `tests`: `{ id, label, inputs }` entries. Each inputs object supplies exactly the declared input IDs. Include differing normal/edge-case inputs to reject solutions hard-coded to the sample.
- `criteria`: `{ id, rubricIndex, weight, objectiveIds, sourceIds, videoIds, checks }` entries. Each rubric index appears exactly once; criteria collectively cover every course objective and concept video. Weight is 1-100 points per criterion; totals need not equal 100. Semantic concept application still requires human review.
- Each check is `{ testId, path, operator, expected? }`. Paths are `values.fieldId` or `output.outputName`. Operators: `equals`, `contains`, `notEmpty`, `numberAtLeast`, `numberAtMost`. Only `notEmpty` omits expected; numeric expected values must be finite. Every test contributes to grading. A criterion earns its weight only when all its checks pass.
- Optional creator-configured `passPercent`; if omitted all criteria are required. Interpreter errors always prevent passing. Do not invent a percentage to weaken required criteria.

Operations read `input.name`, `values.name`, or an earlier `output.name`:

| Operation | Expression |
| --- | --- |
| `copy`, `trim`, `uppercase`, `lowercase` | One value reference |
| `template` | Text with references in double braces, e.g. `Owner: {{values.owner}}; task: {{input.task}}` |
| `sum`, `multiply` | Comma-separated references to finite numeric strings |
| `fallback` | Two references separated by `|`; use the second when the first is blank |

Sandbox field/input/test/step/criterion IDs begin with a letter and contain letters, digits, hyphens or underscores, at most 60 characters; reserved object keys are forbidden. Existing objective/source/video references retain the course schema's ID format and 80-character limit. Use globally unique criterion IDs. The runner permits at most 40 artifact fields/inputs/steps, 20 test cases and 30 criteria, with at most 40 checks per criterion and 4,000 characters per value/expression/output. No network, filesystem, arbitrary code, external credentials or external practice environment is available.

The learner receives instructions, fields, sample inputs, test cases and criterion labels/weights, without server grading predicates. Run shows sample outputs/trace; Test evaluates without submission; Save persists a versioned draft; Submit recomputes grades from the current published definition and stores an immutable artifact/report. Draft edits invalidate the current report but retain submission history. Work is scoped to the enrolled learner and published revision; stale releases/tabs must reload without silently overwriting drafts. Successful submission is required for the sandbox's continue control. Existing courses without `sandbox` retain their historical project flow.
