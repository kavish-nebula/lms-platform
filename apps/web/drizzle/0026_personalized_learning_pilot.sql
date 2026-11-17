CREATE TABLE knowledge_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
 policy_key text NOT NULL, topic_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('diagnostic','review')),
 question_ids jsonb NOT NULL, responses jsonb, passed boolean, created_at timestamp with time zone NOT NULL DEFAULT now(), submitted_at timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX knowledge_attempt_scope ON knowledge_attempts(enrollment_id, policy_key, topic_id);
--> statement-breakpoint
CREATE UNIQUE INDEX knowledge_one_diagnostic ON knowledge_attempts(enrollment_id, policy_key, topic_id) WHERE kind = 'diagnostic';
--> statement-breakpoint
CREATE TABLE topic_progress (
 enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE, policy_key text NOT NULL, topic_id text NOT NULL,
 disposition text NOT NULL CHECK (disposition IN ('demonstrated','completed')), attempt_id uuid REFERENCES knowledge_attempts(id),
 updated_at timestamp with time zone NOT NULL DEFAULT now(), PRIMARY KEY(enrollment_id, policy_key, topic_id)
);
--> statement-breakpoint
CREATE TABLE learning_reviews (
 enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE, policy_key text NOT NULL, topic_id text NOT NULL, reason text NOT NULL,
 completed_at timestamp with time zone, updated_at timestamp with time zone NOT NULL DEFAULT now(), PRIMARY KEY(enrollment_id, policy_key, topic_id)
);
--> statement-breakpoint
CREATE TABLE learning_tutor_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
 policy_key text NOT NULL, topic_id text NOT NULL, messages jsonb NOT NULL DEFAULT '[]',
 updated_at timestamp with time zone NOT NULL DEFAULT now(), UNIQUE(enrollment_id,policy_key,topic_id)
);
--> statement-breakpoint
