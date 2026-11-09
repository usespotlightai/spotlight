ALTER TABLE "chat" ADD COLUMN "resolved_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "read_at" timestamp (3) with time zone;