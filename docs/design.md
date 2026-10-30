# Learning experience UI

The authored capstone now embeds a practical project workspace when configured: numbered instructions and deliverable, editable artifact fields, ordered step cards with operation/output/expression controls, sample inputs and test cases, rubric weights, and Run/Test/Save/Submit actions. Output traces and criterion-level feedback are readable in place. Test feedback is labelled practice; only a passing recorded submission enables Continue. Edits clear stale results; reset/reload use explicit replacement dialogs and unsaved-navigation protection. Controls use existing semantic labels, fieldsets, focus styles and tokens; no motion is added. A full in-course workspace route is also available. Legacy projects keep their current UI.

Authored modules with a moduleQuiz show a final Quiz part after Scenario Lab in the existing course outline. The quiz shows its authored title/instructions and configured or inherited pass threshold. Questions explicitly say Select one answer or Select all correct answers; multi-answer choices use the existing accessible checkbox list. Multiple-answer midpoint overlays require an explicit Check answers action, retain selections until retry, and show hints on failure. Exact-set scoring is explained before summative quizzes. Creator previews show module question counts, select-all counts and pass percentages; exported decks include module quizzes and selection instructions. Existing courses without quizzes keep their previous presentation.

The creator's Codex connection guidance names `course-creation` as the entry point and explains that it coordinates five specialist skills. This copy change preserves the existing connection controls and learner interface.

Published authored courses reuse ProgramCard, CourseJourney, EnrollFlow, Player, HookCinema, VideoLesson, WorkedStage, GuidedStage, ScenarioStage and FinalePlayer from Build Your First AI Agent. The handoff course has the same journey staircase, outline navigation, video playback/captions/transcript/reader, midpoint checks, guided mission checkpoints and finale presentation. Its existing source content is rendered with definition, table, example and recap slide layouts. Course-specific journey and guided-practice copy removes Scout, Orbit and coding requirements from the handoff course while preserving the reference course's copy. Creator approval still exposes a separate publication control.

The marketing homepage omits the scrolling learning-methods ticker below the hero.

The shared Nebula mark uses the supplied logo image at `public/brand/nebula-mark.png`, including the sidebar and course branding. The adjacent wordmark uses the foreground ink for “Nebula” and the theme-aware, text-safe brand accent for “KnowLab”; full wordmarks use a 34px mark and compact marks remain 28px.

The course details page omits the How it works section and its section-navigation link.

The course details page also omits the Reviews section and its section-navigation link.

The course details page omits the personalized “Set up for you” summary panel. Completing enrollment opens course details without a one-time setup banner.

The course journey omits the Small wins that matter and Made for your next step panels. The dashboard omits Focus Session and Today’s study sessions; the course player also omits the Focus sprint timer.

The learner sidebar omits Reviews, Credentials and History on desktop and in the mobile menu. Their routes and search entries remain available.

The lesson header offers Show/Hide outline on desktop. Collapsing the current module sidebar gives the lesson more room; the display preference is stored per course in this browser and survives navigation. Narrow screens keep the existing outline drawer.

The updated course page leads with a mission, an Orbit Outdoor support-desk scene, and a six-chapter journey. Each chapter shows existing progress; the final course mini-project is shown once, before the final assessment. Original course details remain below this journey.

The lesson workspace adds a compact phase rail, a visible support explanation, and learner-controlled guidance. Concept pages are the narrated videos with their quick checks; a video restores its saved slide. Extra guidance opens a lesson introduction and key ideas; lighter support collapses the key ideas. Guided practice follows the selected module support.

Pip is the course assistant: a plain round badge with a chat mark (`components/learning/assistant-avatar.tsx`), in the accent colour, so a field palette recolours it. Thinking shows typing dots and other reactions a single soft pulse; both stop under reduced motion. It works offline.

Pip has one launcher in the bottom-right corner: a round chat button showing the assistant badge, without a label or additional message badge. The lesson toolbar and learning-tools dock do not repeat the Pip action; opening the character is the consistent entry point throughout the course.

Guidance uses a source-linked chat and current-step shortcuts. The notebook is course-specific and saved in this browser. Assessment screens show a clear independent-work message and process guidance while hiding explanatory history and notes.

