DROP INDEX "task_station_idx";--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "rank" text DEFAULT 'i' NOT NULL;--> statement-breakpoint
CREATE INDEX "task_station_idx" ON "task" USING btree ("station_id","rank");