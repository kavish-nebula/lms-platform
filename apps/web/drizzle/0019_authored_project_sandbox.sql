CREATE TABLE "authored_project_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"artifact" jsonb NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authored_project_work" (
	"enrollment_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"artifact" jsonb NOT NULL,
	"version" integer NOT NULL,
	"report" jsonb,
	"submission_id" uuid,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authored_project_work_enrollment_id_revision_id_pk" PRIMARY KEY("enrollment_id","revision_id")
);
--> statement-breakpoint
ALTER TABLE "authored_project_submissions" ADD CONSTRAINT "authored_project_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authored_project_submissions" ADD CONSTRAINT "authored_project_submissions_revision_id_creator_authored_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."creator_authored_course_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authored_project_work" ADD CONSTRAINT "authored_project_work_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authored_project_work" ADD CONSTRAINT "authored_project_work_revision_id_creator_authored_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."creator_authored_course_revisions"("id") ON DELETE no action ON UPDATE no action;