Module 1 opens its Scenarios phase with the animated “The address switch” roleplay. Learners supervise Scout through five scenes with voiced first-person narration, acted choice previews, and visible Goal, Trust, and Safety consequences. Progress persists locally; existing scenario cases remain available as optional bonus practice. The roleplay and its media work offline and honor reduced-motion preferences.

Scenarios show one case at a time: inspect evidence, choose, commit, see the consequence, compare reasoning, and optionally retry. Choices persist. The mobile layout stacks these areas.

Rewards recognize completed practice. Asking for hints never reduces XP or stars. Existing mission progress is retained. The journey celebrates chapters practised, reflections saved, and reviews recalled, rather than displaying invented activity.

Guided practice is delivered as a six-phase mission: Understand, Configure, Connect, Test, Repair, and Launch. A single phase rail replaces competing progress maps, while each activity identifies its mission phase and the immediate technical task. The opening briefing uses a live incident, a compact pre-flight check, and a Scout build-status diagram. As the learner progresses, the diagram brings the workspace, secure connection, first response, memory, and field test online. Existing terminal, code, decision, and chat simulations remain the source of completion; the animation visualizes real progress and respects reduced-motion preferences.

An authored `solved_case` replaces that mission treatment when a module has a documented reference implementation. Module 1 uses Anthropic's published Customer Service Agent cookbook. Its guided practice identifies the original limitation, explains the completed architecture, walks through five implementation decisions with short code patterns, and ends with the notebook's recorded lookup and cancellation results. The source and its use of synthetic records remain visible throughout. This view omits fictional mission dialogue, XP, badges, branching scenarios, and decorative animation so attention stays on the existing problem and verified solution.

New styles live in `components/learning/learning.css`. Colours come from shared tokens, layouts collapse for mobile widths, controls have visible focus states, and hover motion is removed for reduced-motion preferences. Pip has no continuous bouncing animation or unsolicited popups, with one exception: the welcome tour below.

**Field palettes.** `<html data-accent="…">` swaps the accent family (`--accent`, `-ink`, `-deep`, `-soft`, `-line`) for IT, manufacturing, retail, finance, healthcare and education. Students and typed fields keep the brand indigo. Each palette is contrast-checked in both themes:
- text ink at least 5.6:1 on the light `--bg`, and 10:1 on the aurora `--bg`;
- white on `--accent-deep` at least 5.5:1.

The palette is set from the saved profile (`FieldAccentSync`) and stored in `lms-prefs`, so it applies before paint.

**Pip's interview** (`components/onboarding/interview-chat.tsx`, "About you" and a course's "This course" step) is a chat app, not a form:
- a chat panel with its own scroll, a header showing Pip's status ("Typing…", "Question 3 of about 8") and a progress line, and a composer pinned at the bottom (Skip, type your own answer, send);
- the current question is a highlighted card; its answers are numbered option cards in a two-column grid, picked by click or number key (1–9; Enter sends several);
- Pip's typing dots while the server writes the next question (`.typing-dots`, still under reduced motion);
- beside it on wide screens, "Your profile" (or "For this course") fills in answer by answer with a progress ring, the questions still to come as placeholders, and a note on what the answers change;
- "Start again" asks before clearing; the end card lists what Pip heard and the way on.
The server returns `progress` (answered, about how many remain) with every turn for the counters. The welcome card introduces the profile topics and offers the start button and time estimate; it does not show a course workflow demo before profiling.

**Pip's welcome tour.** The first time an enrolled learner opens a course page, Pip gives a three-stop tour: progress, the path, and Pip itself (`components/onboarding/pip-tour.tsx`, stops marked with `data-tour`).
- It dims the page, rings each stop, and moves focus into its card.
- Esc or "Skip tour" ends it, and it never returns on its own.
- Settings has "Replay Pip's tour", and `?tour=1` opens it on request.

## Browser acceptance checklist

