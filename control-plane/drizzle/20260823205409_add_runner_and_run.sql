CREATE TYPE "public"."run_state" AS ENUM('queued', 'claimed', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"pool" text NOT NULL,
	"state" "run_state" NOT NULL,
	"spec" jsonb NOT NULL,
	"claimed_by" text,
	"lease_expires_at" timestamp,
	"exit_code" integer,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_event" (
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"at" timestamp NOT NULL,
	"message" text,
	"data" text,
	"offset" bigint,
	CONSTRAINT "run_event_run_id_seq_pk" PRIMARY KEY("run_id","seq")
);
--> statement-breakpoint
CREATE TABLE "runner" (
	"id" text PRIMARY KEY NOT NULL,
	"pool" text NOT NULL,
	"labels" jsonb NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_claimed_by_runner_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."runner"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_event" ADD CONSTRAINT "run_event_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_queue_idx" ON "run" USING btree ("pool","state","created_at");--> statement-breakpoint
CREATE INDEX "run_lease_idx" ON "run" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "run_workspace_idx" ON "run" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "runner_pool_idx" ON "runner" USING btree ("pool");