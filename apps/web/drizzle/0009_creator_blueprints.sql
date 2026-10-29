CREATE TABLE "creator_blueprints" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "course_id" uuid NOT NULL,
 "input_revision" integer NOT NULL,
 "prompt_version" integer NOT NULL,
 "input" jsonb NOT NULL,
 "output" jsonb,
 "status" text DEFAULT 'running' NOT NULL,
 "attempts" integer DEFAULT 1 NOT NULL,
 "token" uuid NOT NULL,
 "lease_until" timestamp with time zone NOT NULL,
 "model" text,
 "error" text,
 "usage" jsonb,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_blueprints" ADD CONSTRAINT "creator_blueprints_course_id_creator_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."creator_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "creator_blueprint_input_version" ON "creator_blueprints" USING btree ("course_id","input_revision","prompt_version");
