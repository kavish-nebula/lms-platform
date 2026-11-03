CREATE TABLE "scorm_topic_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" text NOT NULL,
  "topic_id" text NOT NULL,
  "fingerprint" text NOT NULL,
  "source" jsonb NOT NULL,
  "hierarchy" jsonb NOT NULL,
  "active" boolean DEFAULT false NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scorm_import_source" ON "scorm_topic_imports" ("owner_id", "topic_id", "fingerprint");
--> statement-breakpoint
CREATE UNIQUE INDEX "scorm_import_active_topic" ON "scorm_topic_imports" ("topic_id") WHERE "active" = true;
