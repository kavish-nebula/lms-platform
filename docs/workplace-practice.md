# Professional workplace practice

Workplace has been removed from the main application's navigation and dashboard at the user's request. The local configuration and example configuration disable `PROFESSIONAL_DEMO_ENABLED`; the page and API are unavailable. Existing workspace records and the additive migration are retained to avoid deleting saved data. The material below documents the archived demo implementation.

Enable `PROFESSIONAL_DEMO_ENABLED=true` in `apps/web/.env.local`, then restart the app. The feature lives at `/learn/workplace`, with a dashboard link and a Workplace entry in desktop navigation, mobile navigation drawer and search. With the flag off, the page/API return 404 and navigation entry is hidden. Existing courses do not require it.

## What the demo contains

Four optional 10–15 minute cases produce a decision record, agent brief, access/approval matrix and testing/readiness checklist. Every case has authored mechanical engineering, chemical engineering and general operations variants: twelve briefs in total. The first context is recommended from the saved profile; subsequent visits resume the most recently saved draft. The learner can switch context without changing their profile. Engineering cases concern fictional information workflows, never real process/equipment operation.

Save a draft before requesting coaching or submitting. Every section needs at least 20 characters for these actions. Coaching uses the existing LLM provider and a bounded 12-second request, with JSON validation. Without a provider or on failure it supplies authored self-review questions and retains the draft. Retrying can replace self-review with AI feedback. Feedback is advisory; it does not award a grade, credential or mastery. The UI hides feedback on unsaved edits; the backend rejects results when the saved revision has changed. Successful feedback is cached for that exact revision.

Submissions are immutable snapshots. A new draft revision does not alter an earlier submission or review. Private submissions stay out of Team preview. Sharing is explicit on submission; a team assignment requires that checkbox. Portfolio entries are Practised after submission, and Reviewed only when that submitted revision receives a demo manager review. Create revision starts a new draft; reviews never transfer automatically to it. Copy exports plain text; Export PDF opens the existing isolated browser-print document, with escaped text and a work-output title. The user selects Save as PDF.

Team preview contains three fictional colleagues plus the current demo learner. Their seeded examples are labelled Synthetic. A demo manager can assign a case/context with an optional target date, review a shared submission, request revision or mark it reviewed. Assignment state and concept coverage are derived from actual shared records. Private drafts, private submissions and AI feedback do not appear in the team interface. No email, invitation, public link or external integration is created.

## Storage and API

Migration `0007_professional_workspace` adds a per-user `professional_workspaces` row containing a version-1 document. Drafts, feedback, submissions, assignments and reviews are distinct collections. A workspace revision supports compare-and-set writes; draft revisions reject conflicting saves. The existing profile, enrollment, grades, adaptive signals, completion records and browser stores are never written by this service. Both PGlite and Postgres use the same migration and query path.

`GET /api/v1/professional-demo` returns `{ workspace }`. POST accepts a Zod-validated discriminated action:

| Action | Required input | Behavior |
| --- | --- | --- |
| `save` | caseId, domain, expectedRevision, fields | Saves/increments the draft; invalidates old feedback |
| `feedback` | caseId, domain, revision | Coaches the saved revision; returns workspace and feedback |
| `submit` | caseId, domain, revision, shared; optional assignmentId | Creates an immutable submission; repeat requests deduplicate |
| `assign` | caseId, domain, memberId, nullable dueDate | Assigns one of the four cases to a demo member |
| `review` | submissionId, decision (`revise`/`reviewed`), comment | Adds a review of a shared immutable submission |

Ownership always comes from `getSessionUser`, never a submitted user ID. The current application still has a shared demo identity: this is a sandbox owned by that demo user, not production authentication or organisation isolation. The Team preview tab is presentation, not role-based access. All data returned belongs to this sandbox. A production team deployment requires real identity, membership and manager permissions before enabling equivalent team workflows.

## Verification

From `apps/web`, run `node tests/backend/run.mjs workplace` for isolated in-memory tests. They cover all variants, owner scoping, conflicting saves, invalid inputs, provider failure, stale responses, sharing, assignment/review/revision flow, repeat submission, export escaping and unchanged course records. Run lint, type checking, `node --test apps/web/tests/learning-experience.test.cjs` from the root, and the production build.

Browser smoke test: save a fictional draft, reload to resume, request coaching, submit privately, verify absence in Team preview, create an assignment to the current demo learner, submit with sharing, review it, then create a revision. Check the old document and review remain intact. Test keyboard navigation, mobile wrapping and the browser print dialog. Test live AI only with synthetic case data in a separate `PGLITE_DIR`; never use real company documents for this demo.

### Implementation verification (22 October 2026)

The focused backend suite, 31 existing learning-experience checks, ESLint, TypeScript and the webpack production build passed. An isolated on-disk workspace completed live Gemini coaching, private submission, explicit assignment sharing, a revision request, an improved submission and manager review. A transient provider failure exercised the authored fallback before a successful retry. Native target-date capture, copy, keyboard focus and 390px practice/team layouts were checked in the browser. The print action and escaped print document are covered; saving a PDF from the system print dialog remains a user action.

Restarting the isolated process retained its complete workspace exactly. Read-only snapshots of the main learner's profile and enrollment records matched before and after the restart. Test practice records stayed in the separate smoke-test database.
