CREATE TABLE "scorm_connections" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "owner_id" text NOT NULL,
 "source_course_id" text NOT NULL, "source_course_name" text NOT NULL,
 "target_course_id" uuid NOT NULL REFERENCES "creator_courses"("id"),
 "mapping" jsonb NOT NULL DEFAULT '{}', "baseline" jsonb NOT NULL DEFAULT '{}',
 "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scorm_connection_target" ON "scorm_connections" ("owner_id", "source_course_id", "target_course_id");
--> statement-breakpoint
CREATE TABLE "scorm_import_runs" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "connection_id" uuid NOT NULL REFERENCES "scorm_connections"("id"),
 "owner_id" text NOT NULL, "fingerprint" text NOT NULL, "status" text NOT NULL DEFAULT 'queued',
 "input" jsonb NOT NULL, "output" jsonb NOT NULL DEFAULT '{}', "error" text,
 "lease" uuid, "lease_until" timestamptz, "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scorm_run_identity" ON "scorm_import_runs" ("connection_id", "fingerprint");
--> statement-breakpoint
CREATE TABLE "course_editions" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "course_id" uuid NOT NULL REFERENCES "creator_courses"("id"),
 "revision_id" uuid NOT NULL REFERENCES "creator_authored_course_revisions"("id"),
 "review_id" uuid NOT NULL REFERENCES "creator_authored_course_reviews"("id"),
 "published_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "course_edition_revision" ON "course_editions" ("course_id", "revision_id");
--> statement-breakpoint
INSERT INTO "course_editions" ("course_id", "revision_id", "review_id", "published_at")
 SELECT "course_id", "revision_id", "review_id", "published_at" FROM "published_authored_courses";
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "edition_id" uuid REFERENCES "course_editions"("id");
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "archived_at" timestamptz;
--> statement-breakpoint
UPDATE "enrollments" e SET "edition_id" = d."id" FROM "course_editions" d WHERE e."course_id" = d."course_id"::text;
--> statement-breakpoint
DROP INDEX "enrollments_user_course";
--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_course_active" ON "enrollments" ("user_id", "course_id") WHERE "archived_at" IS NULL;
--> statement-breakpoint