1. Open the course page at desktop and 390px mobile widths in both themes; check overflow and focus outlines.
2. Sign in (try "Continue with Google"). With no profile yet, Pip's welcome chat opens first; finish it (try the number keys), then enroll through the "This course" and customise steps.
3. Open a concept lesson. Advance a slide, answer its quick check, then reload and confirm the saved slide.
4. Open Pip, ask a course question, follow its reference, save an explanation, and reopen the notebook after a reload. Ask an unrelated question and verify the scope response.
5. Change guidance, visit guided practice, and request a hint. Confirm the completed checkpoint earns the same XP.
6. Commit and revise scenario decisions; reload and confirm the chosen decision persists.
7. Fail a module quiz: the retry and remediation remain available, while the next module stays locked in the map, course outline, and direct URL. Retry and pass; the next module should unlock.
8. In the passed-quiz result, write a reflection and inspect the scheduled return visits. Practise a future review; its future date must remain scheduled. Request tomorrow's practice and confirm the updated date on the Reviews page.
9. On a desktop-height viewport, open a concept, guided practice, scenario and module quiz. Confirm the course header stays visible, the activity remains inside one focused workspace, and the page does not grow by one screen per action.
10. Switch guidance between Extra, Balanced and Light. Extra should reveal help earlier, Light should collapse optional evidence, and the same scenario and assessment content must remain available at every level.
9. Open the course mini-project and final assessment; verify order, assessment boundaries, keyboard access, and the absence of duplicate tutor launchers.

These browser checks were not completed in the Codex session: Windows denied the native path-resolution calls needed by the Next.js development server. TypeScript, source validation, logic tests, and server-render checks are separate from visual verification.

Module and lesson navigation uses concise display labels, one part number, completion state, and duration. Descriptive subtitles are removed from both ModuleMap variants and journey chapter cards. Full teaching content and narration remain intact; labels are centralized in `src/lib/course-labels.ts`.

The course journey now presents one connected game: one actionable daily mission, six Scout capability upgrades, three mastery stars per module, meaningful badges, and a single Launch Day final mission. Rewards use the existing theme tokens and real progress only. Locked upgrades remain understandable, completed modules use the success palette, and reduced-motion settings disable card movement. The course section omits the level, XP, day-streak and Sparks status panel and its rank-progress bar. Regular course-completion progress remains visible. Mobile layouts stack the mission CTA, capabilities and badges.
# Course player width and focus dock

The course player uses the available lesson width beside the module map. The Focus sprint timer and its reserved 270 px dock column have been removed on every screen size.

Concept lessons use two sibling surfaces instead of one enclosing lesson card. The first box contains the lesson heading and complete media experience: slide, caption, progress, playback controls, and transcript. The second box contains adaptive guidance, field-specific examples, and key ideas. A separate action bar follows both boxes. This keeps the video and related reading visually independent while preserving a natural top-to-bottom order on every screen size.

Visual Story mode turns authored concept slides into focused scenes with touch, keyboard, swipe, and marker navigation. It retains lesson audio, captions, checks, saved position, and completion rules.

Pip uses the updated illustrated mascot and gives brief, phase-aware nudges and reactions to learner actions. Reactions respect reduced-motion preferences.

The landing page omits the Method section and its course finale cards. Its navigation and footer omit Method, and the hero offers the primary sign-in action without a See the method link.

The landing page ends with a full-width contact footer, replacing the former CTA band and boxed footer, using the supplied Nebula reference layout: brand and Dispatch email request, Explore and Company columns, email/phone/hours/address, copyright, social labels, and a WhatsApp contact button. Footer colors follow the existing theme tokens: panel background, muted text, subtle borders, and indigo accent buttons and icons. There is no separate green palette. Columns stack on mobile and interactive controls have visible focus outlines. Newsletter requests open an email draft; no subscription is claimed. Destinations without supplied URLs remain disabled labels until configured.

Sign-in options appear in this order: email entry and Continue with email, Continue with Google, then company SSO. Dividers separate each sign-in method.

Enrolled lesson pages omit the Tuned for you row, story/field/analogy/support chips, and its Edit setup link. Personalized content still renders normally. When the module outline is hidden, its standalone Show outline button remains above the lesson on wide screens. Unenrolled previews retain their setup invitation.

My Assistant's My notes tab offers Export to PDF beside the notes label, disabled for blank notes. It opens the browser print dialog with a separate A4 document containing the course title, export date, and notes; choose Save as PDF. The print view uses dark text on white paper, preserves line breaks, wraps long text, and omits application chrome. Export stays entirely in the browser.

