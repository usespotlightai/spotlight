ALTER TABLE "task" ADD COLUMN "raised_by_id" text;--> statement-breakpoint
ALTER TABLE "task_note" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_raised_by_id_user_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;