# Imported learning packages

AI for Production is available in the learner Courses catalog and command search. The supplied `AIforProduction-M1-T1.zip` is imported as Module 1, **Introduction to LLMs**, with its original three concept groups, ten sub-concepts, concept quizzes, five-question final assessment and two practical tasks. Further modules are not invented. Objectives are taken verbatim from the package.

`fixtures/imported-courses.json` registers the course, module identity, source ZIP checksum/revision, objectives, topics and source media URLs. The working package and vendored browser dependencies are under `apps/web/public/course-packages/ai-for-production/M1`. The original ZIP is unchanged. Local modifications replace remote library/media references and disconnect the original external notes backend. Original teaching text and grading rules are preserved. A host adapter also disables the source viewport-lock layout on audio pages: otherwise the quiz can collapse the audio card and prevent playback.

The native catalog/detail page links to `/learn/imported/ai-for-production/M1`. The course catalog can be browsed without a completed profile. This fixed package does not require the native personalization interview and is not sent through native slide generation. Native adaptive courses keep their existing behavior. The imported package's external AI tutoring and remote file-submission services are not connected; unavailable tutor controls are hidden. NotebookLM practical instructions are retained as supplied. This import does not create new native sandbox activities or grading rules.

## Playback and progress

The player loads the package in an opaque-origin sandbox, without `allow-same-origin`. `scorm-runtime.js` supplies the SCORM 2004 calls used by this package and scoped local/session storage. A frame-and-token checked postMessage bridge saves suspend data, location, quiz results and local notes to the authenticated user's `imported_course_progress` row (migration 0021). Rows are keyed by user, course, module and module revision. Updates are size-limited and writes are serialized. Existing learner data and native quiz/final grades are separate. SCORM-reported scores are client-reported package outcomes, not server-verified native assessment grades. This is compatibility for the supplied package, not certification of every SCORM sequencing feature.

Raw package documents also receive a CSP sandbox header. The embedded document restricts scripts, media and requests to the packaged assets/local app and registered media CDN; external tutor/submission backends are blocked. The host never passes a learner profile to the package. Anonymous package identity is separate from the server user key. Native learner reset also clears imported progress.

## Media

All ten WAV narration clips and both MP4s were checked and copied to `apps/web/.data/course-package-media/ai-for-production/M1`. The registered media endpoint streams files with byte-range support. Media is deliberately outside Git (one source MP4 exceeds GitHub's individual-file limit); public source URLs remain as fallback when a local copy is absent.

On another checkout, cache the source media before offline use:

```powershell
node scripts/cache-imported-course-media.mjs
```

Include `.data/course-package-media` and the main `.data/pglite` database in complete app transfers. The package's scripts, styles, fonts and supplied images are stored with the code; no remote CSS/JS libraries are required to read the lessons.

## Verification

- `node --test apps/web/tests/imported-course.test.cjs`: SCORM lifecycle, save/restore, notes, interaction counts and parent-message checks.
- From `apps/web`, `node tests/backend/run.mjs imported-course`: authenticated state scope, package-revision isolation, invalid writes, media registration and narration ranges, using an in-memory database.
- Production build and browser checks: catalog → course → launch, read/listen/watch, quiz navigation and resume after reload.

Windows root development commands now use Next.js's supported Webpack fallback after a recurring Turbopack HMR loop was reproduced. Production builds are unchanged. `LMS_DEV_BUNDLER=turbopack` opts back into Turbopack for diagnosis; `webpack` also works on other platforms.
