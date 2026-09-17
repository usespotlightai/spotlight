CREATE TABLE "attachment_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text,
	"chat_id" text,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_claim_one_holder" CHECK (num_nonnulls("attachment_claim"."task_id", "attachment_claim"."chat_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_station_id_station_id_fk";
--> statement-breakpoint
ALTER TABLE "change_stack" ADD COLUMN "work_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "change_stack" ADD COLUMN "work_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "review_comment" ADD COLUMN "sent_body" text;--> statement-breakpoint
ALTER TABLE "configuration_home" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_config" ADD COLUMN "begun_at" timestamp;--> statement-breakpoint
ALTER TABLE "team_invite" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_mark" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "attachment_claim" ADD CONSTRAINT "attachment_claim_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_claim" ADD CONSTRAINT "attachment_claim_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_claim_task_idx" ON "attachment_claim" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "attachment_claim_chat_idx" ON "attachment_claim" USING btree ("chat_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE restrict ON UPDATE no action;