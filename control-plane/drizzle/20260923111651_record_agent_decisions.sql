CREATE TYPE "public"."decision_kind" AS ENUM('trade-off', 'assumption', 'limitation', 'rejected-approach', 'deviation');--> statement-breakpoint
CREATE TYPE "public"."decision_standing" AS ENUM('proposed', 'stands');--> statement-breakpoint
ALTER TYPE "public"."review_sync_kind" ADD VALUE 'file' BEFORE 'edit';--> statement-breakpoint
CREATE TABLE "decision" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "decision_kind" NOT NULL,
	"title" text NOT NULL,
	"why" text NOT NULL,
	"alternatives" jsonb NOT NULL,
	"paths" jsonb NOT NULL,
	"steps" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_dispute" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"path" text NOT NULL,
	"by_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_set" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"decided_in" text,
	"draft_run_id" text,
	"draft_asked_at" timestamp,
	"work_attempts" integer DEFAULT 0 NOT NULL,
	"work_due_at" timestamp,
	"standing" "decision_standing" DEFAULT 'proposed' NOT NULL,
	"merged_repository" text,
	"merged_commit" text,
	"merged_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_comment" ALTER COLUMN "side" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "review_comment" ALTER COLUMN "line" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "station" ADD COLUMN "decisions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_set_id_decision_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."decision_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_dispute" ADD CONSTRAINT "decision_dispute_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "decision_position_idx" ON "decision" USING btree ("set_id","position");--> statement-breakpoint
CREATE INDEX "decision_paths_idx" ON "decision" USING gin ("paths");--> statement-breakpoint
CREATE INDEX "decision_dispute_decision_idx" ON "decision_dispute" USING btree ("decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_set_task_idx" ON "decision_set" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "decision_set_draft_idx" ON "decision_set" USING btree ("draft_asked_at");--> statement-breakpoint
CREATE INDEX "decision_set_merged_idx" ON "decision_set" USING btree ("workspace_id","merged_repository","merged_at");--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_lines_check" CHECK (("review_comment"."side" is null) = ("review_comment"."line" is null) and ("review_comment"."line" is not null or "review_comment"."start_line" is null));