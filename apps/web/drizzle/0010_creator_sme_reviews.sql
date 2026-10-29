CREATE TABLE "creator_sme_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"version" integer NOT NULL,
	"verdict" text NOT NULL,
	"checklist" jsonb NOT NULL,
	"feedback" text NOT NULL,
	"priority" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_sme_reviews" ADD CONSTRAINT "creator_sme_reviews_run_id_creator_blueprints_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."creator_blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_sme_reviews" ADD CONSTRAINT "creator_sme_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_sme_review_version" ON "creator_sme_reviews" USING btree ("run_id","module_id","version");