## Adaptive teaching controls

The optional Python teaching pilot adds **Simplify** and **Give an example** beside the concept player. They reuse the existing Button primitives and design tokens. While a revision is preparing, the request controls and play control are disabled, and a polite status message describes progress. Text and matching narration change together; paused playback stays paused. A 20-second deadline restores the ability to resume or retry. Navigation cancels adoption of the pending response. This adds no motion; existing reduced-motion and caption preferences continue to apply. See [adaptive-teaching.md](adaptive-teaching.md).
Profiling and course-enrollment chats expose a keyboard-accessible **Something else — type my answer** button beneath each question's suggestions, including multi-select questions. It focuses the labelled composer without submitting a placeholder answer. The composer remains available directly, accepts 200 characters (80 for the initial field), and the learner's wording appears in the chat and profile summary.
The marketing landing page omits the “For teams” section and its cohort analytics preview. Its matching navigation anchor is removed; the learning principles section leads directly into the FAQ.

The dashboard and learning plan omit the scrolling “Up next” ticker. The enrolled dashboard begins with the resume card; the learning plan begins with its summary tiles.

The optional Workplace section uses a case rail, an authored brief beside a structured working draft, and separate portfolio/team views. It reuses existing type, surface and accent tokens without decorative animation. Context recommendations, saved revisions, private/shared submissions and synthetic colleagues are labelled explicitly. The case rail and brief/editor stack on small screens; all controls have visible keyboard focus. The team preview displays evidence coverage and review status rather than ranks or proficiency scores.
# Course reader

The reader now opens in presentation mode by default: a 16:9 course slide, chapter sidebar, slide strip, speaker notes and previous/next slide controls. It reuses the existing HTML slide layouts, icon system and narration clips for a consistent presentation across the entire AI-agent course. Article and book are optional modes.

The optional AI-agent article reader follows a chapter catalogue / reading column / section-outline layout with a fixed bottom tool strip. Book mode uses facing pages, restrained page edges, clear pagination and the same type scale and theme tokens. Mobile layouts stack the pages and place contents in an accessible drawer. Text size and native narration controls support extended reading; no page-turn animation is required. Reading completion is labelled separately from assessment completion.

The course assistant composer uses a compact rounded message bar with a text-file action, message input, microphone and dictation-language selector. An empty draft shows a read-aloud waveform button; typing reveals Send. Controls have accessible names, keyboard focus outlines, and a live status region. No new motion is introduced.

The hidden assistant launcher wrapper ignores pointer events while the assistant panel is open, preventing it from covering the message bar's right-side controls.

Quick enrollment presents the saved field/role, coding and explanation preferences with an Edit profile link, followed by exactly two optional radio groups. Each offers a typed answer and Skip this question. Start learning submits the selections directly; Start with the standard course skips both optional answers while retaining profile-based examples. Additional setup is an optional link. Semantic fieldsets, labels and existing focus/reduced-motion patterns are reused.

## Content Creator Studio

The Stage 4 pilot uses a slide list, existing slide preview, structured content/narration fields and explicit save. Mobile stacks these areas; stable IDs and source/objective checkboxes prevent hidden remapping. Six layout choices reuse fixed renderer templates. Activity notes and timing stay separate from the narration estimate. Unresolved issues are visible, script review is disabled for unsaved/historical content, and all source/approval provenance is shown. Audio is consistently labelled deferred. Existing focus, reduced-motion and unsaved-navigation patterns apply.

Stage 3 places module review cards beneath an approval/changes/pending summary. Each card offers expandable evidence, seven labelled checkbox criteria, an explicit decision selector, feedback and priority. Approval is never preselected or inferred by AI. Per-module saves retain feedback after errors; version conflicts require an explicit reload. An outdated banner disables new decisions, while the history stays readable. Shared unsaved-navigation protection is reused for the SME input editor and review workspace; no new motion is introduced.

The Stage 2 page provides explicit generation controls, saved-revision provenance, running/failed/ready status, retry, history selection and a JSON download. Seven readable sections show the ILD report, module structure, tasks, assessments, motivation, tools and accessibility. Expandable source snapshots make source IDs auditable. Outdated results carry a banner; AI output is labelled pending SME review. It introduces no animation and reuses token-based forms, panels, focus and live-status patterns.

