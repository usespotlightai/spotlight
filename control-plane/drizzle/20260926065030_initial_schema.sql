CREATE TYPE "public"."change_stack_state" AS ENUM('drafting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."decision_kind" AS ENUM('trade-off', 'assumption', 'limitation', 'rejected-approach', 'deviation');--> statement-breakpoint
CREATE TYPE "public"."decision_standing" AS ENUM('proposed', 'stands');--> statement-breakpoint
CREATE TYPE "public"."review_comment_state" AS ENUM('draft', 'submitted', 'posted', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."review_side" AS ENUM('new', 'old');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('submitted', 'posted', 'failed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."review_sync_kind" AS ENUM('review', 'reply', 'file', 'edit', 'delete');--> statement-breakpoint
CREATE TYPE "public"."review_sync_state" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_verdict" AS ENUM('comment', 'approve', 'request-changes');--> statement-breakpoint
CREATE TYPE "public"."check_phase" AS ENUM('waiting', 'reordering', 'checked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."workspace_token_scope" AS ENUM('read', 'plan', 'configure', 'secrets', 'runners', 'trusts');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('queued', 'claimed', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "event_delivery" (
	"event_id" uuid NOT NULL,
	"subscriber" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"last_error" text,
	CONSTRAINT "event_delivery_event_id_subscriber_pk" PRIMARY KEY("event_id","subscriber")
);
--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotent_create" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "idempotent_create_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "catalog_call" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"run_id" text NOT NULL,
	"item" text NOT NULL,
	"called_at" timestamp NOT NULL,
	"ms" integer NOT NULL,
	"succeeded" boolean NOT NULL,
	"billable" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_plan" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"lapses_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "change_stack" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"task_id" text,
	"workspace_id" text NOT NULL,
	"repository" text,
	"base_commit" text,
	"state" "change_stack_state" NOT NULL,
	"files" jsonb NOT NULL,
	"cohorts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure" text,
	"drafted_at" timestamp NOT NULL,
	"settled_at" timestamp,
	"facts" jsonb NOT NULL,
	"check_command" text,
	"check_setup" text,
	"check_placement" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"check_placement_image" text,
	"reordering" boolean DEFAULT false NOT NULL,
	"work_attempts" integer DEFAULT 0 NOT NULL,
	"work_due_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "decision_kind" NOT NULL,
	"title" text NOT NULL,
	"why" text NOT NULL,
	"alternatives" jsonb NOT NULL,
	"paths" jsonb NOT NULL,
	"steps" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_dispute" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"path" text NOT NULL,
	"by_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_set" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"decided_in" text,
	"draft_run_id" text,
	"draft_asked_at" timestamp,
	"work_attempts" integer DEFAULT 0 NOT NULL,
	"work_due_at" timestamp,
	"standing" "decision_standing" DEFAULT 'proposed' NOT NULL,
	"merged_repository" text,
	"merged_commit" text,
	"merged_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"author_id" text,
	"author_run_id" text,
	"author_name" text,
	"verdict" "review_verdict" NOT NULL,
	"body" text NOT NULL,
	"comment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "review_state" NOT NULL,
	"github_id" bigint,
	"submitted_at" timestamp NOT NULL,
	"posted_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"path" text NOT NULL,
	"side" "review_side",
	"line" integer,
	"start_line" integer,
	"body" text NOT NULL,
	"author_id" text,
	"author_run_id" text,
	"author_login" text,
	"author_name" text NOT NULL,
	"reply_to_id" text,
	"review_id" text,
	"state" "review_comment_state" NOT NULL,
	"github_id" bigint,
	"github_url" text,
	"sent_body" text,
	"edit_pending" boolean DEFAULT false NOT NULL,
	"edits_awaiting_echo" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"edited_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "review_comment_lines_check" CHECK (("review_comment"."side" is null) = ("review_comment"."line" is null) and ("review_comment"."line" is not null or "review_comment"."start_line" is null))
);
--> statement-breakpoint
CREATE TABLE "review_sync" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"kind" "review_sync_kind" NOT NULL,
	"subject_id" text NOT NULL,
	"state" "review_sync_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp NOT NULL,
	"failure" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stack_check" (
	"stack_id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"command" text NOT NULL,
	"setup" text,
	"placement" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placement_image" text,
	"phase" "check_phase" NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rounds" integer DEFAULT 0 NOT NULL,
	"outcome" jsonb,
	"claimed_by" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp,
	"waiting_since" timestamp NOT NULL,
	"reserved_for" text,
	"reserved_pool" text,
	"reserved_until" timestamp,
	"provision_failures" integer DEFAULT 0 NOT NULL,
	"next_provision_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harness_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"key" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"mcp_servers" jsonb NOT NULL,
	"native" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"defined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "harness_profile_team_id_key_unique" UNIQUE("team_id","key")
);
--> statement-breakpoint
CREATE TABLE "integration_link" (
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"handle" text,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_link_team_id_source_pk" PRIMARY KEY("team_id","source")
);
--> statement-breakpoint
CREATE TABLE "skill_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"key" text NOT NULL,
	"files" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"defined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_definition_team_id_key_unique" UNIQUE("team_id","key")
);
--> statement-breakpoint
CREATE TABLE "github_connection" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_connection_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
CREATE TABLE "configuration_change" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text NOT NULL,
	"key" text NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"user_id" text,
	"token_id" text,
	"trust_id" text,
	"client" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" text,
	"revoked_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "team_invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
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
CREATE TABLE "workspace_member" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_member_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_token" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"scopes" "workspace_token_scope"[] NOT NULL,
	"token_hash" text NOT NULL,
	"issued_by" text NOT NULL,
	"issued_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"minted_through" text,
	"minted_under" integer,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "workspace_token_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "workspace_token_minted_under" CHECK (("workspace_token"."minted_through" is null) = ("workspace_token"."minted_under" is null))
);
--> statement-breakpoint
CREATE TABLE "workspace_token_trust" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"issuer" text NOT NULL,
	"audience" text NOT NULL,
	"subject" text NOT NULL,
	"claims" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scopes" "workspace_token_scope"[] NOT NULL,
	"lifetime_minutes" integer NOT NULL,
	"defined_by" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
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
	"due_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"failed" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"handled_at" timestamp,
	CONSTRAINT "inbound_delivery_source_team_id_id_pk" PRIMARY KEY("source","team_id","id")
);
--> statement-breakpoint
CREATE TABLE "host_connection" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"scopes" text DEFAULT '' NOT NULL,
	"handle" text,
	"renewal_refused_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "host_connection_team_id_source_pk" PRIMARY KEY("team_id","source")
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
CREATE TABLE "integration_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"definition" jsonb NOT NULL,
	"offers" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"defined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_definition_team_id_source_unique" UNIQUE("team_id","source")
);
--> statement-breakpoint
CREATE TABLE "oauth2_spent_nonce" (
	"nonce" text PRIMARY KEY NOT NULL,
	"until" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_token" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"given_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runner" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"pool_id" text,
	"trust_id" text,
	"host_id" text,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_hash" text NOT NULL,
	"egress_token_hash" text,
	"harnesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"advertised_models" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"harness_versions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image" text,
	"usual" boolean DEFAULT false NOT NULL,
	"work_kind" text,
	"work_id" text,
	"claim_by" timestamp NOT NULL,
	"started_at" timestamp NOT NULL,
	"last_seen_at" timestamp,
	"ended_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "runner_whole_work" CHECK (("runner"."work_kind" is null) = ("runner"."work_id" is null)),
	CONSTRAINT "runner_one_admission" CHECK (("runner"."pool_id" is null) <> ("runner"."trust_id" is null))
);
--> statement-breakpoint
CREATE TABLE "runner_host" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"pool_id" text,
	"trust_id" text,
	"name" text NOT NULL,
	"release" text NOT NULL,
	"executor" text NOT NULL,
	"capacity" integer NOT NULL,
	"running" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "runner_host_one_admission" CHECK (("runner_host"."pool_id" is null) <> ("runner_host"."trust_id" is null))
);
--> statement-breakpoint
CREATE TABLE "runner_pool" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_runs" integer,
	"token_hash" text,
	"token_version" integer,
	"provision_url" text,
	"provision_secret" text,
	"provision_secret_version" integer,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "runner_pool_one_mode" CHECK (("runner_pool"."token_hash" is null) <> ("runner_pool"."provision_url" is null) and ("runner_pool"."provision_url" is null) = ("runner_pool"."provision_secret" is null))
);
--> statement-breakpoint
CREATE TABLE "runner_trust" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"audience" text NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_runners" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"trusts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secret" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"source_secret_id" text,
	"source_field" text,
	"bindings" jsonb NOT NULL,
	"value_version" integer,
	"rotated_at" timestamp NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"defined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "secret_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "secret_data_key" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"key_id" text NOT NULL,
	"wrapped" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secret_grant" (
	"run_id" text NOT NULL,
	"secret_id" text NOT NULL,
	"host" text NOT NULL,
	"workspace_id" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "secret_grant_run_id_secret_id_host_pk" PRIMARY KEY("run_id","secret_id","host")
);
--> statement-breakpoint
CREATE TABLE "secret_value" (
	"secret_id" text PRIMARY KEY NOT NULL,
	"sealed" text NOT NULL,
	"kept_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text,
	"chat_id" text,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_claim_one_holder" CHECK (num_nonnulls("attachment_claim"."task_id", "attachment_claim"."chat_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"started_by_id" text NOT NULL,
	"title" text NOT NULL,
	"harness" text NOT NULL,
	"model" text,
	"effort" text,
	"repositories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_run_id" text,
	"session_id" text,
	"runner_id" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"message_position" integer NOT NULL,
	"place" integer NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"chat_id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"at" timestamp NOT NULL,
	"author_id" text,
	"run_id" text,
	"proposal" jsonb,
	"delivered_at" timestamp,
	CONSTRAINT "chat_message_chat_id_position_pk" PRIMARY KEY("chat_id","position")
);
--> statement-breakpoint
CREATE TABLE "line" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"reviews" jsonb,
	"runners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_reaction" (
	"line_id" text NOT NULL,
	"happening" text NOT NULL,
	"from_station_id" text,
	"to_station_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_repository" (
	"line_id" text NOT NULL,
	"repository" text NOT NULL,
	"image" text,
	"setup" text,
	CONSTRAINT "line_repository_line_id_repository_pk" PRIMARY KEY("line_id","repository")
);
--> statement-breakpoint
CREATE TABLE "station" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"line_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"color" text DEFAULT '#a3a8b0' NOT NULL,
	"description" text,
	"kind" text DEFAULT 'work' NOT NULL,
	"finishes" boolean DEFAULT false NOT NULL,
	"harness" text,
	"model" text,
	"effort" text,
	"profile" text,
	"agent_prompt" text,
	"check" text,
	"runners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"diffs" boolean DEFAULT false NOT NULL,
	"decisions" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "station_skill" (
	"station_id" text NOT NULL,
	"skill" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "station_skill_station_id_skill_pk" PRIMARY KEY("station_id","skill")
);
--> statement-breakpoint
CREATE TABLE "station_tool" (
	"station_id" text NOT NULL,
	"tool" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "station_tool_station_id_tool_pk" PRIMARY KEY("station_id","tool")
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"harness" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"task_id" text,
	"chat_id" text,
	"station_id" text,
	"state" "run_state" NOT NULL,
	"spec" jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"placement" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placement_image" text,
	"ran_in" text,
	"claimed_by" text,
	"lease_expires_at" timestamp,
	"stop_requested_at" timestamp,
	"reserved_for" text,
	"reserved_pool" text,
	"reserved_until" timestamp,
	"provision_failures" integer DEFAULT 0 NOT NULL,
	"next_provision_at" timestamp,
	"exit_code" integer,
	"message" text,
	"stopped" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
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
	CONSTRAINT "run_event_run_id_attempt_seq_pk" PRIMARY KEY("run_id","attempt","seq")
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
	"reviewing" boolean DEFAULT false NOT NULL,
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
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "task_mark_workspace_id_kind_value_pk" PRIMARY KEY("workspace_id","kind","value")
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
	"approval" jsonb,
	"answered_at" timestamp,
	"read_at" timestamp,
	"delivered_at" timestamp,
	CONSTRAINT "task_note_task_id_position_pk" PRIMARY KEY("task_id","position")
);
--> statement-breakpoint
CREATE TABLE "workspace_archive" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"continuity_key" text NOT NULL,
	"task_id" text,
	"station_id" text,
	"chat_id" text,
	"granted_to_run_id" text NOT NULL,
	"size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"granted_at" timestamp NOT NULL,
	"sealed_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DROP INDEX "account_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "event_delivery" ADD CONSTRAINT "event_delivery_event_id_event_outbox_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_set_id_decision_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."decision_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_dispute" ADD CONSTRAINT "decision_dispute_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_token" ADD CONSTRAINT "workspace_token_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_token_trust" ADD CONSTRAINT "workspace_token_trust_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_grant" ADD CONSTRAINT "secret_grant_secret_id_secret_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secret"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_value" ADD CONSTRAINT "secret_value_secret_id_secret_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secret"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_claim" ADD CONSTRAINT "attachment_claim_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_claim" ADD CONSTRAINT "attachment_claim_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reaction" ADD CONSTRAINT "line_reaction_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reaction" ADD CONSTRAINT "line_reaction_from_station_id_station_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reaction" ADD CONSTRAINT "line_reaction_to_station_id_station_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_repository" ADD CONSTRAINT "line_repository_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_route" ADD CONSTRAINT "station_route_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_route" ADD CONSTRAINT "station_route_to_station_id_station_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_skill" ADD CONSTRAINT "station_skill_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_tool" ADD CONSTRAINT "station_tool_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_digest" ADD CONSTRAINT "run_digest_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_event" ADD CONSTRAINT "run_event_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_raised_at_station_id_station_id_fk" FOREIGN KEY ("raised_at_station_id") REFERENCES "public"."station"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_mark" ADD CONSTRAINT "task_mark_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_delivery_due_idx" ON "event_delivery" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "catalog_call_workspace_called_idx" ON "catalog_call" USING btree ("workspace_id","called_at");--> statement-breakpoint
CREATE INDEX "change_stack_run_idx" ON "change_stack" USING btree ("run_id","drafted_at");--> statement-breakpoint
CREATE INDEX "change_stack_task_idx" ON "change_stack" USING btree ("task_id","drafted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_position_idx" ON "decision" USING btree ("set_id","position");--> statement-breakpoint
CREATE INDEX "decision_paths_idx" ON "decision" USING gin ("paths");--> statement-breakpoint
CREATE INDEX "decision_dispute_decision_idx" ON "decision_dispute" USING btree ("decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_set_task_idx" ON "decision_set" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "decision_set_draft_idx" ON "decision_set" USING btree ("draft_asked_at");--> statement-breakpoint
CREATE INDEX "decision_set_merged_idx" ON "decision_set" USING btree ("workspace_id","merged_repository","merged_at");--> statement-breakpoint
CREATE INDEX "review_task_idx" ON "review" USING btree ("task_id","submitted_at");--> statement-breakpoint
CREATE INDEX "review_comment_task_idx" ON "review_comment" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_comment_github_idx" ON "review_comment" USING btree ("workspace_id","github_id");--> statement-breakpoint
CREATE INDEX "review_sync_due_idx" ON "review_sync" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "review_sync_task_idx" ON "review_sync" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "stack_check_run_idx" ON "stack_check" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "stack_check_waiting_idx" ON "stack_check" USING btree ("workspace_id","phase");--> statement-breakpoint
CREATE INDEX "stack_check_reserved_idx" ON "stack_check" USING btree ("reserved_for");--> statement-breakpoint
CREATE INDEX "stack_check_overdue_idx" ON "stack_check" USING btree ("phase","waiting_since");--> statement-breakpoint
CREATE INDEX "configuration_change_workspace_idx" ON "configuration_change" USING btree ("workspace_id","seq");--> statement-breakpoint
CREATE INDEX "team_workspace_idx" ON "team" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_workspace_key_idx" ON "team" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_team_email_idx" ON "team_invite" USING btree ("team_id","email") WHERE "team_invite"."accepted_at" is null and "team_invite"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "team_invite_team_idx" ON "team_invite" USING btree ("team_id","email");--> statement-breakpoint
CREATE INDEX "team_invite_workspace_idx" ON "team_invite" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_member_user_idx" ON "workspace_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_token_workspace_name_idx" ON "workspace_token" USING btree ("workspace_id","name") WHERE "workspace_token"."minted_through" is null;--> statement-breakpoint
CREATE INDEX "workspace_token_minted_through_idx" ON "workspace_token" USING btree ("minted_through");--> statement-breakpoint
CREATE INDEX "workspace_token_minted_expiry_idx" ON "workspace_token" USING btree ("expires_at") WHERE "workspace_token"."minted_through" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_token_trust_workspace_key_idx" ON "workspace_token_trust" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "inbound_delivery_state_idx" ON "inbound_delivery" USING btree ("state","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_token_hash_idx" ON "runner" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_egress_token_hash_idx" ON "runner" USING btree ("egress_token_hash");--> statement-breakpoint
CREATE INDEX "runner_pool_standing_idx" ON "runner" USING btree ("pool_id") WHERE "runner"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "runner_work_idx" ON "runner" USING btree ("work_kind","work_id") WHERE "runner"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "runner_workspace_standing_idx" ON "runner" USING btree ("workspace_id") WHERE "runner"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "runner_host_workspace_idx" ON "runner_host" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "runner_host_pool_idx" ON "runner_host" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "runner_host_trust_idx" ON "runner_host" USING btree ("trust_id");--> statement-breakpoint
CREATE INDEX "runner_host_last_seen_idx" ON "runner_host" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_pool_workspace_key_idx" ON "runner_pool" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_pool_token_hash_idx" ON "runner_pool" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_trust_workspace_key_idx" ON "runner_trust" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_runners_workspace_idx" ON "workspace_runners" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "attachment_claim_task_idx" ON "attachment_claim" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "attachment_claim_chat_idx" ON "attachment_claim" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "chat_team_starter_idx" ON "chat" USING btree ("team_id","started_by_id","updated_at");--> statement-breakpoint
CREATE INDEX "chat_attachment_chat_idx" ON "chat_attachment" USING btree ("chat_id","message_position");--> statement-breakpoint
CREATE INDEX "line_team_idx" ON "line" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "line_workspace_idx" ON "line" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "line_team_key_idx" ON "line" USING btree ("team_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "line_team_role_idx" ON "line" USING btree ("team_id","role") WHERE "line"."role" is not null;--> statement-breakpoint
CREATE INDEX "line_reaction_line_idx" ON "line_reaction" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "line_repository_line_idx" ON "line_repository" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "station_line_idx" ON "station" USING btree ("line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "station_line_key_idx" ON "station" USING btree ("line_id","key");--> statement-breakpoint
CREATE INDEX "station_route_station_idx" ON "station_route" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_skill_station_idx" ON "station_skill" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_tool_station_idx" ON "station_tool" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "run_queue_idx" ON "run" USING btree ("harness","state","priority","created_at");--> statement-breakpoint
CREATE INDEX "run_lease_idx" ON "run" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "run_workspace_idx" ON "run" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_chat_idx" ON "run" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "run_reserved_idx" ON "run" USING btree ("reserved_for");--> statement-breakpoint
CREATE INDEX "task_station_idx" ON "task" USING btree ("station_id","rank");--> statement-breakpoint
CREATE INDEX "task_workspace_idx" ON "task" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_attachment_task_idx" ON "task_attachment" USING btree ("task_id","note_position");--> statement-breakpoint
CREATE INDEX "task_mark_task_idx" ON "task_mark" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_note_task_idx" ON "task_note" USING btree ("task_id","position");--> statement-breakpoint
CREATE INDEX "workspace_archive_continuity_idx" ON "workspace_archive" USING btree ("workspace_id","continuity_key","sealed_at");--> statement-breakpoint
CREATE INDEX "workspace_archive_task_idx" ON "workspace_archive" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "workspace_archive_chat_idx" ON "workspace_archive" USING btree ("chat_id");--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "issuer";