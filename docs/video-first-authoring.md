# Video-first course creation

Concept teaching can now use uploaded recordings. Existing narrated-slide courses
keep their current player and audio. Original recordings stay unchanged. Enrolled
learners can also open a separate personalised concept video built from the reviewed
transcript, using the same illustrated HTML/CSS and narration approach as the hook.

## Creator flow

1. Save a course brief, add modules/topics and objectives in its source library.
2. Open **Module instructions and objectives** for each module. Set its objective
   mapping, included/excluded topics, prerequisites, earlier-module dependencies
   and teaching preferences. These are separate from SME evidence. Add source
   records with shared-course, module or topic scope and map their objectives.
3. Upload its concept video: MP4 with H.264 video, or WebM (VP8/VP9/AV1), up to
   250 MB and 420 seconds. FFmpeg checks the actual container, codec and duration.
   Use browser-supported audio codecs such as AAC for MP4 or Opus for WebM.
4. Generate a draft transcript through the configured Google AI service, or paste
   WebVTT. Correct the words and timestamps against the video. Confirm the review,
   then save the brief. A replacement video or edited transcript requires review
   again. Each source record holds one recording; add records for additional videos.
5. Choose a **Module workspace**, then click **Generate this module**. Every topic in that module must have a
   reviewed concept video. This creates a versioned module draft: problem hook,
   worked examples, guided practice, scenarios, two midpoint questions per video
   and an end quiz. Generation is synchronous with one bounded repair attempt;
   failures retain uploaded media and reviewed transcripts. Refreshing the page
   restores that module's latest draft. Later modules may have incomplete sources
   or unreviewed videos; they do not block a ready module. Course title, audience,
   outcomes, objectives and sequence still need to be supplied.
6. Review the draft and current blueprint/module decisions. In course assembly,
   **Merge current video module drafts** replaces only matching modules in an
   existing editable package. Other modules and course-end content are preserved.
   It does not save, approve or publish automatically. For a new course, use the
   existing `course-creation` MCP workflow to assemble these fragments with a
   guided mini project, comprehensive final assessment and reflection.
7. Save and review the complete package, then publish its exact approved revision.
   Video-first Stage 4 modules use this activity generator; the legacy slide
   generator refuses to replace their recordings.

## Prompt layers and module revisions

The SME course brief includes an optional **System prompt** textarea (12,000
characters) for creator-authored course-wide guidance. It is persisted separately
from technical source evidence and supplied to blueprint and video-first module
generation. Blank legacy values preserve existing module fingerprints; changing
the prompt marks affected generated modules outdated. The prompt does not replace
schema validation, source boundaries or human approval. MCP course context exposes
the saved field so prompt-based authors see the same creator instructions.

`lib/module-authoring.ts` owns the reusable, versioned shared system prompt.
Every generation request has the same core rules, followed by the selected
module's structured instructions, exact objectives, complete ordered course
outline and a separate source collection. Only shared course evidence and that
module's sources/transcripts are sent; other modules contribute outline context,
not raw teaching evidence. Source text and transcripts cannot override system
rules. A prerequisite must name an earlier module. Legacy briefs without module
instructions remain valid and infer objective mapping from module sources.

Each immutable fragment records `needs_review`, core/instruction versions,
instruction snapshot, selected model, source revisions/transcript IDs and an
input hash. Editing another module's sources or instructions does not invalidate
it. Editing its own evidence/instructions, shared evidence, relevant objectives,
course context/outline or shared prompt does. Older fragments without provenance
retain the conservative brief-revision check. Generation still checks the saved
brief revision both before the request and before saving, and never overwrites
another module, the assembled package or a published edition.

Review module drafts independently; generate drafts without requiring previous
modules to be approved first. Full source coverage and the existing course
blueprint, SME review, package validation and final publication gates remain
required for the assembled course. Mini project, final assessment and reflection
are assembled once at course end, never generated per module.

## Learner experience

The native HTML video player streams the original recording and its original
audio, with captions from the reviewed WebVTT, standard speed/fullscreen controls
and a readable transcript. It pauses at a reviewed cue boundary nearest the middle
(within 30–70% of duration), and exits video-only fullscreen so the questions can
be seen. Midpoint checks use existing formative feedback, retry and skip behavior.
After continuing, the recording resumes at that boundary. Reaching the end marks
the video complete through existing learner progress; module-end quizzes retain
server grading and exact-set multiple-answer scoring.

Supporting activities use interactive pages, not generated slide narration:
initial thinking for the hook, sequential worked reasoning/result, attempts/hints
and expected evidence for practice and scenarios. Practice responses are local
to the mounted activity and ungraded; their expected evidence is not an AI grade.
Assessment results and stage completion continue through existing persistence.
Changing a learner profile does not regenerate the original recording. It invalidates
the learner-specific concept revision for the next topic opening.

## Storage and integrity

Assets, immutable reviewed transcripts and generated module fragments live under
`apps/web/.data/concept-videos` (or `LMS_VIDEO_DIR`). Course briefs retain stable
source IDs/revisions and references to the asset and transcript. Final packages
add an optional `uploadedVideo` reference per concept video; existing package
versions remain valid. Two internal transcript parts satisfy the existing editable
package/evidence contract; learners see the recording, not these parts as slides.