The creator workspace reuses AppShell, the role menu, token-based panel/line/brand styles, Button, Input and Textarea. `/content` presents draft cards, an eight-stage ILD board and a labelled roadmap. The editor pairs a single-column brief form with a readiness sidebar on wide screens; it stacks on narrow screens. Fields use persistent labels and descriptive hints. Save feedback is announced, errors retain text, and all actions support keyboard focus. No new animations are introduced; the existing reduced-motion shell remains in use. Readiness is labelled automated completeness, not expert approval. The local-demo banner distinguishes view switching from authentication. See [creator documentation](content-creator.md).

The Stage 4 audio panel follows explicit script review, with approval prerequisites, clip progress, separate spoken duration, historical status, a labelled slide selector and native keyboard-accessible audio controls. Playback never starts automatically. Unsaved edits disable playback to avoid presenting an old clip as matching new text.

Long-form Stage 4 exposes a module readiness summary, separate plan/video navigation, editable outlines, activity fields and creator-only rehearsals. Incorrect quiz choices show a hint on the same question and preserve earlier answers. Video scripts display word counts separately from measured clip duration; short audio never appears ready. Native audio controls do not autoplay. Unsaved edits retain navigation protection, and historical plans/videos are read only.

Long-form production audio includes the existing slide renderer beside the matching clip and transcript. A deliberate Play video action starts continuous creator rehearsal; there is no initial autoplay. Slide selection, pause and native audio controls are keyboard accessible. Missing, historical or unsaved media cannot start current-video continuous playback.

Course delivery structure v1: creator courses can opt into a separately persisted six-stage module sequence (Problem Hook → Concept Explainer → Worked Example → Guided Practice → Scenario Lab → Quiz). Migration 0015 defaults existing courses to legacy. Owner-scoped delivery-structure PATCH uses an expected-value conflict check; it leaves SME revisions and reviewed media untouched. Mastery Gate, Reflection and Spaced Review occur only after the final module, with no mini-project. Creator brief, blueprint, review and long-form views show this policy. Existing frozen blueprints remain source records; a new prompt-v3 blueprint freezes the policy and existing module IDs/order and requires fresh review. Approved prompt-v2 source/media remain supported, never rewritten or implicitly reapproved. Course-end assets require separate authoring and review; this setting does not publish content or change learner progress.

Long-form midpoint checkpoints: newly generated plans require exactly two source-linked formative questions after the midpoint slide of each video (after slide 4 for an eight-slide deck). Questions cover only first-half source/objective links. The reviewed plan freezes the checkpoint in the video package; changes require plan revision and renewed review. Creator playback pauses at that boundary, retains prior correct answers during hint/retry, then resumes the next matching clip after both questions are correct and the user chooses Continue video. Quiz time is activity time, excluded from the 300–420-second measured clip range. The module-end quiz stays separate; these checks do not award grades or mastery. Existing Module 1 plans and media without checkpoint metadata remain unchanged.

## Guided project workspace

For read-only project exploration, keep the finale entry short and open the existing dedicated workspace route. The desktop workspace uses a compact numbered stage outline, current instruction and read-only workflow, and an example/results panel. Only the current topic's explanation field is shown. The persistent footer keeps navigation, explicit save, reload and save status available; switching stages saves the current work. Completed-answer marks indicate progress, not a passed grade. The review step separates submission from running examples and explains automated grading limits.

Use existing panel, text, line and accent tokens and shared buttons/surfaces. No new decorative animation is introduced. Focus moves to the current heading after navigation, live regions announce save/error states, and all controls retain visible keyboard focus. Small screens switch between exploration and results, with a horizontally scrollable stage outline. Local overflow remains available for long content and zoom; the design does not force all content into a fixed-height screen.
# Guided project workflow canvas

The Clean Data guided mini project follows the agent project's canvas layout: exploration steps on the left, the complete ready-made workflow in the center, and the current instruction, explanation and example results in an inspector on the right. React Flow arrows indicate execution order. Selecting a node opens its existing guided stage; nodes and connections cannot be edited. Run results appear on nodes and in the inspector. Desktop panels scroll independently; smaller screens stack the canvas and offer the existing explanation/results switch.
