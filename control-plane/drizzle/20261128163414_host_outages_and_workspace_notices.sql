ALTER TYPE "public"."run_wait_reason" ADD VALUE 'hosts-offline' BEFORE 'no-pool-has-room';--> statement-breakpoint
CREATE TABLE "host_outage" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"pool_id" text,
	"trust_id" text,
	"hosts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"since" timestamp (3) with time zone NOT NULL,
	"raised_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "host_outage_one_credential_source" CHECK (("host_outage"."pool_id" is null) <> ("host_outage"."trust_id" is null))
);
--> statement-breakpoint
ALTER TABLE "notice" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "run_wait" ADD COLUMN "quiet_hosts" jsonb;--> statement-breakpoint
ALTER TABLE "run_wait" ADD COLUMN "quiet_since" timestamp (3) with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "host_outage_pool_idx" ON "host_outage" USING btree ("pool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "host_outage_trust_idx" ON "host_outage" USING btree ("trust_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notice_workspace_subject_idx" ON "notice" USING btree ("workspace_id","form","subject") WHERE "notice"."team_id" is null;