Generation checks owner/course scope, reviewed transcript text, measured duration
and checkpoint against stored records. Package saving also binds the two transcript
parts and requires every uploaded source recording in its module. A changed brief
rejects late generation saves. Current published media is available to enrolled
learners; creators can preview their own assets. Media supports bounded HTTP range
requests for seeking, with private cache headers. No arbitrary uploaded code runs.
Access uses the app's existing shared demo identity until production authentication
is implemented.

Back up this media directory **alongside the database** when moving the app. It is
ignored by Git; a code push alone does not transfer uploaded recordings. Configure
deployment request limits to accommodate the chosen upload size. No cloud-storage
bucket or new database migration is required for this local implementation.

## Transcription configuration

`ffmpeg-static` supplies the platform binary for metadata probing and extracting
bounded mono MP3 audio. Install dependencies normally; keep its binary available
in the runtime deployment. Transcription uses `TRANSCRIPTION_PROVIDER=vertex` or
`gemini`; the default is Vertex when `GOOGLE_CLOUD_PROJECT` is set. Vertex uses
project/location and Application Default Credentials or
`GOOGLE_APPLICATION_CREDENTIALS`. Gemini uses the configured Google API key.
`TRANSCRIPTION_MODEL` can select an audio-capable Gemini model; otherwise a Gemini
LLM model is reused, with `gemini-3.5-flash` as the default. Missing credentials or
provider failure leave manual WebVTT review available. No silent provider switch.
The [Google audio-understanding documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/samples/googlegenaisdk-textgen-transcript-with-gcs-audio)
describes timestamped audio input; all generated transcripts still require human
review before use.

## Verification

Creator-only teaching drafts can be saved at
`POST /api/v1/content/courses/{id}/lesson-activities`, then opened from the course
brief's saved teaching activities panel. Each draft targets one module/topic,
preserves its source IDs/revisions and recording identities, and carries the
expected brief revision. It contains only a problem hook, worked examples and
guided practice. The preview separates attempts, optional hints and model
feedback; responses are local and ungraded. These fragments always need human
review, are marked outdated after a brief change, and cannot be published or
merged as complete video modules. Transcript review, complete module generation,
course assembly and approval remain required. Run
`node tests/backend/run.mjs lesson-activities` for ownership, stale-input,
source-scope and learner-record isolation checks.

Run `node tests/backend/run.mjs video-first` from `apps/web`. Tests use a real
FFmpeg-generated MP4 and isolated database/media storage. They cover upload and
codec checks, actual duration/audio extraction, captions, scope/access, HTTP ranges,
review/source binding, immutable recording bytes, generated module validation,
stale generation, package approval/publication and native delivery mapping. AI
responses use provider doubles; this does not verify live cloud transcription or
the factual quality of a generated course. Browser verification uses a separate
seeded database and confirms playback, midpoint feedback/resumption, completion,
interactive activities and creator upload/review/save.

## Profile-based learner delivery

Enrolled learners receive personalised framing and support for the hook, worked examples, guided practice and scenario lab through the existing adaptive service. Their recorded concept videos and all graded assessments remain fixed. Activity introduction audio matches the personalised text and does not disclose hidden expected evidence. Original activities remain usable while generation runs or fails; a started activity stays steady until reopened. Updating a profile or published revision invalidates its old activity jobs without changing course progress.

## Personalised concept delivery

With the adaptive service enabled, opening an uploaded concept queues only that
video's `concept:<videoId>` job in the interactive worker lane. The input contains
reviewed teaching, source/objective IDs and the existing profile/enrollment context;
assessment questions and answer keys are excluded. Source chunks never cross the
reviewed checkpoint. Reviewed scene narration is protected. The model supplies a short learner-context
explanation per scene plus concise titles and visual points. It cannot replace
source definitions or examples. Cosmetic title-only changes fail before speech. Planning caps narration at 910 words; the
server separately rejects measured total audio above 420 seconds.

A ready learner-specific script is paired with per-scene audio. The player offers
**Personalised video** and **Original recording**, captions, transcript, speed,
scene navigation and playback controls. Post-checkpoint scenes and transcript are
locked until the existing two-question formative check finishes. Existing answer
signals, video IDs and completion rules remain in use; every scene must finish
before personalized playback awards completion. Position/checkpoint state uses a
separate versioned browser key scoped to course, video and revision. No approved
content or learner grades are rewritten by generation.

Jobs deduplicate by enrollment, source/release, profile and concept prompt version.
Profile/release changes reject stale results, including after speech. Ready playback
stays steady while the topic is open. Original recordings remain available during
preparation, failure and previews; Retry explicitly requeues failed preparation.
Gemini speech can fall back to Kokoro when quota is exhausted, increasing first-run
latency. Completed script/audio pairs are cached rather than regenerated on refresh.

Validation covers source/phase mapping, numerical facts, lost teaching, superficial
rewrites, two-profile isolation, stale profiles, measured duration, and preservation
of uploaded recordings and quizzes. The browser smoke test exercises actual scene
playback and checkpoint locking. Review generated examples for teaching quality;
structural checks do not establish factual equivalence by themselves.

Transcription requests send `audioTimestamp` only to Vertex AI. Gemini API rejects
that Vertex-only setting with HTTP 400; Gemini transcription instead requests
numeric cue timestamps in the structured transcript prompt. Returned cues remain
unreviewed until their timing and spoken content have been checked.

Source review guidance is displayed above uploaded original recordings as well as
personalized and source-reference views. This keeps creator-supplied qualifications
visible when learners choose the original video, without rewriting its transcript.
