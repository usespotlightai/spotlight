CREATE TABLE "snapshot_removal" (
	"archive_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"store" text NOT NULL,
	"snapshot" text NOT NULL,
	"queued_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "working_copy_archive" ALTER COLUMN "size" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "working_copy_archive" ALTER COLUMN "sha256" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "runner_pool" ADD COLUMN "working_copy_store" text;--> statement-breakpoint
ALTER TABLE "runner_pool" ADD COLUMN "working_copy_base" text;--> statement-breakpoint
ALTER TABLE "runner_trust" ADD COLUMN "working_copy_store" text;--> statement-breakpoint
ALTER TABLE "runner_trust" ADD COLUMN "working_copy_base" text;--> statement-breakpoint
ALTER TABLE "working_copy_archive" ADD COLUMN "snapshot_store" text;--> statement-breakpoint
ALTER TABLE "working_copy_archive" ADD COLUMN "snapshot_base" text;--> statement-breakpoint
CREATE INDEX "snapshot_removal_store_idx" ON "snapshot_removal" USING btree ("workspace_id","store","queued_at");--> statement-breakpoint
ALTER TABLE "runner_pool" ADD CONSTRAINT "runner_pool_working_copies_pull" CHECK (("runner_pool"."working_copy_base" is null or "runner_pool"."working_copy_store" is not null) and ("runner_pool"."working_copy_store" is null or "runner_pool"."token_hash" is not null));--> statement-breakpoint
ALTER TABLE "runner_trust" ADD CONSTRAINT "runner_trust_working_copy_base" CHECK ("runner_trust"."working_copy_base" is null or "runner_trust"."working_copy_store" is not null);--> statement-breakpoint
ALTER TABLE "working_copy_archive" ADD CONSTRAINT "working_copy_archive_snapshot_base" CHECK ("working_copy_archive"."snapshot_base" is null or "working_copy_archive"."snapshot_store" is not null);--> statement-breakpoint
ALTER TABLE "working_copy_archive" ADD CONSTRAINT "working_copy_archive_one_location" CHECK (case when "working_copy_archive"."snapshot_store" is null then "working_copy_archive"."size" is not null and "working_copy_archive"."sha256" is not null else "working_copy_archive"."size" is null and "working_copy_archive"."sha256" is null end);