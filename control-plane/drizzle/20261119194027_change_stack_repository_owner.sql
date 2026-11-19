DELETE FROM "question_answer";--> statement-breakpoint
DELETE FROM "stack_check";--> statement-breakpoint
DELETE FROM "change_stack";--> statement-breakpoint
ALTER TABLE "change_stack" ADD COLUMN "repository_owner" text NOT NULL;
