import { integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { LearnerPlan, PlanChangeT, PlanSource, PlanStatus, PlanVersion } from "@/lib/learner-plan";
import type { PrecheckResult, SetupAnswers, SupportOverride } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";
import type { EngagementState } from "@/lib/engagement";
import type { Workflow, WorkflowReport } from "@/lib/workflow-project";
import type { Workspace } from "@/lib/workplace";
import type { CourseBriefData } from "@/lib/content-creator";
import type { Blueprint, BlueprintInput } from "@/lib/instructional-blueprint";
import type { ReviewChecklist, ReviewDecision } from "@/lib/sme-review";
import type { ModulePackage, ProductionInput, SlideDraft } from "@/lib/module-production";
import type { z } from "zod/v4";
import type { ScriptChecks } from "@/lib/module-production";
import type { ProductionAudioClip, ProductionVoice } from "@/lib/production-audio";
import type { AuthoredCoursePackageData, CourseReviewChecklist } from "@/lib/authored-course";
import type { SandboxArtifactData, SandboxReport } from '@/lib/project-sandbox';
import type { GuidedReport } from '@/lib/guided-project';

/** A release pins immutable content and its approval; authoring edits never replace it. */
export const publishedAuthoredCourses = pgTable('published_authored_courses', {
  courseId: uuid('course_id').primaryKey().references(() => creatorCourses.id),
  revisionId: uuid('revision_id').notNull().references(() => creatorAuthoredCourseRevisions.id),
  reviewId: uuid('review_id').notNull().references(() => creatorAuthoredCourseReviews.id),
  publishedBy: text('published_by').notNull().references(() => users.id),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export const creatorProductionAudio = pgTable("creator_production_audio", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => creatorProductionJobs.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id").notNull().references(() => creatorProductionRevisions.id, { onDelete: "cascade" }),
  reviewId: uuid("review_id").notNull().references(() => creatorScriptReviews.id),
  voiceKey: text("voice_key").notNull(), voice: jsonb("voice").$type<ProductionVoice>().notNull(),
  status: text("status").$type<"running" | "ready" | "failed">().notNull().default("running"),
  clips: jsonb("clips").$type<ProductionAudioClip[]>().notNull().default([]),
  token: uuid("token").notNull(), attempts: integer("attempts").notNull().default(1), error: text("error"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("creator_production_audio_source").on(t.revisionId, t.reviewId, t.voiceKey)]);

export const creatorProductionJobs = pgTable("creator_production_jobs", {
  id: uuid("id").primaryKey().defaultRandom(), courseId: uuid("course_id").notNull().references(() => creatorCourses.id, { onDelete: "cascade" }),
  runId: uuid("run_id").notNull().references(() => creatorBlueprints.id, { onDelete: "cascade" }), moduleId: text("module_id").notNull(),
  approvalId: uuid("approval_id").notNull().references(() => creatorSmeReviews.id), promptVersion: integer("prompt_version").notNull(),
  unitKey: text('unit_key').notNull().default('module'),
  partialSlides: jsonb('partial_slides').$type<SlideDraft[]>().notNull().default([]),
  input: jsonb("input").$type<ProductionInput>().notNull(), status: text("status").notNull().default("running"),
  currentRevision: integer("current_revision").notNull().default(0), attempts: integer("attempts").notNull().default(1), token: uuid("token").notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(), model: text("model"), error: text("error"), usage: jsonb("usage").$type<Record<string, number>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("creator_production_source").on(t.runId, t.moduleId, t.approvalId, t.promptVersion, t.unitKey)]);

export const creatorProductionRevisions = pgTable("creator_production_revisions", {
  id: uuid("id").primaryKey().defaultRandom(), jobId: uuid("job_id").notNull().references(() => creatorProductionJobs.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), content: jsonb("content").$type<ModulePackage>().notNull(), narrationHashes: jsonb("narration_hashes").$type<Record<string, string>>().notNull(),
  createdBy: text("created_by").notNull().references(() => users.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("creator_production_revision").on(t.jobId, t.version)]);

export const creatorScriptReviews = pgTable("creator_script_reviews", {
  id: uuid("id").primaryKey().defaultRandom(), jobId: uuid("job_id").notNull().references(() => creatorProductionJobs.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id").notNull().references(() => creatorProductionRevisions.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), verdict: text("verdict").$type<"approved" | "revision_requested">().notNull(), checklist: jsonb("checklist").$type<z.infer<typeof ScriptChecks>>().notNull(), feedback: text("feedback").notNull(),
  reviewerId: text("reviewer_id").notNull().references(() => users.id), reviewerName: text("reviewer_name").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("creator_script_review_version").on(t.jobId, t.version)]);

/** Append-only human decisions; a changed verdict creates a new version. */
export const creatorSmeReviews = pgTable("creator_sme_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => creatorBlueprints.id, { onDelete: "cascade" }),
  moduleId: text("module_id").notNull(),
  version: integer("version").notNull(),
  verdict: text("verdict").$type<ReviewDecision["verdict"]>().notNull(),
  checklist: jsonb("checklist").$type<ReviewChecklist>().notNull(),
  feedback: text("feedback").notNull(),
  priority: text("priority").$type<ReviewDecision["priority"]>().notNull(),
  reviewerId: text("reviewer_id").notNull().references(() => users.id),
  reviewerName: text("reviewer_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("creator_sme_review_version").on(t.runId, t.moduleId, t.version)]);

/** A blueprint is a reviewable AI artefact tied to a frozen authoring revision. */
export const creatorBlueprints = pgTable("creator_blueprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").notNull().references(() => creatorCourses.id, { onDelete: "cascade" }),
  inputRevision: integer("input_revision").notNull(),
  promptVersion: integer("prompt_version").notNull(),
  input: jsonb("input").$type<BlueprintInput>().notNull(),
  output: jsonb("output").$type<Blueprint>(),
  status: text("status").notNull().default("running"),
  attempts: integer("attempts").notNull().default(1),
  token: uuid("token").notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  model: text("model"),
  error: text("error"),
  usage: jsonb("usage").$type<Record<string, number>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("creator_blueprint_input_version").on(t.courseId, t.inputRevision, t.promptVersion)]);

/** Authoring drafts never modify the published content or learner records. */
export const creatorCourses = pgTable("creator_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  brief: jsonb("brief").$type<CourseBriefData>().notNull(),
  productionFormat: text('production_format').$type<'pilot' | 'longform-v1'>().notNull().default('pilot'),
  deliveryStructure: text('delivery_structure').$type<'legacy' | 'six-stage-v1' | 'codex-ild-v2'>().notNull().default('legacy'),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Codex-authored full-course snapshots. Each edit appends a revision; learner publishing is separate. */
export const creatorAuthoredCourseRevisions = pgTable('creator_authored_course_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => creatorCourses.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  briefRevision: integer('brief_revision').notNull(),
  blueprintRunId: uuid('blueprint_run_id').references(() => creatorBlueprints.id),
  content: jsonb('content').$type<AuthoredCoursePackageData>().notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('creator_authored_course_revision').on(t.courseId, t.version)]);

/** Final human review is tied to an immutable authored package revision. */
export const creatorAuthoredCourseReviews = pgTable('creator_authored_course_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => creatorCourses.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').notNull().references(() => creatorAuthoredCourseRevisions.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  verdict: text('verdict').$type<'approved' | 'revision_requested'>().notNull(),
  checklist: jsonb('checklist').$type<CourseReviewChecklist>().notNull(),
  feedback: text('feedback').notNull(),
  reviewerId: text('reviewer_id').notNull().references(() => users.id),
  reviewerName: text('reviewer_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('creator_authored_course_review_version').on(t.revisionId, t.version)]);

/** Short-lived, course-scoped bearer grants for Codex MCP. Only a hash is persisted. */
export const creatorCodexGrants = pgTable('creator_codex_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => creatorCourses.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Locally rendered narration belongs to an immutable course package revision. */
export const creatorAuthoredCourseAudio = pgTable('creator_authored_course_audio', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => creatorCourses.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').notNull().references(() => creatorAuthoredCourseRevisions.id, { onDelete: 'cascade' }),
  voiceKey: text('voice_key').notNull(),
  voice: jsonb('voice').$type<ProductionVoice>().notNull(),
  status: text('status').$type<'running' | 'ready' | 'failed'>().notNull().default('running'),
  clips: jsonb('clips').$type<ProductionAudioClip[]>().notNull().default([]),
  token: uuid('token').notNull(), attempts: integer('attempts').notNull().default(1), error: text('error'),
  leaseUntil: timestamp('lease_until', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('creator_authored_course_audio_source').on(t.revisionId, t.voiceKey)]);

/**
 * Learner data. Profile answers drive the course plan; plans are append-only
 * versions (the adaptation log); signals are the answers that make the
 * planner revise a plan. Ids stay text where the content layer already names things
 * (course "n8n", module "m1", lesson "2.1").
 */

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Durable slide jobs are also immutable revisions and resumable delivery records. */
export const adaptationJobs = pgTable("adaptation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  moduleId: text("module_id").notNull(),
  videoId: text("video_id").notNull(),
  slide: integer("slide").notNull(),
  fingerprint: text("fingerprint").notNull().unique(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull().default("queued"),
  priority: integer("priority").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  lease: text("lease"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  content: jsonb("content").$type<Record<string, unknown>>(),
  audio: text("audio"),
  error: text("error"),
  model: text("model"),
  metrics: jsonb("metrics").$type<Record<string, number>>(),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moduleEvidence = pgTable("module_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  moduleId: text("module_id").notNull(),
  version: integer("version").notNull(),
  fingerprint: text("fingerprint").notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("module_evidence_version").on(t.enrollmentId, t.moduleId, t.version)]);

/** Versioned platform records share a learner lock; no course data is rewritten. */
export const platformEngagement = pgTable("platform_engagement", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<EngagementState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: created(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<SetupAnswers>().notNull(),
  needs: jsonb("needs").$type<string[]>().notNull(),
  /** what the language model worked out from a typed field (lib/profiling/derived.ts) */
  derived: jsonb("derived").$type<ProfileDerived>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * "About you" while it is being answered: saved after each answer, so the
 * chat resumes where the learner left it, on any device. Becomes the profile
 * (and is deleted) when they finish.
 */
export const profileDrafts = pgTable("profile_drafts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<SetupAnswers>().notNull(),
  needs: jsonb("needs").$type<string[]>().notNull(),
  derived: jsonb("derived").$type<ProfileDerived>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** How the learner set up one course: their answers for it, help override, study pace, quick check. */
export type Pace = { sessionMinutes: number; studyDays: number[] };
export type StoredPrecheck = PrecheckResult & { responses?: Record<string, string | null> };

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    answers: jsonb("answers").$type<SetupAnswers>().notNull(),
    supportOverride: text("support_override").$type<SupportOverride>().notNull().default("auto"),
    pace: jsonb("pace").$type<Pace | null>(),
    precheck: jsonb("precheck").$type<StoredPrecheck | null>(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("enrollments_user_course").on(t.userId, t.courseId)],
);

export const learnerPlans = pgTable(
  "learner_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<PlanStatus>().notNull(),
    source: text("source").$type<PlanSource>().notNull(),
    trigger: text("trigger").$type<PlanVersion["trigger"]>().notNull(),
    model: text("model"),
    plan: jsonb("plan").$type<LearnerPlan | null>(),
    changes: jsonb("changes").$type<PlanChangeT[]>().notNull().default([]),
    usage: jsonb("usage").$type<Record<string, number> | null>(),
    error: text("error"),
    createdAt: created(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("learner_plans_version").on(t.enrollmentId, t.version)],
);

export const signals = pgTable("signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  moduleId: text("module_id"),
  lesson: text("lesson"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  usedInPlanVersion: integer("used_in_plan_version"),
  createdAt: created(),
});

export const stepProgress = pgTable(
  "step_progress",
  {
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    stage: text("stage").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.enrollmentId, t.moduleId, t.stage] })],
);

/** One piece of a module rewritten for one learner (content/adapt): the hook, a concept video, or the worked examples. */
export type AdaptedPiece = "hook" | "worked" | "world" | `video:${string}`;
export type AdaptedStatus = "writing" | "voicing" | "ready" | "failed";

/**
 * A module piece rewritten into the learner's own world: the content in the
 * authored shape, and the narration clips made for it. A piece is shown only
 * when `ready` (its text and voice match); until then the authored one plays.
 * `inputs` fingerprints what it was written from, so a changed setup rewrites it.
 */
export const adaptedContent = pgTable(
  "adapted_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    piece: text("piece").$type<AdaptedPiece>().notNull(),
    status: text("status").$type<AdaptedStatus>().notNull(),
    inputs: text("inputs").notNull(),
    content: jsonb("content").$type<Record<string, unknown> | null>(),
    audio: jsonb("audio").$type<Record<string, string> | null>(),
    model: text("model"),
    error: text("error"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("adapted_content_piece").on(t.enrollmentId, t.moduleId, t.piece)],
);

/**
 * The retired Python mini project ("Code and run"): learners' files and last
 * test report, kept so nothing they wrote is lost. Nothing writes to it now.
 */
export const projectWork = pgTable("project_work", {
  enrollmentId: uuid("enrollment_id")
    .primaryKey()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  files: jsonb("files").$type<Record<string, string>>().notNull(),
  report: jsonb("report").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The mini project: the agent's workflow, as the learner drew it. */
export const workflowProjects = pgTable("workflow_projects", {
  enrollmentId: uuid("enrollment_id").primaryKey().references(() => enrollments.id, { onDelete: "cascade" }),
  diagram: jsonb("diagram").$type<Workflow>().notNull(),
  report: jsonb("report").$type<WorkflowReport>(),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Revision-scoped practical work never overwrites another learner or release. */
export const authoredProjectWork = pgTable('authored_project_work', {
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').notNull().references(() => creatorAuthoredCourseRevisions.id),
  artifact: jsonb('artifact').$type<SandboxArtifactData>().notNull(),
  version: integer('version').notNull(),
  report: jsonb('report').$type<SandboxReport>(),
  submissionId: uuid('submission_id'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.enrollmentId, t.revisionId] })]);

export const authoredProjectSubmissions = pgTable('authored_project_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').notNull().references(() => creatorAuthoredCourseRevisions.id),
  artifact: jsonb('artifact').$type<SandboxArtifactData>().notNull(),
  report: jsonb('report').$type<SandboxReport>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Exploration answers are separate from historical learner-built artifacts. */
export const guidedProjectWork = pgTable('guided_project_work', {
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').notNull().references(() => creatorAuthoredCourseRevisions.id),
  answers: jsonb('answers').$type<Record<string, string>>().notNull(),
  runCaseIds: jsonb('run_case_ids').$type<string[]>().notNull(),
  stageId: text('stage_id').notNull(), version: integer('version').notNull(),
  report: jsonb('report').$type<GuidedReport>(), submissionId: uuid('submission_id'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.enrollmentId, t.revisionId] })]);

export const guidedProjectSubmissions = pgTable('guided_project_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').notNull().references(() => creatorAuthoredCourseRevisions.id),
  answers: jsonb('answers').$type<Record<string, string>>().notNull(),
  runCaseIds: jsonb('run_case_ids').$type<string[]>().notNull(),
  report: jsonb('report').$type<GuidedReport>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A per-owner sandbox. Team preview members are fictional, not user accounts. */
export const professionalWorkspaces = pgTable("professional_workspaces", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<Workspace>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
