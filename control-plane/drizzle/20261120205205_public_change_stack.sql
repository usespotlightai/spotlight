DELETE FROM "question_answer";--> statement-breakpoint
DELETE FROM "stack_check";--> statement-breakpoint
DELETE FROM "change_stack";--> statement-breakpoint
CREATE TABLE "repository_visibility" (
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"visibility" text NOT NULL,
	"checked_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "repository_visibility_owner_name_pk" PRIMARY KEY("owner","name")
);
--> statement-breakpoint
ALTER TABLE "change_stack" ADD COLUMN "repository_owner" text NOT NULL;