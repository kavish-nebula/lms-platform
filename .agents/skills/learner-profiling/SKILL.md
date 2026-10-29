---
name: learner-profiling
description: Analyze the intended audience for an LMS course or recommend teaching support for an individual learner. Use distinct audience and individual modes; individual profiling is advisory and uses explicitly supplied authorized context, not course-authoring MCP access to learner records.
---

# Learner Profiling Skill

## 1. Purpose

Analyze the intended course audience or recommend support for an individual learner using separate advisory modes.

## 2. When to Use

Use for SME audience analysis, a course-creation audience handoff, or support recommendations based on explicitly supplied, authorized individual learner context. Profiling alone does not initiate course generation.

## 3. Inputs

Audience mode needs the saved SME audience, prerequisites, objectives, workplace context, difficulties and accessibility/delivery constraints. Individual mode needs explicitly supplied authorized goals, stated experience, constraints and any demonstrated task evidence; no course connection is required.

## 4. Instructions

Read [the shared handoff contract](../course-creation/references/workflow-contract.md) for output structure, evidence rules and scope. Keep facts, assumptions, unknowns and demonstrated knowledge separate. Neither mode saves a course, updates learner records/progress, accesses answer keys for personalization, infers proficiency scores or confers mastery. Existing app profiling/adaptation services remain separate.

## 5. Workflow

1. Choose the mode before accessing data.
2. Read only the relevant mode reference and analyze its permitted inputs.
3. Return recommendations with evidence, assumptions and unresolved questions.

- For SME audience analysis or a course-creation handoff, read [audience mode](references/audience-mode.md).
- For an identified learner's supplied profile and support needs, read [individual mode](references/individual-mode.md).
- If both are requested, return two separately scoped results. If intent is unclear and the distinction affects what data would be read, ask which mode is intended.

## 6. Tools

In audience mode, use supplied frozen SME context or `get_course_context` on the existing course-scoped MCP; use `get_course_draft` only when draft context/version is relevant. In individual mode, use the explicitly supplied authorized context; the course MCP provides no individual learner access. Neither mode calls `save_course_draft` or learner-write tools.

## 7. Validation

Check that conclusions cite supplied evidence, accessibility needs are stated rather than inferred, and self-reported experience is not represented as demonstrated mastery. Ensure the selected mode and data scope match the request; return separate reports if both modes are requested.

## 8. Error Handling

If the mode is unclear and affects data access, ask which mode is intended. Return `needs_input` for missing authorized context or essential evidence; do not invent preferences, learner records or proficiency. Report MCP failures without substituting another course or unrelated learner API.

## 9. Output Format

Return the shared envelope with `kind: audienceProfile` or `kind: individualProfile` and the content fields defined in the selected mode reference. Carry actual scope/version/target IDs when known; individual-only scope can be null. Include assumptions, unresolved questions and dependencies. End an individual-only request with advice, not course generation or persistent writes.
