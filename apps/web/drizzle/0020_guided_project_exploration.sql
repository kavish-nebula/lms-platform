CREATE TABLE "guided_project_work" (
  "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "revision_id" uuid NOT NULL REFERENCES "creator_authored_course_revisions"("id"),
  "answers" jsonb NOT NULL,
  "run_case_ids" jsonb NOT NULL,
  "stage_id" text NOT NULL,
  "version" integer NOT NULL,
  "report" jsonb,
  "submission_id" uuid,
  "submitted_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("enrollment_id", "revision_id")
);
--> statement-breakpoint
CREATE TABLE "guided_project_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "revision_id" uuid NOT NULL REFERENCES "creator_authored_course_revisions"("id"),
  "answers" jsonb NOT NULL,
  "run_case_ids" jsonb NOT NULL,
  "report" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
