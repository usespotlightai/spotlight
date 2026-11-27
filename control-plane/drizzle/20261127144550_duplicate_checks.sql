CREATE TYPE "public"."duplicate_check_state" AS ENUM('pending', 'compared', 'failed');--> statement-breakpoint
CREATE TABLE "duplicate_check" (
	"run_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"task_id" text NOT NULL,
	"set_id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"state" "duplicate_check_state" DEFAULT 'pending' NOT NULL,
	"job_attempts" integer DEFAULT 0 NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"waiting_since" timestamp (3) with time zone,
	"question" jsonb,
	"verdicts" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "duplicate_check_attempts_not_negative" CHECK ("duplicate_check"."job_attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "duplicate_check_due_idx" ON "duplicate_check" USING btree ("state","job_due_at","created_at");--> statement-breakpoint
CREATE INDEX "duplicate_check_task_idx" ON "duplicate_check" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "duplicate_check_team_idx" ON "duplicate_check" USING btree ("team_id");