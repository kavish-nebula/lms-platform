CREATE TABLE "creator_authored_course_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
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
CREATE TABLE "creator_authored_course_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"version" integer NOT NULL,
	"brief_revision" integer NOT NULL,
	"blueprint_run_id" uuid,
	"content" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_codex_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_codex_grants_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "creator_authored_course_reviews" ADD CONSTRAINT "creator_authored_course_reviews_course_id_creator_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."creator_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_reviews" ADD CONSTRAINT "creator_authored_course_reviews_revision_id_creator_authored_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."creator_authored_course_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_reviews" ADD CONSTRAINT "creator_authored_course_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_revisions" ADD CONSTRAINT "creator_authored_course_revisions_course_id_creator_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."creator_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_revisions" ADD CONSTRAINT "creator_authored_course_revisions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_revisions" ADD CONSTRAINT "creator_authored_course_revisions_blueprint_run_id_creator_blueprints_id_fk" FOREIGN KEY ("blueprint_run_id") REFERENCES "public"."creator_blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_revisions" ADD CONSTRAINT "creator_authored_course_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_codex_grants" ADD CONSTRAINT "creator_codex_grants_course_id_creator_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."creator_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_codex_grants" ADD CONSTRAINT "creator_codex_grants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_authored_course_review_version" ON "creator_authored_course_reviews" USING btree ("revision_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_authored_course_revision" ON "creator_authored_course_revisions" USING btree ("course_id","version");