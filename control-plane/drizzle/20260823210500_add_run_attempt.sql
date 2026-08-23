ALTER TABLE "run" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "run_event" ADD COLUMN "attempt" integer NOT NULL;