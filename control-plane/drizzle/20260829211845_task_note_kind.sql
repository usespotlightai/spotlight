ALTER TABLE "task_note" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "inbox";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "inbox_at";