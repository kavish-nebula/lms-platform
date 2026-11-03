CREATE TABLE IF NOT EXISTS "imported_course_progress" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" text NOT NULL,
  "module_id" text NOT NULL,
  "revision" text NOT NULL,
  "state" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "course_id", "module_id", "revision")
);
