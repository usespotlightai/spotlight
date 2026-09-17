ALTER TYPE "public"."review_comment_state" ADD VALUE 'failed' BEFORE 'deleted';--> statement-breakpoint
ALTER TYPE "public"."review_state" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."review_state" ADD VALUE 'withdrawn';--> statement-breakpoint
CREATE TABLE "oauth2_spent_nonce" (
	"nonce" text PRIMARY KEY NOT NULL,
	"until" timestamp NOT NULL
);
--> statement-breakpoint
DROP INDEX "inbound_delivery_state_idx";--> statement-breakpoint
ALTER TABLE "run_event" DROP CONSTRAINT "run_event_run_id_seq_pk";--> statement-breakpoint
ALTER TABLE "run_event" ADD CONSTRAINT "run_event_run_id_attempt_seq_pk" PRIMARY KEY("run_id","attempt","seq");--> statement-breakpoint
ALTER TABLE "review_comment" ADD COLUMN "edit_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "review_comment" ADD COLUMN "edits_awaiting_echo" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "inbound_delivery" ADD COLUMN "due_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "inbound_delivery_state_idx" ON "inbound_delivery" USING btree ("state","due_at");