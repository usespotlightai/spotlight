CREATE TYPE "public"."change_stack_state" AS ENUM('drafting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_comment_state" AS ENUM('draft', 'submitted', 'posted', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."review_side" AS ENUM('new', 'old');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('submitted', 'posted');--> statement-breakpoint
CREATE TYPE "public"."review_sync_kind" AS ENUM('review', 'reply', 'edit', 'delete');--> statement-breakpoint
CREATE TYPE "public"."review_sync_state" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_verdict" AS ENUM('comment', 'approve', 'request-changes');--> statement-breakpoint
CREATE TABLE "change_stack" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"repository" text,
	"state" "change_stack_state" NOT NULL,
	"files" jsonb NOT NULL,
	"cohorts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure" text,
	"drafted_at" timestamp NOT NULL,
	"settled_at" timestamp,
	"check" jsonb,
	"facts" jsonb
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"author_id" text NOT NULL,
	"verdict" "review_verdict" NOT NULL,
	"body" text NOT NULL,
	"comment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "review_state" NOT NULL,
	"github_id" bigint,
	"submitted_at" timestamp NOT NULL,
	"posted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "review_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"path" text NOT NULL,
	"side" "review_side" NOT NULL,
	"line" integer NOT NULL,
	"start_line" integer,
	"body" text NOT NULL,
	"author_id" text,
	"author_login" text,
	"author_name" text NOT NULL,
	"reply_to_id" text,
	"review_id" text,
	"state" "review_comment_state" NOT NULL,
	"github_id" bigint,
	"github_url" text,
	"created_at" timestamp NOT NULL,
	"edited_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "review_sync" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"kind" "review_sync_kind" NOT NULL,
	"subject_id" text NOT NULL,
	"state" "review_sync_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp NOT NULL,
	"failure" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "station" ADD COLUMN "check" text;--> statement-breakpoint
ALTER TABLE "change_stack" ADD CONSTRAINT "change_stack_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_stack" ADD CONSTRAINT "change_stack_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sync" ADD CONSTRAINT "review_sync_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sync" ADD CONSTRAINT "review_sync_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_stack_run_idx" ON "change_stack" USING btree ("run_id","drafted_at");--> statement-breakpoint
CREATE INDEX "review_task_idx" ON "review" USING btree ("task_id","submitted_at");--> statement-breakpoint
CREATE INDEX "review_comment_task_idx" ON "review_comment" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_comment_github_idx" ON "review_comment" USING btree ("workspace_id","github_id");--> statement-breakpoint
CREATE INDEX "review_sync_due_idx" ON "review_sync" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "review_sync_task_idx" ON "review_sync" USING btree ("task_id");