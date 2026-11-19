ALTER TYPE "public"."chat_message_kind" ADD VALUE 'opened';--> statement-breakpoint
ALTER TYPE "public"."chat_message_kind" ADD VALUE 'happened';--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "pull_request" jsonb;--> statement-breakpoint
ALTER TABLE "task_hold" ADD COLUMN "chat_id" text;--> statement-breakpoint
CREATE INDEX "task_hold_chat_idx" ON "task_hold" USING btree ("chat_id") WHERE "task_hold"."chat_id" is not null;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_opened_names_a_pull_request" CHECK (("chat_message"."kind"::text = 'opened') = ("chat_message"."pull_request" is not null));--> statement-breakpoint
ALTER TABLE "task_hold" ADD CONSTRAINT "task_hold_for_a_chat_holds_from_no_run" CHECK ("task_hold"."chat_id" is null or "task_hold"."from_run_id" is null);