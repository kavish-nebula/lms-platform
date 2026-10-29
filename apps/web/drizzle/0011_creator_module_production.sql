CREATE TABLE "creator_production_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"approval_id" uuid NOT NULL,
	"prompt_version" integer NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"current_revision" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"token" uuid NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"model" text,
	"error" text,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_production_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"narration_hashes" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_script_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"verdict" text NOT NULL,
	"checklist" jsonb NOT NULL,
	"feedback" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_production_jobs" ADD CONSTRAINT "creator_production_jobs_course_id_creator_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."creator_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_production_jobs" ADD CONSTRAINT "creator_production_jobs_run_id_creator_blueprints_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."creator_blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_production_jobs" ADD CONSTRAINT "creator_production_jobs_approval_id_creator_sme_reviews_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."creator_sme_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_production_revisions" ADD CONSTRAINT "creator_production_revisions_job_id_creator_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."creator_production_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_production_revisions" ADD CONSTRAINT "creator_production_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_script_reviews" ADD CONSTRAINT "creator_script_reviews_job_id_creator_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."creator_production_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_script_reviews" ADD CONSTRAINT "creator_script_reviews_revision_id_creator_production_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."creator_production_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_script_reviews" ADD CONSTRAINT "creator_script_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_production_source" ON "creator_production_jobs" USING btree ("run_id","module_id","approval_id","prompt_version");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_production_revision" ON "creator_production_revisions" USING btree ("job_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_script_review_version" ON "creator_script_reviews" USING btree ("job_id","version");