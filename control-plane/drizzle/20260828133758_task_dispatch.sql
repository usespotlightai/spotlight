DROP INDEX "run_queue_idx";--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "run_id" text;--> statement-breakpoint
CREATE INDEX "run_queue_idx" ON "run" USING btree ("pool","state","priority","created_at");