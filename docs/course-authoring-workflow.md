# Course brief and scoped source library

The brief describes the entire course: title, audience, prerequisites, outcomes,
exact objectives, delivery context, topic dependencies and physical-practice needs.
New courses created in the editor use a separate source library. Module/topic
outlines are optional before planning; once declared, their IDs and order are
preserved in the blueprint and assembled package.

## Creator workflow

1. Save the course brief and evidence library. Add module/topic outline entries
   when the SME already knows the intended structure.
2. Resolve the preparation checks and source coverage report, then generate the
   instructional blueprint from the saved revision.
3. Review each blueprint module. Approved modules can enter teaching production:
   hooks, concept videos, worked examples, guided practice, scenarios, midpoint
   checks and a module-end quiz. Review scripts and verify generated narration.
4. Open **Assemble, review and publish**. Use the `course-creation` skill through
   the existing course-scoped MCP to assemble the complete package, including the
   guided project, comprehensive final assessment and reflection. MCP context
   includes the blueprint ID and current module teaching for reuse. Package
   assembly is still assisted authoring, not an automatic background merge.
5. Validate the complete package and its matching narration, record final human
   review, then publish the exact approved revision through the existing controls.

Library-backed packages must include a current `blueprintRunId`; all its module
reviews must be approved. Modules must match that blueprint, include end quizzes,
retain exact objective wording and cite evidence mapped to those objectives.
Independent specialist requests can still return fragments, but cannot save an
incomplete package or skip the assembled-course gates.

## Source records

Each record stores a stable ID, server-controlled revision, title, pasted evidence,
optional reference/URL, scope, module/topic target and objective IDs. URLs are not
fetched. Course sources can support all modules; module and topic records belong
to the selected module. Topic records must select a topic within that module.
Source IDs fit the existing blueprint/package ID contracts. Module/topic renames
do not change IDs. Source edits advance their revision when the brief is saved;
unchanged saves do not. The course brief revision and frozen blueprint input
bind all teaching to an exact source snapshot. Final package fields are unchanged:
source revision/scope metadata stays in the brief and specialist handoffs.

Coverage checks report empty evidence, URL-only evidence, unmapped or unknown
objectives, missing module/topic sources and invalid scope targets. Blueprint and
package validators reject citations from another module, including nested quiz
and slide citations. Declared topic evidence must be cited by its module.
These checks establish declared coverage, not factual truth, teaching quality or
human approval. The previous arbitrary three-Bloom-level input gate is removed;
the SME still chooses the appropriate cognitive level for each objective.

## Compatibility and storage

The optional `sourceLibrary` lives in the existing versioned brief JSON. No SQL
migration, new MCP tools or endpoint changes are needed. Legacy briefs retain
their raw text and paragraph IDs. **Convert notes to source library** copies those
paragraphs into editable records with the same IDs; the creator maps objectives
and scope before generation. The old text stays in history, while the library is
authoritative for subsequent generation. Hidden legacy duration/context/difficulty
notes are excluded from library-backed blueprint prompts. Existing published
courses, audio, reviews and learner progress are not migrated or republished.

Run `node tests/backend/run.mjs source-library` from `apps/web` for isolated
coverage, revision, workflow and stale-write tests. Provider responses are doubles;
these tests do not make paid generation requests or modify a live course.
