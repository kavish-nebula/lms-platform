ALTER TABLE "creator_blueprints" ADD COLUMN "scope_key" text DEFAULT 'course' NOT NULL;
--> statement-breakpoint
DROP INDEX "creator_blueprint_input_version";
--> statement-breakpoint
CREATE UNIQUE INDEX "creator_blueprint_input_version" ON "creator_blueprints" ("course_id", "input_revision", "prompt_version", "scope_key");
