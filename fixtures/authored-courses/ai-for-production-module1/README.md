# AI for Production — standalone Module 1

This snapshot preserves the separate one-module course published locally on
14 November 2026 after the creator explicitly confirmed review of revision 1.
The original seven-module draft and its learner editions were not changed.

- `course.json`: complete editable package, including both original-video bindings,
  four midpoint questions, three worked examples, four guided-practice steps,
  two scenarios, ten module-quiz questions, one ready-made guided project,
  ten final questions with an 80% threshold, and reflection.
- `brief.json`: saved two-objective brief, source library, module instructions and
  course System prompt. Recordings/transcripts were reviewed locally; no external
  transcription or generation service was used for this release.
- `M1S1.vtt` and `M1S2.vtt`: locally reviewed, timestamped captions.
- `release-manifest.json`: original source URLs, SHA-256 checksums, file sizes,
  measured durations, checkpoints and installation-specific release/asset IDs.

The original MP4s retain their embedded narration: 241.05 and 282.3 seconds.
Video binaries, database files, credentials, approval records and learner data
are not included in Git. The manifest is a media inventory, not a download cache.
Locally they remain under `apps/web/.data/concept-videos/<courseId>/<assetId>/`.

## Restoring to another installation

1. Create a separate course brief using `brief.json` and the normal creator flow.
2. Obtain the two original MP4s from the manifest URLs or a trusted local backup;
   verify their SHA-256 checksums before uploading. Do not substitute illustrated
   narration videos. Source availability is external and is not guaranteed.
3. Upload each recording to its matching source and review the accompanying VTT
   locally. Keep the module, topic, objective and source mappings. Use the new
   installation's asset/transcript IDs and measured checkpoint metadata.
4. Generate and review a matching current blueprint. Reconcile `course.json` with
   the new course's brief revision, blueprint ID and uploaded-video bindings.
   Preserve both exact objective wordings and all source-supported content.
5. Save the complete package through the revision-safe course-authoring workflow,
   review the exact saved revision and explicitly publish it. Importing these
   files never constitutes approval or automatic publication.

The original second recording overstates RAG accuracy and local security. Its
unaltered transcript is retained; learner-visible `sourceMedia.reviewNotes`
qualify those claims in both the uploaded and personalized player views.
Cases are fictional and do not authorize equipment operations. The project is a
read-only workflow learners run and explain; grading uses transparent length and
concept checks, not human semantic judgement or a learner proficiency score.

Verification sampled both original recordings in the learner browser with
unmuted, advancing playback; checked transcript/checkpoint bindings and private
byte-range delivery; checked 8/10 pass versus 7/10 fail and exact-set answers for
both assessments; and ran positive/negative guided-project checks. This is not
a claim of full-duration human listening or accessibility certification.
