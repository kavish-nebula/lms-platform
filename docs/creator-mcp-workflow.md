# Prompt-driven course authoring through MCP

Content Creator → **Create courses through prompts (MCP)** opens `/content/mcp`.
This is a separate owner-workspace connection at `/api/mcp/course-authoring`.
The existing `/api/mcp/ild-course-creator` endpoint, its three tools and all
existing course-scoped tokens remain unchanged. SCORM Builder remains read-only.

## Connect an agent

1. Open `/content/mcp` in the running LMS.
2. Create an eight-hour connection. By default it can create briefs and read/edit
   courses owned by the current creator. Optionally enable publication of an
   exact already human-approved revision. Existing tokens never gain this scope.
3. Copy the one-time token into `LMS_CREATOR_MCP_TOKEN` in the environment of the
   MCP client. Do not put it in Git or paste it into a conversation.
4. Add the endpoint to a Streamable HTTP MCP client. Codex configuration:

```toml
[mcp_servers.nebula_course_authoring]
url = "http://127.0.0.1:3000/api/mcp/course-authoring"
bearer_token_env_var = "LMS_CREATOR_MCP_TOKEN"
```

Use the actual reachable app origin if using a forwarded host. Restart/reload
the agent to discover the connection. Tokens are hashed in the database and
checked for expiry/revocation on every MCP request. The creator can revoke each
connection from this page. Token lists never return the raw secret.

The app still uses its existing local demo identity. These grants enforce that
identity's ownership, not production authentication or multi-tenant isolation.
Do not expose the creator UI publicly as an authenticated production service.

## Workflow

**Plan → create brief → read sources → generate complete draft → validate/save →
focused lesson/quiz edits → review findings → human approval → publish.**

The connected agent creates the text using its own model. MCP does not itself
generate teaching or run an invisible LLM job. It supplies trusted schemas,
source context and operations. Apply the six authoring skills' teaching rules
where available. Workspace tools take an explicit `courseId`; legacy
single-course tools obtain their ID from the token instead.

Example requests:

- “Plan an AI basics course for office staff using these expert notes. Use an
  80% final pass mark. Show the proposed plan before creating the draft.”
- “Create the accepted brief and save the complete course package.”
- “Improve lesson V1 in M1 while preserving the other lessons and assessments.”
- “Generate the Module 1 end quiz from the completed teaching.”
- “Review this course, report the remaining findings and give me its review link.”
- After reviewing and approving in the LMS: “Publish this approved revision.”

New-course guidance is 3–4 modules with 3–4 concept videos each, at most seven
minutes per video, exactly two first-half-supported midpoint questions, worked
examples, guided practice, scenario lab and module quiz. End with one in-course
guided project, comprehensive final and reflection. Preserve an existing course's
structure and pass mark when making a focused edit. Missing evidence is a blocker,
not permission to invent sources. Source-library courses retain their current
blueprint and SME module-review requirements. Use the existing creator screens
for uploaded media, transcript review, blueprint review and audio production.

## Tools, resources and prompts

Tools: `list_courses`, `create_course`, `update_course_brief`,
`get_course_context`, `get_course_draft`, `save_course_draft`, `save_lesson`,
`save_module_quiz`, `review_course`. Publication-enabled grants also expose
`publish_course`.

Resources: `lms://schemas/course-brief`, `lms://schemas/course-package`,
`lms://guides/course-authoring`. The schemas come from the app's actual Zod
contracts. Cross-reference, source and sequencing rules additionally run in the
existing package validator. JSON Schema alone cannot express every rule.

Prompts: `plan_course`, `generate_lessons`, `generate_quiz`, `review_course`,
`publish_approved_course`. Each accepts a `request` argument. Clients expose MCP
prompts differently; plain-English tool use works without slash-command support.

Only complete packages are persisted. Focused lesson/quiz edits require an
initial complete package; the server clones its latest version, replaces only
the target fragment, validates the whole package and appends a new revision.
Both the brief revision and package version are checked again during save.
Conflicts require reload and reconciliation, not blind retry or overwrite.

`review_course` is a structural check and review-status report. It cannot approve,
verify citations or claim narration exists. The creator inspects the exact saved
revision at `/content/courses/{courseId}/authoring` and records the existing
review checklist there. Editing after approval creates a new revision that
requires a new review. `publish_course` uses the existing locked publication
service; stale packages/reviews, missing approval and incorrect ownership fail.
Published editions and existing learner progress retain their existing behavior.

## Verification

`node tests/backend/run.mjs creator-mcp` uses an isolated database and exercises
real MCP initialize/tool/resource/prompt calls, course creation, invalid JSON,
complete saves, focused-edit preservation, stale revisions, ownership, token
hashing/expiry/revocation, separate legacy scopes and exact human-approval gates.
Its synthetic publication does not publish a live course or call a model.
