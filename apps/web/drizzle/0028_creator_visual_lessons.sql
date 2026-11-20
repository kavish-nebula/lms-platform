CREATE TABLE "creator_visual_lessons" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "course_id" uuid NOT NULL REFERENCES "creator_courses"("id"),
 "owner_id" text NOT NULL REFERENCES "users"("id"),
 "module_id" text NOT NULL, "video_id" text NOT NULL, "version" integer NOT NULL,
 "brief_revision" integer NOT NULL, "source_identity" text NOT NULL,
 "content" jsonb NOT NULL, "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "creator_visual_lesson_version" ON "creator_visual_lessons" ("course_id", "video_id", "version");
--> statement-breakpoint
CREATE TABLE "creator_visual_jobs" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "revision_id" uuid NOT NULL REFERENCES "creator_visual_lessons"("id"),
 "kind" text NOT NULL, "identity" text NOT NULL, "status" text NOT NULL DEFAULT 'queued',
 "dependency_id" uuid, "output" jsonb NOT NULL DEFAULT '{}', "token" uuid,
 "lease_until" timestamp with time zone, "error" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "creator_visual_job_identity" ON "creator_visual_jobs" ("revision_id", "kind", "identity");
