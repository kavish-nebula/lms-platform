CREATE TABLE "creator_authored_course_audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"revision_id" uuid NOT NULL,
	"voice_key" text NOT NULL,
	"voice" jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"clips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token" uuid NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"lease_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_authored_course_audio" ADD CONSTRAINT "creator_authored_course_audio_course_id_creator_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."creator_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_audio" ADD CONSTRAINT "creator_authored_course_audio_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_authored_course_audio" ADD CONSTRAINT "creator_authored_course_audio_revision_id_creator_authored_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."creator_authored_course_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_authored_course_audio_source" ON "creator_authored_course_audio" USING btree ("revision_id","voice_key");