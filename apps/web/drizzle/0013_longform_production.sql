DROP INDEX "creator_production_source";--> statement-breakpoint
ALTER TABLE "creator_courses" ADD COLUMN "production_format" text DEFAULT 'pilot' NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_production_jobs" ADD COLUMN "unit_key" text DEFAULT 'module' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_production_source" ON "creator_production_jobs" USING btree ("run_id","module_id","approval_id","prompt_version","unit_key");