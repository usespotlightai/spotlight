CREATE TYPE "public"."dispatch_driver" AS ENUM('line', 'person');--> statement-breakpoint
CREATE TYPE "public"."hand_back" AS ENUM('continue', 'move-on', 'finish');--> statement-breakpoint
CREATE TYPE "public"."takeover_verdict" AS ENUM('not-right', 'exploring');--> statement-breakpoint
ALTER TYPE "public"."human_action" ADD VALUE 'taken-over';--> statement-breakpoint
ALTER TYPE "public"."judge_label_source" ADD VALUE 'taken-over';--> statement-breakpoint
ALTER TYPE "public"."task_note_form" ADD VALUE 'took-over';--> statement-breakpoint
ALTER TYPE "public"."task_note_form" ADD VALUE 'handed-back';--> statement-breakpoint
CREATE TABLE "task_takeover" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"station_id" text NOT NULL,
	"taken_by" text NOT NULL,
	"from_run_id" text,
	"verdict" "takeover_verdict" NOT NULL,
	"turn_run_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"held_move_to" text,
	"from_heads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"to_heads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hand_back" "hand_back",
	"started_at" timestamp (3) with time zone NOT NULL,
	"ended_at" timestamp (3) with time zone,
	CONSTRAINT "task_takeover_ends_with_hand_back" CHECK (("task_takeover"."ended_at" is null) = ("task_takeover"."hand_back" is null))
);
--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "end_heads" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch" ADD COLUMN "driver" "dispatch_driver" DEFAULT 'line' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_takeover" ADD CONSTRAINT "task_takeover_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."task"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_takeover_open_uidx" ON "task_takeover" USING btree ("task_id") WHERE "task_takeover"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "task_takeover_task_idx" ON "task_takeover" USING btree ("task_id","started_at");--> statement-breakpoint
CREATE INDEX "task_takeover_station_idx" ON "task_takeover" USING btree ("station_id","started_at");