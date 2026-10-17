CREATE TYPE "public"."change_stack_state" AS ENUM('drafting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."decision_kind" AS ENUM('trade-off', 'assumption', 'limitation', 'rejected-approach', 'deviation');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('proposed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."review_comment_state" AS ENUM('draft', 'submitted', 'posted', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."review_side" AS ENUM('new', 'old');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('submitted', 'posted', 'failed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."review_sync_kind" AS ENUM('review', 'reply', 'file', 'edit', 'delete');--> statement-breakpoint
CREATE TYPE "public"."review_sync_state" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_verdict" AS ENUM('comment', 'approve', 'request-changes');--> statement-breakpoint
CREATE TYPE "public"."check_phase" AS ENUM('waiting', 'reordering', 'checked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."github_pull_request_state" AS ENUM('open', 'merged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."workspace_token_scope" AS ENUM('read', 'plan', 'configure', 'secrets', 'runners', 'trusts');--> statement-breakpoint
CREATE TYPE "public"."memory_drafting_failure" AS ENUM('no-evidence', 'refused', 'unreadable', 'errored', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('rationale', 'rejected-approach', 'failure', 'environment', 'preference', 'correction');--> statement-breakpoint
CREATE TYPE "public"."memory_origin" AS ENUM('drafted', 'remembered');--> statement-breakpoint
CREATE TYPE "public"."memory_proposal_state" AS ENUM('proposed', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."memory_source" AS ENUM('person', 'run', 'outside');--> statement-breakpoint
CREATE TYPE "public"."memory_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."memory_use_way" AS ENUM('briefed', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."alert_measure" AS ENUM('sent_back_rate', 'accepted_rate', 'checks_failed_rate', 'failed_rate', 'merged_rate', 'cost_per_run');--> statement-breakpoint
CREATE TYPE "public"."alert_threshold" AS ENUM('risesBy', 'fallsBy', 'above', 'below');--> statement-breakpoint
CREATE TYPE "public"."judging_failure" AS ENUM('no-evidence', 'refused', 'unreadable', 'ungrounded', 'errored', 'interrupted', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."pair_order" AS ENUM('run-first', 'against-first');--> statement-breakpoint
CREATE TYPE "public"."pull_request_record_state" AS ENUM('open', 'merged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."run_record_act" AS ENUM('started', 'parked', 'closed', 'answered', 'sent-back');--> statement-breakpoint
CREATE TYPE "public"."run_record_checks" AS ENUM('passed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."run_record_ending" AS ENUM('completed', 'failed', 'stopped', 'abandoned', 'withdrawn', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."score_kind" AS ENUM('yes-no', 'number', 'claims');--> statement-breakpoint
CREATE TYPE "public"."score_source" AS ENUM('judge', 'person');--> statement-breakpoint
CREATE TYPE "public"."task_delivery_state" AS ENUM('open', 'merged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."config_pull_request_refusal" AS ENUM('no-source', 'repository-unreachable', 'file-missing', 'file-unparsable', 'block-not-found', 'blocks-ambiguous', 'computed-attribute', 'drifted', 'edit-failed', 'branch-taken', 'file-unwritable', 'github-refused');--> statement-breakpoint
CREATE TYPE "public"."config_pull_request_state" AS ENUM('opening', 'opened', 'refused');--> statement-breakpoint
CREATE TYPE "public"."replay_candidate_kind" AS ENUM('live', 'proposed', 'searched', 'planned', 'oracle');--> statement-breakpoint
CREATE TYPE "public"."replay_check_baseline" AS ENUM('awaiting', 'found', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."replay_run_outcome" AS ENUM('completed', 'failed', 'abandoned', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."replay_search_ending" AS ENUM('iterations-spent', 'ceiling-reached', 'stalled', 'stopped', 'station-gone', 'set-gone', 'seed-failed');--> statement-breakpoint
CREATE TYPE "public"."replay_search_iteration_kind" AS ENUM('propose', 'reflect');--> statement-breakpoint
CREATE TYPE "public"."replay_search_iteration_state" AS ENUM('wanted', 'running', 'ended', 'failed');--> statement-breakpoint
CREATE TYPE "public"."replay_search_objective" AS ENUM('success', 'cost');--> statement-breakpoint
CREATE TYPE "public"."replay_search_reflection_outcome" AS ENUM('went-on', 'no-config-cause', 'no-failures', 'did-not-run', 'out-of-budget');--> statement-breakpoint
CREATE TYPE "public"."replay_search_state" AS ENUM('seeding', 'searching', 'holding-out', 'finished', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."replay_state" AS ENUM('queued', 'running', 'finished', 'stopped', 'over-budget');--> statement-breakpoint
CREATE TYPE "public"."notice_form" AS ENUM('ended', 'advice');--> statement-breakpoint
CREATE TYPE "public"."replay_run_claimed" AS ENUM('queued', 'forgone', 'refused');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('queued', 'claimed', 'waiting', 'parked', 'completed', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."aside_form" AS ENUM('memories', 'grade', 'alert');--> statement-breakpoint
CREATE SEQUENCE "public"."memory_handle_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
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
	"cause" jsonb,
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
	"replay" boolean DEFAULT false NOT NULL,
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
	"spent" jsonb NOT NULL,
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
	"status" "decision_status" DEFAULT 'proposed' NOT NULL,
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
	"stack_id" text NOT NULL,
	"recheck" boolean DEFAULT false NOT NULL,
	"run_id" text NOT NULL,
	"task_id" text,
	"replay" boolean DEFAULT false NOT NULL,
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
	"claimed_at" timestamp,
	"waiting_since" timestamp NOT NULL,
	"reserved_for" text,
	"reserved_pool" text,
	"reserved_until" timestamp,
	"provision_failures" integer DEFAULT 0 NOT NULL,
	"next_provision_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stack_check_stack_id_recheck_pk" PRIMARY KEY("stack_id","recheck")
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
CREATE TABLE "github_pull_request" (
	"workspace_id" text NOT NULL,
	"url" text NOT NULL,
	"repository" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"author_is_bot" boolean DEFAULT false NOT NULL,
	"branch" text,
	"additions" integer,
	"deletions" integer,
	"changed_files" integer,
	"opened_at" timestamp NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"ready_for_review_at" timestamp,
	"draft_spells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "github_pull_request_state" NOT NULL,
	"closed_at" timestamp,
	"updated_at" timestamp NOT NULL,
	"reverts" jsonb,
	"reviews" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dismissed_reviews" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deleted_comments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bot_comments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"threads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reverted_by" text,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "github_pull_request_workspace_id_url_pk" PRIMARY KEY("workspace_id","url")
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
CREATE TABLE "workspace_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" text,
	"revoked_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "workspace_invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "workspace_invite_role" CHECK ("workspace_invite"."role" <> 'owner'),
	CONSTRAINT "workspace_invite_accepted_by" CHECK ("workspace_invite"."accepted_by" is null or "workspace_invite"."accepted_at" is not null),
	CONSTRAINT "workspace_invite_closed_once" CHECK (not ("workspace_invite"."accepted_at" is not null and "workspace_invite"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "workspace_invite_team" (
	"invite_id" text NOT NULL,
	"team_id" text NOT NULL,
	CONSTRAINT "workspace_invite_team_invite_id_team_id_pk" PRIMARY KEY("invite_id","team_id")
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
	"minted_for_run" text,
	"minted_for_attempt" integer,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "workspace_token_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "workspace_token_minted_under" CHECK (("workspace_token"."minted_through" is null) = ("workspace_token"."minted_under" is null)),
	CONSTRAINT "workspace_token_minted_for_attempt" CHECK (("workspace_token"."minted_for_run" is null) = ("workspace_token"."minted_for_attempt" is null)),
	CONSTRAINT "workspace_token_minted_once" CHECK ("workspace_token"."minted_through" is null or "workspace_token"."minted_for_run" is null)
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
CREATE TABLE "hook_callback" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"hook" text NOT NULL,
	"firing_id" text,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hook_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"key" text NOT NULL,
	"on" text NOT NULL,
	"definition" jsonb NOT NULL,
	"tools" jsonb NOT NULL,
	"signing_secret" text,
	"signing_secret_version" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"defined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hook_definition_team_id_key_unique" UNIQUE("team_id","key")
);
--> statement-breakpoint
CREATE TABLE "hook_firing" (
	"id" text PRIMARY KEY NOT NULL,
	"hook_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"task_id" text NOT NULL,
	"run_id" text,
	"station_key" text NOT NULL,
	"on" text NOT NULL,
	"occurrence" text NOT NULL,
	"event" jsonb NOT NULL,
	"matched" boolean DEFAULT true NOT NULL,
	"cause" jsonb NOT NULL,
	"link" jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"failure" text,
	"failed" text,
	"fired_at" timestamp DEFAULT now() NOT NULL,
	"handled_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "hook_firing_hook_id_occurrence_unique" UNIQUE("hook_id","occurrence")
);
--> statement-breakpoint
CREATE TABLE "described_document" (
	"hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"operations" integer NOT NULL,
	"passed_over" jsonb NOT NULL,
	"read_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "described_operation" (
	"hash" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"operation" jsonb NOT NULL,
	CONSTRAINT "described_operation_hash_name_pk" PRIMARY KEY("hash","name")
);
--> statement-breakpoint
CREATE TABLE "host_connection" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"holder" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"scopes" text DEFAULT '' NOT NULL,
	"handle" text,
	"renewal_refused_at" timestamp,
	"renewal_claimed_until" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "host_connection_team_id_source_holder_pk" PRIMARY KEY("team_id","source","holder")
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
	"source_fingerprint" text,
	"source_hash" text,
	"source_read_at" timestamp,
	"source_problem" text,
	"source_passed_over" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"defined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_definition_team_id_source_unique" UNIQUE("team_id","source")
);
--> statement-breakpoint
CREATE TABLE "learned_output" (
	"team_id" text NOT NULL,
	"tool" text NOT NULL,
	"source" text NOT NULL,
	"shape" jsonb NOT NULL,
	"calls" integer NOT NULL,
	"learned_at" timestamp NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "learned_output_team_id_tool_pk" PRIMARY KEY("team_id","tool")
);
--> statement-breakpoint
CREATE TABLE "oauth2_client_registration" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"registration_endpoint" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"issuer" text,
	"authorize_endpoint" text,
	"token_endpoint" text,
	"client_id" text NOT NULL,
	"client_secret" text,
	"secret_expires_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth2_client_registration_team_id_source_pk" PRIMARY KEY("team_id","source")
);
--> statement-breakpoint
CREATE TABLE "oauth2_spent_nonce" (
	"nonce" text PRIMARY KEY NOT NULL,
	"until" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_tool_policy" (
	"team_id" text NOT NULL,
	"person_id" text NOT NULL,
	"source" text NOT NULL,
	"rules" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "person_tool_policy_team_id_person_id_source_pk" PRIMARY KEY("team_id","person_id","source")
);
--> statement-breakpoint
CREATE TABLE "memory" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" integer NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"body" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text,
	"station_id" text,
	"repository" text,
	"paths" jsonb NOT NULL,
	"task_id" text,
	"run_id" text,
	"steps" jsonb,
	"notes" jsonb,
	"source" "memory_source" NOT NULL,
	"supersedes" text,
	"status" "memory_status" DEFAULT 'active' NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp NOT NULL,
	"retired_at" timestamp,
	"retired_by" text,
	"retire_reason" text,
	"superseded_by" text,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"drafting_run_id" text,
	"drafting_asked_at" timestamp,
	"work_attempts" integer DEFAULT 0 NOT NULL,
	"work_due_at" timestamp,
	"drafted_in" text,
	"notes_read" integer DEFAULT 0 NOT NULL,
	"failure" "memory_drafting_failure",
	"failed_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"body" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text,
	"station_id" text,
	"repository" text,
	"paths" jsonb NOT NULL,
	"task_id" text NOT NULL,
	"run_id" text NOT NULL,
	"steps" jsonb NOT NULL,
	"notes" jsonb NOT NULL,
	"source" "memory_source" NOT NULL,
	"origin" "memory_origin" NOT NULL,
	"supersedes" text,
	"recorded_at" timestamp NOT NULL,
	"state" "memory_proposal_state" DEFAULT 'proposed' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "memory_use" (
	"memory_id" text NOT NULL,
	"run_id" text NOT NULL,
	"way" "memory_use_way" NOT NULL,
	"at" timestamp NOT NULL,
	CONSTRAINT "memory_use_memory_id_run_id_way_pk" PRIMARY KEY("memory_id","run_id","way")
);
--> statement-breakpoint
CREATE TABLE "change_judging" (
	"run_id" text NOT NULL,
	"round" integer NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"rubric" text,
	"claims" jsonb NOT NULL,
	"pass_share" double precision NOT NULL,
	"reference_run_id" text,
	"spent" jsonb NOT NULL,
	"asked_at" timestamp NOT NULL,
	"owed" boolean NOT NULL,
	"work_attempts" integer DEFAULT 0 NOT NULL,
	"work_due_at" timestamp,
	"judged_at" timestamp,
	"failure" "judging_failure",
	"failed_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "change_judging_run_id_round_pk" PRIMARY KEY("run_id","round")
);
--> statement-breakpoint
CREATE TABLE "chat_record" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"started_by" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forgotten_pull_request" (
	"workspace_id" text NOT NULL,
	"pull_request" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "forgotten_pull_request_workspace_id_pull_request_pk" PRIMARY KEY("workspace_id","pull_request")
);
--> statement-breakpoint
CREATE TABLE "forgotten_task" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forgotten_team" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	CONSTRAINT "forgotten_team_workspace_id_team_id_pk" PRIMARY KEY("workspace_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "forgotten_workspace" (
	"workspace_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judging" (
	"run_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"task_id" text NOT NULL,
	"fingerprint" text,
	"rubric" text,
	"claims" jsonb NOT NULL,
	"pass_share" double precision NOT NULL,
	"rubric_version" text NOT NULL,
	"asked_at" timestamp NOT NULL,
	"owed" boolean NOT NULL,
	"work_attempts" integer DEFAULT 0 NOT NULL,
	"work_due_at" timestamp,
	"judged_at" timestamp,
	"failure" "judging_failure",
	"failed_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pair_judging" (
	"run_id" text NOT NULL,
	"against_run_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"rubric" text,
	"claims" jsonb NOT NULL,
	"pass_share" double precision NOT NULL,
	"reference_run_id" text NOT NULL,
	"most_attempts" integer NOT NULL,
	"shown_order" "pair_order" NOT NULL,
	"spent" jsonb NOT NULL,
	"asked_at" timestamp NOT NULL,
	"owed" boolean NOT NULL,
	"work_attempts" integer DEFAULT 0 NOT NULL,
	"work_due_at" timestamp,
	"judged_at" timestamp,
	"failure" "judging_failure",
	"failed_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pair_judging_run_id_against_run_id_pk" PRIMARY KEY("run_id","against_run_id")
);
--> statement-breakpoint
CREATE TABLE "pending_review" (
	"workspace_id" text NOT NULL,
	"pull_request" text NOT NULL,
	"at" timestamp NOT NULL,
	CONSTRAINT "pending_review_workspace_id_pull_request_at_pk" PRIMARY KEY("workspace_id","pull_request","at")
);
--> statement-breakpoint
CREATE TABLE "pull_request_record" (
	"workspace_id" text NOT NULL,
	"pull_request" text NOT NULL,
	"repository" text,
	"number" integer,
	"title" text,
	"author" text,
	"author_is_bot" boolean DEFAULT false NOT NULL,
	"branch" text,
	"additions" integer,
	"deletions" integer,
	"changed_files" integer,
	"opened_at" timestamp,
	"state" "pull_request_record_state",
	"closed_at" timestamp,
	"updated_at" timestamp,
	"ready_for_review_at" timestamp,
	"draft_spells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_review_at" timestamp,
	"first_unblocking_review_at" timestamp,
	"first_approved_at" timestamp,
	"human_reviewed_at" timestamp[] DEFAULT '{}' NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"review_rounds" integer DEFAULT 0 NOT NULL,
	"review_comments" integer DEFAULT 0 NOT NULL,
	"bot_activity" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_revert" boolean DEFAULT false NOT NULL,
	"reverted_by" text,
	"seen_version" integer,
	"owner_task_id" text,
	"owner_team_id" text,
	"review_task_ids" text[] DEFAULT '{}' NOT NULL,
	"github_forgot_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pull_request_record_workspace_id_pull_request_pk" PRIMARY KEY("workspace_id","pull_request")
);
--> statement-breakpoint
CREATE TABLE "run_fact" (
	"run_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"task_id" text NOT NULL,
	"fingerprint" text,
	"harness" text NOT NULL,
	"model" text,
	"effort" text,
	"profile_key" text,
	"repositories" jsonb NOT NULL,
	"skills" jsonb NOT NULL,
	"queued_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp NOT NULL,
	"began_at" timestamp NOT NULL,
	"ending" "run_record_ending" NOT NULL,
	"ran" boolean NOT NULL,
	"failure" text,
	"round" integer NOT NULL,
	"asked" boolean NOT NULL,
	"superseded_at" timestamp,
	"checks" "run_record_checks",
	"checked_at" timestamp,
	"next_act" "run_record_act",
	"next_at" timestamp,
	"approval_answered_at" timestamp,
	"handed_on_to" text,
	"handed_on_at" timestamp,
	"digested" boolean NOT NULL,
	"ms" integer,
	"steps" integer,
	"faults" integer,
	"changed_lines" integer,
	"used" integer,
	"size" integer,
	"cost" double precision,
	"currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"tools" jsonb,
	"refusals" jsonb NOT NULL,
	"memories" jsonb NOT NULL,
	"opened_by" text,
	"task_opened_at" timestamp,
	"pull_request" text,
	"delivery_state" "task_delivery_state",
	"delivery_opened_at" timestamp,
	"delivery_closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "run_record" (
	"run_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text,
	"line_id" text,
	"station_id" text,
	"task_id" text,
	"fingerprint" text,
	"harness" text,
	"model" text,
	"effort" text,
	"profile_key" text,
	"repositories" jsonb,
	"skills" jsonb,
	"queued_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"ending" "run_record_ending",
	"failure" text,
	"round" integer,
	"asked" boolean DEFAULT false NOT NULL,
	"superseded_at" timestamp,
	"checks" "run_record_checks",
	"checked_at" timestamp,
	"next_act" "run_record_act",
	"next_at" timestamp,
	"approval_answered_at" timestamp,
	"handed_on_to" text,
	"handed_on_at" timestamp,
	"digested" boolean DEFAULT false NOT NULL,
	"ms" integer,
	"steps" integer,
	"faults" integer,
	"changed_lines" integer,
	"used" integer,
	"size" integer,
	"cost" double precision,
	"currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"tools" jsonb,
	"refusals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memories" jsonb DEFAULT '{"briefed":[],"recalled":[]}'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"task_id" text NOT NULL,
	"fingerprint" text,
	"source" "score_source" NOT NULL,
	"kind" "score_kind" NOT NULL,
	"value" double precision NOT NULL,
	"marks" jsonb,
	"rubric_version" text,
	"model" text,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seen" jsonb DEFAULT '{"steps":[],"hunks":[]}'::jsonb NOT NULL,
	"by" text,
	"at" timestamp NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"measure" "alert_measure" NOT NULL,
	"threshold" "alert_threshold" NOT NULL,
	"amount" double precision NOT NULL,
	"over" integer NOT NULL,
	"value" double precision NOT NULL,
	"baseline" double precision,
	"run_id" text NOT NULL,
	"task_id" text NOT NULL,
	"raised_at" timestamp NOT NULL,
	"recovered_at" timestamp,
	"clear_runs" integer DEFAULT 0 NOT NULL,
	"last_seen_run_id" text
);
--> statement-breakpoint
CREATE TABLE "station_config_pull_request" (
	"config_pull_request_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"station_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"url" text NOT NULL,
	"opened_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_watch" (
	"station_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_change_shape" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"change_titles" text[] DEFAULT '{}' NOT NULL,
	"change_intents" text[] DEFAULT '{}' NOT NULL,
	"shaped_at" timestamp NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_delivery" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"pull_request" text NOT NULL,
	"state" "task_delivery_state" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp NOT NULL,
	"first_review_at" timestamp,
	"closed_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_failures" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"occurrences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_touches" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text,
	"line_id" text,
	"station_id" text,
	"opened_by" text,
	"opened_at" timestamp,
	"asks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"touched_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_pull_request" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"search_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"station_key" text NOT NULL,
	"candidate_name" text NOT NULL,
	"repository" text,
	"path" text,
	"branch" text NOT NULL,
	"state" "config_pull_request_state" NOT NULL,
	"url" text,
	"refusal" "config_pull_request_refusal",
	"refusal_message" text,
	"refusal_attribute" text,
	"refusal_expression" text,
	"refusal_wanted" jsonb,
	"attempts" integer NOT NULL,
	"tries" integer NOT NULL,
	"last_commit" text,
	"due_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"set_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"baseline" boolean NOT NULL,
	"judges" boolean NOT NULL,
	"checked" boolean NOT NULL,
	"rubric_version" text,
	"scoring_digest" text NOT NULL,
	"ceiling_amount" double precision NOT NULL,
	"ceiling_currency" text NOT NULL,
	"unpriced_rate" double precision,
	"among" jsonb,
	"answers" jsonb,
	"repeats" integer NOT NULL,
	"probe" boolean DEFAULT false NOT NULL,
	"compared_with" text,
	"pairs_with" text,
	"search_id" text,
	"state" "replay_state" NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"stopped_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_candidate" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"team_key" text NOT NULL,
	"line_key" text NOT NULL,
	"station_key" text NOT NULL,
	"name" text NOT NULL,
	"kind" "replay_candidate_kind" NOT NULL,
	"station" jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"behaviour_digest" text NOT NULL,
	"scoring_digest" text NOT NULL,
	"line_fields" jsonb,
	"checks_changes" boolean NOT NULL,
	"rubric" text,
	"claims" jsonb,
	"pass_share" double precision,
	"rubric_version" text,
	"changed_from" text NOT NULL,
	"changes" jsonb NOT NULL,
	"search_id" text,
	"iteration" integer,
	"hypothesis" text,
	"reference_commit" text,
	"reference_pull_request" integer,
	"created_at" timestamp NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_check" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"station_key" text NOT NULL,
	"set_id" text NOT NULL,
	"set_entries" text NOT NULL,
	"attempt" integer NOT NULL,
	"candidate_id" text NOT NULL,
	"replay_id" text NOT NULL,
	"reference_commit" text,
	"reference_pull_request" integer,
	"live_fingerprint" text NOT NULL,
	"candidate_fingerprint" text NOT NULL,
	"live_behaviour" text NOT NULL,
	"live_scoring" text NOT NULL,
	"candidate_behaviour" text NOT NULL,
	"candidate_scoring" text NOT NULL,
	"most_regressions" integer NOT NULL,
	"min_gain" double precision NOT NULL,
	"ceiling_amount" double precision NOT NULL,
	"ceiling_currency" text NOT NULL,
	"repeats" integer NOT NULL,
	"kept_live" jsonb NOT NULL,
	"baseline" "replay_check_baseline" NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_entry" (
	"replay_id" text NOT NULL,
	"position" integer NOT NULL,
	"original_run_id" text NOT NULL,
	"task_id" text NOT NULL,
	"repeat" integer NOT NULL,
	"run_id" text,
	"queued" boolean DEFAULT false NOT NULL,
	"fingerprint" text,
	"queue_attempts" integer DEFAULT 0 NOT NULL,
	"refusal" text,
	"not_run" boolean DEFAULT false NOT NULL,
	"outcome" "replay_run_outcome",
	"failure" text,
	"stopped" boolean,
	"asked" boolean,
	"next" text,
	"ended_at" timestamp,
	"measured" boolean DEFAULT false NOT NULL,
	"ms" double precision,
	"steps" integer,
	"changed_lines" integer,
	"cost_amount" double precision,
	"cost_currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"checks" jsonb,
	"drafting_spent" jsonb,
	"judging_spent" jsonb,
	"judging" jsonb,
	"succeeded" boolean,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"second_judging" jsonb,
	"rejudging_spent" jsonb,
	"recheck" jsonb,
	"pairing" jsonb,
	"pairing_spent" jsonb,
	CONSTRAINT "replay_entry_replay_id_position_pk" PRIMARY KEY("replay_id","position")
);
--> statement-breakpoint
CREATE TABLE "replay_search" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"set_id" text NOT NULL,
	"harness" text NOT NULL,
	"model" text,
	"effort" text,
	"iterations" integer NOT NULL,
	"per_iteration" integer NOT NULL,
	"ceiling_amount" double precision NOT NULL,
	"ceiling_currency" text NOT NULL,
	"concurrency" integer NOT NULL,
	"repeats" integer NOT NULL,
	"objective" "replay_search_objective" NOT NULL,
	"split" jsonb NOT NULL,
	"seed_candidate_id" text NOT NULL,
	"seed_fingerprint" text NOT NULL,
	"seed_replay" jsonb NOT NULL,
	"held_out" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "replay_search_state" NOT NULL,
	"ending" "replay_search_ending",
	"started_by" text,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_search_iteration" (
	"search_id" text NOT NULL,
	"number" integer NOT NULL,
	"run_id" text NOT NULL,
	"kind" "replay_search_iteration_kind" NOT NULL,
	"state" "replay_search_iteration_state" NOT NULL,
	"proposals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"agent_spent" jsonb,
	"incumbent" text,
	"outcome" "replay_search_reflection_outcome",
	"reflected_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"causes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "replay_search_iteration_search_id_number_pk" PRIMARY KEY("search_id","number")
);
--> statement-breakpoint
CREATE TABLE "replay_set" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"name" text NOT NULL,
	"guards_changes" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"station_gone_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_set_entry" (
	"set_id" text NOT NULL,
	"run_id" text NOT NULL,
	"task_id" text NOT NULL,
	"added_at" timestamp NOT NULL,
	CONSTRAINT "replay_set_entry_set_id_run_id_pk" PRIMARY KEY("set_id","run_id")
);
--> statement-breakpoint
CREATE TABLE "egress" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_version" integer,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egress_token" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"egress_id" text NOT NULL,
	"given_at" timestamp DEFAULT now() NOT NULL
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
	"proxy_credential_hash" text,
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
	"session" text NOT NULL,
	"first_seen_at" timestamp NOT NULL,
	"up_since" timestamp NOT NULL,
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
	"provision_egress" text,
	"provision_egress_traffic" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "runner_pool_one_mode" CHECK (("runner_pool"."token_hash" is null) <> ("runner_pool"."provision_url" is null) and ("runner_pool"."provision_url" is null) = ("runner_pool"."provision_secret" is null)),
	CONSTRAINT "runner_pool_egress_pushes" CHECK ("runner_pool"."provision_egress" is null or "runner_pool"."provision_url" is not null)
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
CREATE TABLE "run_grants" (
	"run_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"recipient" text,
	"fetched_by_egress_id" text,
	"lease_lost" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL
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
	CONSTRAINT "secret_grant_run_id_secret_id_host_pk" PRIMARY KEY("run_id","secret_id","host")
);
--> statement-breakpoint
CREATE TABLE "secret_value" (
	"secret_id" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"stored_at" timestamp DEFAULT now() NOT NULL
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
	"improving" jsonb,
	"setup" jsonb,
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
	"traces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal" jsonb,
	"delivered_at" timestamp,
	"delivered_to" text,
	CONSTRAINT "chat_message_chat_id_position_pk" PRIMARY KEY("chat_id","position")
);
--> statement-breakpoint
CREATE TABLE "heard_happening" (
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"heard_at" timestamp NOT NULL,
	CONSTRAINT "heard_happening_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
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
	"replay_check" jsonb,
	"source" jsonb,
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
	"memories" boolean DEFAULT false NOT NULL,
	"judge" jsonb,
	"alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
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
CREATE TABLE "network_call" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"method" text NOT NULL,
	"url" text NOT NULL,
	"headers" jsonb NOT NULL,
	"body" text NOT NULL,
	"timeout_ms" integer NOT NULL,
	"queued_at" timestamp NOT NULL,
	"lapses_at" timestamp NOT NULL,
	"state" text NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp,
	"answered_at" timestamp,
	"answer_status" integer,
	"answer_headers" jsonb,
	"answer_body" text,
	"answer_ms" integer,
	"answer_error" text,
	"lapsed_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"form" "notice_form" NOT NULL,
	"subject" text NOT NULL,
	"link" text NOT NULL,
	"link_label" text NOT NULL,
	"headline" text NOT NULL,
	"points" jsonb NOT NULL,
	"raised_at" timestamp NOT NULL,
	"settled_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_run_claim" (
	"run_id" text PRIMARY KEY NOT NULL,
	"claimed_as" "replay_run_claimed" NOT NULL,
	"refusal" text,
	"reason" text,
	"claimed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_connection" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"bytes_out" bigint NOT NULL,
	"bytes_in" bigint NOT NULL,
	"ms" integer NOT NULL,
	"outcome" text NOT NULL,
	"status" integer,
	"reason" text,
	"at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"harness" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"task_id" text,
	"task_revision" integer,
	"chat_id" text,
	"replay_of_run_id" text,
	"ran_for_team_id" text,
	"search_id" text,
	"search_iteration" integer,
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
	"hand_backs" integer DEFAULT 0 NOT NULL,
	"parked_attempts" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"briefed_memories" jsonb DEFAULT '{"briefed":[],"cut":[]}'::jsonb NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"station_fingerprint" text,
	"station_config" jsonb,
	"briefed_task" jsonb,
	"started_from_archive_id" text,
	"started_from_checkouts" jsonb,
	"started_from_attempt" integer,
	"started_from_at" timestamp,
	"asked_a_person" boolean DEFAULT false NOT NULL,
	"claimable_from" timestamp,
	"exit_code" integer,
	"message" text,
	"failure" text,
	"stopped" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "run_station_config_check" CHECK (("run"."station_config" is null) = ("run"."station_fingerprint" is null))
);
--> statement-breakpoint
CREATE TABLE "run_digest" (
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"ms" integer,
	"steps" integer DEFAULT 0 NOT NULL,
	"faults" integer DEFAULT 0 NOT NULL,
	"changed_lines" integer DEFAULT 0 NOT NULL,
	"used" integer,
	"size" integer,
	"cost" double precision,
	"currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"tools" jsonb DEFAULT '{"servers":[],"skills":[]}'::jsonb NOT NULL,
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
CREATE TABLE "starting_point_hold" (
	"holder" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"run_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_aside" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"form" "aside_form" NOT NULL,
	"about" text NOT NULL,
	"raised_at" timestamp NOT NULL,
	"settled_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_aside_read" (
	"aside_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp NOT NULL,
	CONSTRAINT "task_aside_read_aside_id_user_id_pk" PRIMARY KEY("aside_id","user_id")
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
	"opened_from" text NOT NULL,
	"assignee_id" text,
	"current_run_id" text,
	"session_id" text,
	"runner_id" text,
	"pull_request" text,
	"reviewing" boolean DEFAULT false NOT NULL,
	"review_from_outside" boolean DEFAULT false NOT NULL,
	"finished_at" timestamp,
	"revision" integer DEFAULT 0 NOT NULL,
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
	"failure" jsonb,
	"deferred_move" jsonb,
	"connection_ask" jsonb,
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
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_team" ADD CONSTRAINT "workspace_invite_team_invite_id_workspace_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."workspace_invite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_team" ADD CONSTRAINT "workspace_invite_team_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_token" ADD CONSTRAINT "workspace_token_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_token_trust" ADD CONSTRAINT "workspace_token_trust_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hook_firing" ADD CONSTRAINT "hook_firing_hook_id_hook_definition_id_fk" FOREIGN KEY ("hook_id") REFERENCES "public"."hook_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "described_operation" ADD CONSTRAINT "described_operation_hash_described_document_hash_fk" FOREIGN KEY ("hash") REFERENCES "public"."described_document"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_proposal" ADD CONSTRAINT "memory_proposal_draft_id_memory_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."memory_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_use" ADD CONSTRAINT "memory_use_memory_id_memory_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_alert" ADD CONSTRAINT "station_alert_station_id_station_watch_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station_watch"("station_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_entry" ADD CONSTRAINT "replay_entry_replay_id_replay_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."replay"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_search_iteration" ADD CONSTRAINT "replay_search_iteration_search_id_replay_search_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."replay_search"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_set_entry" ADD CONSTRAINT "replay_set_entry_set_id_replay_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."replay_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_grant" ADD CONSTRAINT "secret_grant_run_id_run_grants_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run_grants"("run_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "run_connection" ADD CONSTRAINT "run_connection_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_replay_of_run_id_run_id_fk" FOREIGN KEY ("replay_of_run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_digest" ADD CONSTRAINT "run_digest_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_event" ADD CONSTRAINT "run_event_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_aside" ADD CONSTRAINT "task_aside_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_aside_read" ADD CONSTRAINT "task_aside_read_aside_id_task_aside_id_fk" FOREIGN KEY ("aside_id") REFERENCES "public"."task_aside"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_raised_at_station_id_station_id_fk" FOREIGN KEY ("raised_at_station_id") REFERENCES "public"."station"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_mark" ADD CONSTRAINT "task_mark_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_delivery_due_idx" ON "event_delivery" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "event_delivery_owed_idx" ON "event_delivery" USING btree ("subscriber") WHERE "event_delivery"."delivered_at" is null;--> statement-breakpoint
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
CREATE INDEX "stack_check_task_idx" ON "stack_check" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "stack_check_waiting_idx" ON "stack_check" USING btree ("workspace_id","phase");--> statement-breakpoint
CREATE INDEX "stack_check_reserved_idx" ON "stack_check" USING btree ("reserved_for");--> statement-breakpoint
CREATE INDEX "stack_check_overdue_idx" ON "stack_check" USING btree ("phase","waiting_since");--> statement-breakpoint
CREATE INDEX "github_pull_request_number_idx" ON "github_pull_request" USING btree ("workspace_id","repository","number");--> statement-breakpoint
CREATE INDEX "github_pull_request_closed_idx" ON "github_pull_request" USING btree ("closed_at");--> statement-breakpoint
CREATE INDEX "github_pull_request_updated_idx" ON "github_pull_request" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "configuration_change_workspace_idx" ON "configuration_change" USING btree ("workspace_id","seq");--> statement-breakpoint
CREATE INDEX "team_workspace_idx" ON "team" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_workspace_key_idx" ON "team" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invite_workspace_email_idx" ON "workspace_invite" USING btree ("workspace_id",lower("email")) WHERE "workspace_invite"."accepted_at" is null and "workspace_invite"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "workspace_invite_workspace_idx" ON "workspace_invite" USING btree ("workspace_id","invited_at");--> statement-breakpoint
CREATE INDEX "workspace_invite_team_team_idx" ON "workspace_invite_team" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "workspace_member_user_idx" ON "workspace_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_token_workspace_name_idx" ON "workspace_token" USING btree ("workspace_id","name") WHERE "workspace_token"."minted_through" is null and "workspace_token"."minted_for_run" is null;--> statement-breakpoint
CREATE INDEX "workspace_token_minted_for_run_idx" ON "workspace_token" USING btree ("minted_for_run");--> statement-breakpoint
CREATE INDEX "workspace_token_minted_through_idx" ON "workspace_token" USING btree ("minted_through");--> statement-breakpoint
CREATE INDEX "workspace_token_minted_expiry_idx" ON "workspace_token" USING btree ("expires_at") WHERE "workspace_token"."minted_through" is not null or "workspace_token"."minted_for_run" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_token_trust_workspace_key_idx" ON "workspace_token_trust" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "inbound_delivery_state_idx" ON "inbound_delivery" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "hook_callback_expires_idx" ON "hook_callback" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "hook_definition_on_idx" ON "hook_definition" USING btree ("team_id","on");--> statement-breakpoint
CREATE INDEX "hook_firing_state_idx" ON "hook_firing" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "hook_firing_repeats_idx" ON "hook_firing" USING btree ("hook_id","task_id","fired_at");--> statement-breakpoint
CREATE INDEX "host_connection_holder_idx" ON "host_connection" USING btree ("team_id","holder");--> statement-breakpoint
CREATE INDEX "learned_output_source_idx" ON "learned_output" USING btree ("team_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_handle_idx" ON "memory" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_supersedes_idx" ON "memory" USING btree ("supersedes");--> statement-breakpoint
CREATE INDEX "memory_status_idx" ON "memory" USING btree ("team_id","status","approved_at");--> statement-breakpoint
CREATE INDEX "memory_body_search_idx" ON "memory" USING gin (to_tsvector('english', "body"));--> statement-breakpoint
CREATE UNIQUE INDEX "memory_draft_task_idx" ON "memory_draft" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "memory_draft_drafting_idx" ON "memory_draft" USING btree ("drafting_asked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_proposal_position_idx" ON "memory_proposal" USING btree ("draft_id","position");--> statement-breakpoint
CREATE INDEX "memory_proposal_decided_idx" ON "memory_proposal" USING btree ("team_id","state","decided_at");--> statement-breakpoint
CREATE INDEX "memory_use_run_idx" ON "memory_use" USING btree ("run_id","at");--> statement-breakpoint
CREATE INDEX "change_judging_owed_idx" ON "change_judging" USING btree ("asked_at") WHERE "change_judging"."owed";--> statement-breakpoint
CREATE INDEX "change_judging_workspace_idx" ON "change_judging" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "chat_record_team_idx" ON "chat_record" USING btree ("team_id","started_at");--> statement-breakpoint
CREATE INDEX "chat_record_workspace_idx" ON "chat_record" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "forgotten_pull_request_updated_idx" ON "forgotten_pull_request" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "forgotten_task_workspace_idx" ON "forgotten_task" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "judging_owed_idx" ON "judging" USING btree ("asked_at") WHERE "judging"."owed";--> statement-breakpoint
CREATE INDEX "judging_task_idx" ON "judging" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "judging_workspace_idx" ON "judging" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "pair_judging_owed_idx" ON "pair_judging" USING btree ("asked_at") WHERE "pair_judging"."owed";--> statement-breakpoint
CREATE INDEX "pair_judging_workspace_idx" ON "pair_judging" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "pull_request_record_opened_idx" ON "pull_request_record" USING btree ("workspace_id","opened_at");--> statement-breakpoint
CREATE INDEX "pull_request_record_repository_idx" ON "pull_request_record" USING btree ("workspace_id","repository");--> statement-breakpoint
CREATE INDEX "pull_request_record_owner_idx" ON "pull_request_record" USING btree ("owner_task_id");--> statement-breakpoint
CREATE INDEX "pull_request_record_team_idx" ON "pull_request_record" USING btree ("owner_team_id");--> statement-breakpoint
CREATE INDEX "pull_request_record_review_tasks_idx" ON "pull_request_record" USING gin ("review_task_ids");--> statement-breakpoint
CREATE INDEX "run_fact_team_ended_idx" ON "run_fact" USING btree ("workspace_id","team_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_fact_ended_idx" ON "run_fact" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "run_fact_station_began_idx" ON "run_fact" USING btree ("workspace_id","team_id","station_id","began_at");--> statement-breakpoint
CREATE INDEX "run_fact_task_idx" ON "run_fact" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "run_record_team_idx" ON "run_record" USING btree ("team_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_record_station_idx" ON "run_record" USING btree ("station_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_record_team_station_began_idx" ON "run_record" USING btree ("team_id","station_id",coalesce("started_at", "ended_at"),"run_id" collate "C","fingerprint","started_at","ended_at") WHERE "run_record"."started_at" is not null and "run_record"."ended_at" is not null and "run_record"."fingerprint" is not null and "run_record"."ending" <> 'withdrawn';--> statement-breakpoint
CREATE INDEX "run_record_team_station_started_idx" ON "run_record" USING btree ("team_id","station_id",coalesce("started_at", "ended_at"),"run_id" collate "C") WHERE "run_record"."ended_at" is not null;--> statement-breakpoint
CREATE INDEX "run_record_task_idx" ON "run_record" USING btree ("task_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_record_workspace_idx" ON "run_record" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_record_ended_idx" ON "run_record" USING btree ("ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "score_judge_idx" ON "score" USING btree ("run_id","rubric_version") WHERE "score"."source" = 'judge';--> statement-breakpoint
CREATE UNIQUE INDEX "score_person_idx" ON "score" USING btree ("run_id","by") WHERE "score"."source" = 'person';--> statement-breakpoint
CREATE INDEX "score_station_idx" ON "score" USING btree ("station_id","at");--> statement-breakpoint
CREATE INDEX "score_task_idx" ON "score" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "score_workspace_idx" ON "score" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "station_alert_station_idx" ON "station_alert" USING btree ("station_id","raised_at");--> statement-breakpoint
CREATE INDEX "station_alert_task_idx" ON "station_alert" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "station_alert_open_rule_idx" ON "station_alert" USING btree ("station_id","measure","threshold") WHERE "station_alert"."recovered_at" is null;--> statement-breakpoint
CREATE INDEX "station_config_pull_request_station_idx" ON "station_config_pull_request" USING btree ("station_id","fingerprint","opened_at");--> statement-breakpoint
CREATE INDEX "station_config_pull_request_team_idx" ON "station_config_pull_request" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "station_watch_team_idx" ON "station_watch" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "task_change_shape_team_idx" ON "task_change_shape" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "task_delivery_pull_request_idx" ON "task_delivery" USING btree ("workspace_id","pull_request");--> statement-breakpoint
CREATE INDEX "task_delivery_team_idx" ON "task_delivery" USING btree ("team_id","opened_at");--> statement-breakpoint
CREATE INDEX "task_failures_last_idx" ON "task_failures" USING btree ("workspace_id","last_at");--> statement-breakpoint
CREATE INDEX "task_failures_team_idx" ON "task_failures" USING btree ("team_id","last_at");--> statement-breakpoint
CREATE INDEX "task_touches_team_idx" ON "task_touches" USING btree ("team_id","touched_at");--> statement-breakpoint
CREATE INDEX "task_touches_workspace_idx" ON "task_touches" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "config_pull_request_candidate_idx" ON "config_pull_request" USING btree ("search_id","candidate_id");--> statement-breakpoint
CREATE INDEX "config_pull_request_team_idx" ON "config_pull_request" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "config_pull_request_due_idx" ON "config_pull_request" USING btree ("due_at") WHERE "config_pull_request"."state" = 'opening';--> statement-breakpoint
CREATE INDEX "replay_set_idx" ON "replay" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "replay_candidate_idx" ON "replay" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "replay_team_state_idx" ON "replay" USING btree ("team_id","state");--> statement-breakpoint
CREATE INDEX "replay_team_started_idx" ON "replay" USING btree ("team_id","started_at");--> statement-breakpoint
CREATE INDEX "replay_search_idx" ON "replay" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "replay_pairs_with_idx" ON "replay" USING btree ("pairs_with");--> statement-breakpoint
CREATE INDEX "replay_candidate_station_idx" ON "replay_candidate" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "replay_candidate_team_idx" ON "replay_candidate" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_candidate_address_idx" ON "replay_candidate" USING btree ("team_id","line_key","station_key","name") WHERE "replay_candidate"."kind" = 'proposed';--> statement-breakpoint
CREATE UNIQUE INDEX "replay_candidate_search_name_idx" ON "replay_candidate" USING btree ("search_id","name") WHERE "replay_candidate"."kind" = 'searched';--> statement-breakpoint
CREATE INDEX "replay_check_team_idx" ON "replay_check" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_check_awaiting_idx" ON "replay_check" USING btree ("created_at") WHERE "replay_check"."baseline" = 'awaiting';--> statement-breakpoint
CREATE INDEX "replay_check_set_idx" ON "replay_check" USING btree ("set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_check_attempt_idx" ON "replay_check" USING btree ("station_id","candidate_behaviour","live_scoring","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_entry_run_idx" ON "replay_entry" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "replay_search_team_idx" ON "replay_search" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_search_set_idx" ON "replay_search" USING btree ("set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_search_active_idx" ON "replay_search" USING btree ("station_id") WHERE "replay_search"."state" in ('seeding', 'searching', 'holding-out');--> statement-breakpoint
CREATE UNIQUE INDEX "replay_search_iteration_run_idx" ON "replay_search_iteration" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "replay_set_station_idx" ON "replay_set" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "replay_set_team_idx" ON "replay_set" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_set_line_idx" ON "replay_set" USING btree ("line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_set_guards_changes_idx" ON "replay_set" USING btree ("station_id") WHERE "replay_set"."guards_changes";--> statement-breakpoint
CREATE UNIQUE INDEX "egress_workspace_key_idx" ON "egress" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "egress_token_hash_idx" ON "egress" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_token_hash_idx" ON "runner" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_egress_token_hash_idx" ON "runner" USING btree ("egress_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_proxy_credential_hash_idx" ON "runner" USING btree ("proxy_credential_hash");--> statement-breakpoint
CREATE INDEX "runner_pool_active_idx" ON "runner" USING btree ("pool_id") WHERE "runner"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "runner_work_idx" ON "runner" USING btree ("work_kind","work_id") WHERE "runner"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "runner_workspace_active_idx" ON "runner" USING btree ("workspace_id") WHERE "runner"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "runner_host_workspace_idx" ON "runner_host" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "runner_host_pool_idx" ON "runner_host" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "runner_host_trust_idx" ON "runner_host" USING btree ("trust_id");--> statement-breakpoint
CREATE INDEX "runner_host_last_seen_idx" ON "runner_host" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_pool_workspace_key_idx" ON "runner_pool" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_pool_token_hash_idx" ON "runner_pool" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_trust_workspace_key_idx" ON "runner_trust" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_runners_workspace_idx" ON "workspace_runners" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_grants_workspace_idx" ON "run_grants" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_grants_ended_idx" ON "run_grants" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "attachment_claim_task_idx" ON "attachment_claim" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "attachment_claim_chat_idx" ON "attachment_claim" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "chat_team_starter_idx" ON "chat" USING btree ("team_id","started_by_id","updated_at");--> statement-breakpoint
CREATE INDEX "chat_attachment_chat_idx" ON "chat_attachment" USING btree ("chat_id","message_position");--> statement-breakpoint
CREATE INDEX "heard_happening_heard_at_idx" ON "heard_happening" USING btree ("heard_at");--> statement-breakpoint
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
CREATE INDEX "network_call_waiting_idx" ON "network_call" USING btree ("workspace_id","state","queued_at");--> statement-breakpoint
CREATE INDEX "network_call_lapsing_idx" ON "network_call" USING btree ("state","lapses_at");--> statement-breakpoint
CREATE INDEX "network_call_answered_idx" ON "network_call" USING btree ("state","answered_at");--> statement-breakpoint
CREATE INDEX "network_call_lapsed_idx" ON "network_call" USING btree ("state","lapsed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notice_subject_idx" ON "notice" USING btree ("addressee_id","form","subject");--> statement-breakpoint
CREATE INDEX "notice_addressee_idx" ON "notice" USING btree ("workspace_id","addressee_id");--> statement-breakpoint
CREATE INDEX "notice_team_idx" ON "notice" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "run_connection_run_idx" ON "run_connection" USING btree ("run_id","at");--> statement-breakpoint
CREATE INDEX "run_connection_at_idx" ON "run_connection" USING btree ("at");--> statement-breakpoint
CREATE INDEX "run_queue_idx" ON "run" USING btree ("harness","state","priority","created_at");--> statement-breakpoint
CREATE INDEX "run_lease_idx" ON "run" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "run_workspace_idx" ON "run" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_task_idx" ON "run" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "run_station_idx" ON "run" USING btree ("station_id","created_at");--> statement-breakpoint
CREATE INDEX "run_station_fingerprint_idx" ON "run" USING btree ("station_fingerprint");--> statement-breakpoint
CREATE INDEX "run_chat_idx" ON "run" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "run_replay_of_idx" ON "run" USING btree ("replay_of_run_id");--> statement-breakpoint
CREATE INDEX "run_search_idx" ON "run" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "run_reserved_idx" ON "run" USING btree ("reserved_for");--> statement-breakpoint
CREATE INDEX "run_started_from_idx" ON "run" USING btree ("started_from_archive_id","started_from_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_aside_about_idx" ON "task_aside" USING btree ("task_id","form","about");--> statement-breakpoint
CREATE INDEX "task_aside_workspace_idx" ON "task_aside" USING btree ("workspace_id","settled_at");--> statement-breakpoint
CREATE INDEX "task_station_idx" ON "task" USING btree ("station_id","rank");--> statement-breakpoint
CREATE INDEX "task_workspace_idx" ON "task" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_attachment_task_idx" ON "task_attachment" USING btree ("task_id","note_position");--> statement-breakpoint
CREATE INDEX "task_mark_task_idx" ON "task_mark" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_note_task_idx" ON "task_note" USING btree ("task_id","position");--> statement-breakpoint
CREATE INDEX "task_note_connection_ask_idx" ON "task_note" USING btree (("connection_ask"->>'personId'),("connection_ask"->>'source')) WHERE "task_note"."connection_ask" is not null and ("task_note"."connection_ask"->>'met')::boolean = false;--> statement-breakpoint
CREATE INDEX "workspace_archive_continuity_idx" ON "workspace_archive" USING btree ("workspace_id","continuity_key","sealed_at");--> statement-breakpoint
CREATE INDEX "workspace_archive_task_idx" ON "workspace_archive" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "workspace_archive_chat_idx" ON "workspace_archive" USING btree ("chat_id");--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "issuer";