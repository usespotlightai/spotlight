CREATE TYPE "public"."run_state" AS ENUM('queued', 'claimed', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "assembly_line" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text DEFAULT 'default' NOT NULL,
	"workspace_id" text NOT NULL,
	"factory_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assembly_line_reaction" (
	"assembly_line_id" text NOT NULL,
	"happening" text NOT NULL,
	"from_station_id" text,
	"to_station_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assembly_line_repository" (
	"assembly_line_id" text NOT NULL,
	"repository" text NOT NULL,
	CONSTRAINT "assembly_line_repository_assembly_line_id_repository_pk" PRIMARY KEY("assembly_line_id","repository")
);
--> statement-breakpoint
CREATE TABLE "station" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text DEFAULT '' NOT NULL,
	"assembly_line_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"color" text DEFAULT '#a3a8b0' NOT NULL,
	"description" text,
	"kind" text DEFAULT 'work' NOT NULL,
	"finishes" boolean DEFAULT false NOT NULL,
	"harness" text,
	"model" text,
	"effort" text,
	"agent_prompt" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_route" (
	"station_id" text NOT NULL,
	"to_station_id" text NOT NULL,
	CONSTRAINT "station_route_station_id_to_station_id_pk" PRIMARY KEY("station_id","to_station_id")
);
--> statement-breakpoint
CREATE TABLE "station_tool" (
	"station_id" text NOT NULL,
	"tool" text NOT NULL,
	CONSTRAINT "station_tool_station_id_tool_pk" PRIMARY KEY("station_id","tool")
);
--> statement-breakpoint
CREATE TABLE "inbound_delivery" (
	"source" text NOT NULL,
	"workspace_id" text DEFAULT '' NOT NULL,
	"team_id" text DEFAULT '' NOT NULL,
	"team_key" text DEFAULT '' NOT NULL,
	"id" text NOT NULL,
	"headers" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"failed" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"handled_at" timestamp,
	CONSTRAINT "inbound_delivery_source_team_id_id_pk" PRIMARY KEY("source","team_id","id")
);
--> statement-breakpoint
CREATE TABLE "factory" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "factory_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
CREATE TABLE "integration_cursor" (
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"cursor" text,
	"ran_at" timestamp,
	CONSTRAINT "integration_cursor_team_id_source_pk" PRIMARY KEY("team_id","source")
);
--> statement-breakpoint
CREATE TABLE "oauth2_connection" (
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"scopes" text DEFAULT '' NOT NULL,
	"identity" text,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth2_connection_team_id_source_pk" PRIMARY KEY("team_id","source")
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"harness" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"task_id" text,
	"station_id" text,
	"state" "run_state" NOT NULL,
	"spec" jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"target_runner_id" text,
	"claimed_by" text,
	"lease_expires_at" timestamp,
	"stop_requested_at" timestamp,
	"exit_code" integer,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_digest" (
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"ms" integer,
	"steps" integer DEFAULT 0 NOT NULL,
	"faults" integer DEFAULT 0 NOT NULL,
	"used" integer,
	"size" integer,
	"cost" double precision,
	"currency" text,
	"readable" boolean DEFAULT true NOT NULL,
	"digested_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "run_digest_run_id_attempt_pk" PRIMARY KEY("run_id","attempt")
);
--> statement-breakpoint
CREATE TABLE "run_event" (
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
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
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"harnesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"advertised_models" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"station_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"rank" text DEFAULT 'i' NOT NULL,
	"raised_at_station_id" text,
	"raised_by_id" text,
	"assignee_id" text,
	"current_run_id" text,
	"session_id" text,
	"runner_id" text,
	"pull_request" text,
	"finished_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"note_position" integer,
	"place" integer NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_mark" (
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "task_mark_kind_value_pk" PRIMARY KEY("kind","value")
);
--> statement-breakpoint
CREATE TABLE "task_note" (
	"task_id" text NOT NULL,
	"position" integer NOT NULL,
	"station" text NOT NULL,
	"body" text NOT NULL,
	"at" timestamp NOT NULL,
	"voice" text DEFAULT 'station' NOT NULL,
	"author_id" text,
	"run_id" text,
	"kind" text NOT NULL,
	"form" text DEFAULT 'words' NOT NULL,
	"said" jsonb,
	"answered_at" timestamp,
	"read_at" timestamp,
	"delivered_at" timestamp,
	CONSTRAINT "task_note_task_id_position_pk" PRIMARY KEY("task_id","position")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"config_repository" text,
	"config_moving_to" text,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_config" (
	"team_id" text PRIMARY KEY NOT NULL,
	"repository" text NOT NULL,
	"sha" text NOT NULL,
	"files" jsonb NOT NULL,
	"problems" jsonb NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "team_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" text,
	"revoked_at" timestamp,
	CONSTRAINT "team_invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "team_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_secret" (
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"sealed" text NOT NULL,
	"set_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_secret_team_id_name_pk" PRIMARY KEY("team_id","name")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workspace_connection" (
	"workspace_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_connection_source_external_id_pk" PRIMARY KEY("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_member" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_member_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "assembly_line" ADD CONSTRAINT "assembly_line_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line" ADD CONSTRAINT "assembly_line_factory_id_factory_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line_reaction" ADD CONSTRAINT "assembly_line_reaction_assembly_line_id_assembly_line_id_fk" FOREIGN KEY ("assembly_line_id") REFERENCES "public"."assembly_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line_reaction" ADD CONSTRAINT "assembly_line_reaction_from_station_id_station_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line_reaction" ADD CONSTRAINT "assembly_line_reaction_to_station_id_station_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line_repository" ADD CONSTRAINT "assembly_line_repository_assembly_line_id_assembly_line_id_fk" FOREIGN KEY ("assembly_line_id") REFERENCES "public"."assembly_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_assembly_line_id_assembly_line_id_fk" FOREIGN KEY ("assembly_line_id") REFERENCES "public"."assembly_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_route" ADD CONSTRAINT "station_route_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_route" ADD CONSTRAINT "station_route_to_station_id_station_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_tool" ADD CONSTRAINT "station_tool_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory" ADD CONSTRAINT "factory_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory" ADD CONSTRAINT "factory_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_cursor" ADD CONSTRAINT "integration_cursor_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth2_connection" ADD CONSTRAINT "oauth2_connection_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_target_runner_id_runner_id_fk" FOREIGN KEY ("target_runner_id") REFERENCES "public"."runner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_claimed_by_runner_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."runner"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_digest" ADD CONSTRAINT "run_digest_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_event" ADD CONSTRAINT "run_event_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_raised_at_station_id_station_id_fk" FOREIGN KEY ("raised_at_station_id") REFERENCES "public"."station"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_raised_by_id_user_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_runner_id_runner_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runner"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_mark" ADD CONSTRAINT "task_mark_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_config" ADD CONSTRAINT "team_config_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_secret" ADD CONSTRAINT "team_secret_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_connection" ADD CONSTRAINT "workspace_connection_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assembly_line_factory_idx" ON "assembly_line" USING btree ("factory_id");--> statement-breakpoint
CREATE INDEX "assembly_line_workspace_idx" ON "assembly_line" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "assembly_line_reaction_line_idx" ON "assembly_line_reaction" USING btree ("assembly_line_id");--> statement-breakpoint
CREATE INDEX "assembly_line_repository_line_idx" ON "assembly_line_repository" USING btree ("assembly_line_id");--> statement-breakpoint
CREATE INDEX "station_assembly_line_idx" ON "station" USING btree ("assembly_line_id");--> statement-breakpoint
CREATE INDEX "station_route_station_idx" ON "station_route" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_tool_station_idx" ON "station_tool" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "inbound_delivery_state_idx" ON "inbound_delivery" USING btree ("state","received_at");--> statement-breakpoint
CREATE INDEX "factory_workspace_idx" ON "factory" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_queue_idx" ON "run" USING btree ("harness","state","priority","created_at");--> statement-breakpoint
CREATE INDEX "run_target_idx" ON "run" USING btree ("target_runner_id");--> statement-breakpoint
CREATE INDEX "run_lease_idx" ON "run" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "run_workspace_idx" ON "run" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_token_hash_idx" ON "runner" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "task_station_idx" ON "task" USING btree ("station_id","rank");--> statement-breakpoint
CREATE INDEX "task_workspace_idx" ON "task" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_attachment_task_idx" ON "task_attachment" USING btree ("task_id","note_position");--> statement-breakpoint
CREATE INDEX "task_mark_task_idx" ON "task_mark" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_note_task_idx" ON "task_note" USING btree ("task_id","position");--> statement-breakpoint
CREATE INDEX "team_workspace_idx" ON "team" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_workspace_key_idx" ON "team" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_team_email_idx" ON "team_invite" USING btree ("team_id","email");--> statement-breakpoint
CREATE INDEX "team_invite_workspace_idx" ON "team_invite" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_connection_workspace_source_idx" ON "workspace_connection" USING btree ("workspace_id","source");--> statement-breakpoint
CREATE INDEX "workspace_member_user_idx" ON "workspace_member" USING btree ("user_id");