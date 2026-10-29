CREATE TABLE "creator_production_audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
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
ALTER TABLE "creator_production_audio" ADD CONSTRAINT "creator_production_audio_job_id_creator_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."creator_production_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_production_audio" ADD CONSTRAINT "creator_production_audio_revision_id_creator_production_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."creator_production_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_production_audio" ADD CONSTRAINT "creator_production_audio_review_id_creator_script_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."creator_script_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_production_audio_source" ON "creator_production_audio" USING btree ("revision_id","review_id","voice_key");