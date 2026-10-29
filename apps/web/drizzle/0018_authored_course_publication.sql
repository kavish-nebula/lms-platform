CREATE TABLE "published_authored_courses" (
  "course_id" uuid PRIMARY KEY CONSTRAINT "published_authored_courses_course_id_creator_courses_id_fk" REFERENCES "creator_courses"("id"),
  "revision_id" uuid NOT NULL CONSTRAINT "published_authored_courses_revision_id_creator_authored_course_revisions_id_fk" REFERENCES "creator_authored_course_revisions"("id"),
  "review_id" uuid NOT NULL CONSTRAINT "published_authored_courses_review_id_creator_authored_course_reviews_id_fk" REFERENCES "creator_authored_course_reviews"("id"),
  "published_by" text NOT NULL CONSTRAINT "published_authored_courses_published_by_users_id_fk" REFERENCES "users"("id"),
  "published_at" timestamp with time zone NOT NULL DEFAULT now()
);
