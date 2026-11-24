CREATE TYPE "public"."run_wait_reason" AS ENUM('hosts-pull', 'no-pool-has-room', 'platform-pool-not-allowed', 'no-pool-matches');--> statement-breakpoint
CREATE TYPE "public"."runner_source_kind" AS ENUM('pool', 'trust');--> statement-breakpoint
CREATE TABLE "run_wait" (
	"run_id" text PRIMARY KEY NOT NULL,
	"reason" "run_wait_reason" NOT NULL,
	"queued_at" timestamp (3) with time zone NOT NULL,
	"since" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runner" ADD COLUMN "platform" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runner" ADD COLUMN "claimed_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "runner_pool" ADD COLUMN "allows_secrets" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runner_pool" ADD COLUMN "allows_review_work" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "ran_on_kind" "runner_source_kind";--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "ran_on_key" text;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "ran_on_platform" boolean;--> statement-breakpoint
ALTER TABLE "run_wait" ADD CONSTRAINT "run_wait_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_pool" ADD CONSTRAINT "runner_pool_allows_platform" CHECK ((not "runner_pool"."allows_secrets" and not "runner_pool"."allows_review_work") or "runner_pool"."platform");--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_ran_on_check" CHECK (("run"."ran_on_kind" is null) = ("run"."ran_on_key" is null) and ("run"."ran_on_kind" is null) = ("run"."ran_on_platform" is null));