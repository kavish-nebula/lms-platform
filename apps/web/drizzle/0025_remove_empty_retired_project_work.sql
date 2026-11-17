-- Retired Python project storage has no runtime readers or writers.
-- Never discard learner files on another installation that still has history.
LOCK TABLE "public"."project_work" IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."project_work" LIMIT 1) THEN
    RAISE EXCEPTION 'project_work contains historical learner files. Export or archive them explicitly before retiring this table; no data has been removed.';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE "public"."project_work";
