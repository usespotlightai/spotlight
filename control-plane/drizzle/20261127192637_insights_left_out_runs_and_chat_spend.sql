CREATE TYPE "public"."run_left_out" AS ENUM('refused', 'setup', 'infrastructure', 'cancelled');--> statement-breakpoint
CREATE TABLE "chat_run_spend" (
	"run_id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"harness" text NOT NULL,
	"model" text,
	"repositories" jsonb NOT NULL,
	"cost" numeric(24, 12),
	"currency" text,
	"spent_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "chat_run_spend_currency_code" CHECK ("chat_run_spend"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "run_fact" ADD COLUMN "left_out" "run_left_out";--> statement-breakpoint
CREATE INDEX "chat_run_spend_team_idx" ON "chat_run_spend" USING btree ("workspace_id","team_id","spent_at");--> statement-breakpoint
UPDATE "run_fact" SET "left_out" = CASE
	WHEN "ended_as" = 'cancelled' THEN 'cancelled'
	WHEN "failure" = 'refused' THEN 'refused'
	WHEN "failure" = 'unprepared' THEN 'setup'
	WHEN "failure" = 'unprovisioned' THEN 'infrastructure'
	WHEN "failure" = 'start-gate-unanswered' THEN 'infrastructure'
	WHEN "failure" = 'runner-lost' THEN 'infrastructure'
	WHEN "failure" = 'cancelled' THEN 'cancelled'
END::"run_left_out"
WHERE "left_out" IS NULL;
