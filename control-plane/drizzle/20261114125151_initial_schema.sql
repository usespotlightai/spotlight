CREATE TYPE "public"."change_stack_failure" AS ENUM('not-generated', 'too-large', 'broke-rules');--> statement-breakpoint
CREATE TYPE "public"."change_stack_state" AS ENUM('generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."decision_kind" AS ENUM('trade-off', 'assumption', 'limitation', 'rejected-approach', 'deviation');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('proposed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."answer_verdict" AS ENUM('right', 'partly-right', 'missed');--> statement-breakpoint
CREATE TYPE "public"."delivery_failure_code" AS ENUM('task-deleted', 'not-connected', 'parent-deleted', 'parent-not-on-github', 'parent-never-on-github', 'never-on-github', 'pull-request-ambiguous', 'not-recorded', 'github-unreachable', 'github-rejected', 'unexpected');--> statement-breakpoint
CREATE TYPE "public"."review_comment_state" AS ENUM('draft', 'sending', 'posted', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."review_delivery_kind" AS ENUM('review', 'reply', 'file', 'edit', 'delete');--> statement-breakpoint
CREATE TYPE "public"."review_delivery_state" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_side" AS ENUM('new', 'old');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('submitted', 'posted', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."review_verdict" AS ENUM('comment', 'approve', 'request-changes');--> statement-breakpoint
CREATE TYPE "public"."stack_check_status" AS ENUM('waiting', 'redrafting', 'checked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."github_pull_request_state" AS ENUM('open', 'merged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."configuration_action" AS ENUM('created', 'updated', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."configuration_actor" AS ENUM('spotlight', 'person', 'token');--> statement-breakpoint
CREATE TYPE "public"."job_function" AS ENUM('marketing', 'leadership', 'product-management', 'sales-success', 'data', 'student', 'engineering', 'founder', 'other');--> statement-breakpoint
CREATE TYPE "public"."team_origin" AS ENUM('sign-up', 'configuration');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."workspace_token_scope" AS ENUM('read', 'plan', 'configure', 'secrets', 'runners', 'trusts');--> statement-breakpoint
CREATE TYPE "public"."alert_condition" AS ENUM('risesBy', 'fallsBy', 'above', 'below');--> statement-breakpoint
CREATE TYPE "public"."alert_measure" AS ENUM('sent_back_rate', 'accepted_rate', 'checks_failed_rate', 'failed_rate', 'merged_rate', 'cost_per_run');--> statement-breakpoint
CREATE TYPE "public"."human_action" AS ENUM('started', 'parked', 'accepted', 'answered', 'sent-back');--> statement-breakpoint
CREATE TYPE "public"."judging_failure" AS ENUM('no-evidence', 'request-failed', 'insufficient-credits', 'unreadable', 'ungrounded', 'errored', 'interrupted', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."pull_request_author" AS ENUM('spotlight', 'reviewed', 'people', 'bots');--> statement-breakpoint
CREATE TYPE "public"."pull_request_state" AS ENUM('open', 'merged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pull_request_type" AS ENUM('feature', 'fix', 'refactor', 'tests', 'chore', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_round_bucket" AS ENUM('0', '1', '2', '3+');--> statement-breakpoint
CREATE TYPE "public"."run_record_checks" AS ENUM('passed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."run_record_ending" AS ENUM('completed', 'failed', 'stopped', 'exhausted', 'cancelled', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."run_resolution" AS ENUM('accepted', 'sent-back', 'moved-on', 'failed', 'other');--> statement-breakpoint
CREATE TYPE "public"."run_size" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."score_kind" AS ENUM('yes-no', 'number', 'claims');--> statement-breakpoint
CREATE TYPE "public"."score_source" AS ENUM('judge', 'person');--> statement-breakpoint
CREATE TYPE "public"."delivery_state" AS ENUM('pending', 'working', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."hook_firing_state" AS ENUM('pending', 'working', 'done', 'failed', 'superseded', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."station_kind" AS ENUM('backlog', 'work', 'completed');--> statement-breakpoint
CREATE TYPE "public"."memory_drafting_failure" AS ENUM('no-evidence', 'request-failed', 'unreadable', 'errored', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('rationale', 'rejected-approach', 'failure', 'environment', 'preference', 'correction');--> statement-breakpoint
CREATE TYPE "public"."memory_proposal_state" AS ENUM('proposed', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."memory_proposer" AS ENUM('drafter', 'agent');--> statement-breakpoint
CREATE TYPE "public"."memory_source" AS ENUM('person', 'run', 'outside');--> statement-breakpoint
CREATE TYPE "public"."memory_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."memory_use_via" AS ENUM('briefed', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."config_pull_request_close_reason" AS ENUM('stale', 'by-person');--> statement-breakpoint
CREATE TYPE "public"."config_pull_request_error" AS ENUM('no-source', 'repository-unreachable', 'file-missing', 'file-unparsable', 'block-not-found', 'blocks-ambiguous', 'computed-attribute', 'base-changed', 'edit-failed', 'branch-taken', 'file-unwritable', 'github-error');--> statement-breakpoint
CREATE TYPE "public"."config_pull_request_state" AS ENUM('opening', 'opened', 'closing', 'merged', 'closed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pair_order" AS ENUM('run-first', 'other-first');--> statement-breakpoint
CREATE TYPE "public"."replay_candidate_kind" AS ENUM('live', 'searched', 'planned', 'oracle');--> statement-breakpoint
CREATE TYPE "public"."replay_check_baseline" AS ENUM('awaiting', 'found', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."replay_judging_failure" AS ENUM('no-evidence', 'request-failed', 'insufficient-credits', 'unreadable', 'ungrounded', 'errored', 'interrupted', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."replay_run_decided" AS ENUM('queued', 'cancelled', 'unreplayable');--> statement-breakpoint
CREATE TYPE "public"."replay_run_result" AS ENUM('completed', 'failed', 'exhausted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."replay_search_iteration_kind" AS ENUM('propose', 'reflect', 'request');--> statement-breakpoint
CREATE TYPE "public"."replay_search_iteration_state" AS ENUM('wanted', 'running', 'ended', 'failed');--> statement-breakpoint
CREATE TYPE "public"."replay_search_objective" AS ENUM('success', 'cost');--> statement-breakpoint
CREATE TYPE "public"."replay_search_reflection_result" AS ENUM('continued', 'no-config-cause', 'no-failures', 'did-not-run', 'ceiling-reached');--> statement-breakpoint
CREATE TYPE "public"."replay_search_state" AS ENUM('seeding', 'searching', 'holding-out', 'finished', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."replay_search_stop_reason" AS ENUM('iterations-spent', 'ceiling-reached', 'stalled', 'turned-off', 'station-gone', 'seed-failed');--> statement-breakpoint
CREATE TYPE "public"."replay_search_trigger" AS ENUM('schedule', 'alert', 'request');--> statement-breakpoint
CREATE TYPE "public"."replay_state" AS ENUM('queued', 'running', 'finished', 'stopped', 'ceiling-reached');--> statement-breakpoint
CREATE TYPE "public"."replay_stop_cause" AS ENUM('superseded', 'insufficient-credits', 'search-ended', 'stale', 'check-failed');--> statement-breakpoint
CREATE TYPE "public"."search_skip_reason" AS ENUM('no-agent', 'no-scoring', 'set-too-small', 'no-fresh-held-out', 'ceiling-too-low', 'noisy', 'judge-unstable', 'flaky-checks', 'no-headroom', 'monthly-ceiling', 'pull-request-open', 'cooldown');--> statement-breakpoint
CREATE TYPE "public"."unreplayable_reason" AS ENUM('unknown-run', 'not-a-task-run', 'task-gone', 'still-running', 'no-starting-point', 'no-briefing', 'archive-gone', 'attachments-gone', 'answer-gone', 'repository-gone', 'not-at-the-station', 'candidate-unfit', 'cannot-start', 'unchecked', 'cancelled', 'dispatch-failed');--> statement-breakpoint
CREATE TYPE "public"."runner_work_kind" AS ENUM('run', 'check');--> statement-breakpoint
CREATE TYPE "public"."sandbox_state" AS ENUM('open', 'draining', 'gone');--> statement-breakpoint
CREATE TYPE "public"."token_holder_kind" AS ENUM('pool', 'egress');--> statement-breakpoint
CREATE TYPE "public"."network_call_state" AS ENUM('waiting', 'claimed', 'answered', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."run_asks" AS ENUM('requester', 'recorded');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('queued', 'claimed', 'suspended', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."run_turn" AS ENUM('pending', 'kept');--> statement-breakpoint
CREATE TYPE "public"."working_copy_restores" AS ENUM('always', 'when-continuing');--> statement-breakpoint
CREATE TYPE "public"."secret_source" AS ENUM('built-in', 'aws-secrets-manager');--> statement-breakpoint
CREATE TYPE "public"."chat_message_kind" AS ENUM('message', 'proposed');--> statement-breakpoint
CREATE TYPE "public"."dispatch_follow_up" AS ENUM('accepted', 'sent-back');--> statement-breakpoint
CREATE TYPE "public"."dispatch_kind" AS ENUM('task', 'chat', 'trial');--> statement-breakpoint
CREATE TYPE "public"."dispatch_outcome" AS ENUM('completed', 'failed', 'exhausted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dispatch_refusal" AS ENUM('no-order', 'order-refused', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."inbox_request_form" AS ENUM('memories', 'grade', 'alert');--> statement-breakpoint
CREATE TYPE "public"."notice_form" AS ENUM('ended', 'advice');--> statement-breakpoint
CREATE TYPE "public"."task_note_form" AS ENUM('words', 'setup', 'resolved', 'approval', 'decision', 'failure', 'connection');--> statement-breakpoint
CREATE TYPE "public"."task_note_kind" AS ENUM('asked', 'passed', 'answered', 'message', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."voice" AS ENUM('station', 'person', 'world');--> statement-breakpoint
CREATE TYPE "public"."work_station_kind" AS ENUM('backlog', 'work', 'completed');--> statement-breakpoint
CREATE TABLE "event_delivery" (
	"event_id" uuid NOT NULL,
	"subscriber" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp (3) with time zone,
	"dead_lettered_at" timestamp (3) with time zone,
	"last_error" text,
	CONSTRAINT "event_delivery_event_id_subscriber_pk" PRIMARY KEY("event_id","subscriber"),
	CONSTRAINT "event_delivery_attempts_not_negative" CHECK ("event_delivery"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"cause" jsonb,
	"traceparent" text,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotent_create" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotent_create_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "catalog_call" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"run_id" text NOT NULL,
	"item" text NOT NULL,
	"called_at" timestamp (3) with time zone NOT NULL,
	"ms" integer NOT NULL,
	"succeeded" boolean NOT NULL,
	"billable" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_plan" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"expires_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "change_stack" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"task_id" text,
	"team_id" text,
	"trial" boolean NOT NULL,
	"workspace_id" text NOT NULL,
	"repository" text,
	"base_commit" text,
	"state" "change_stack_state" NOT NULL,
	"files" jsonb NOT NULL,
	"cohorts" jsonb NOT NULL,
	"failure" "change_stack_failure",
	"started_at" timestamp (3) with time zone NOT NULL,
	"completed_at" timestamp (3) with time zone,
	"facts" jsonb NOT NULL,
	"check_command" text,
	"check_setup" text,
	"check_placement" jsonb NOT NULL,
	"check_placement_image" text,
	"redrafting" boolean NOT NULL,
	"pending_job" boolean NOT NULL,
	"usage" jsonb NOT NULL,
	"previous_stack_id" text,
	"removed_layers" jsonb NOT NULL,
	"job_attempts" integer NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"version" integer NOT NULL,
	CONSTRAINT "change_stack_job_attempts_not_negative" CHECK ("change_stack"."job_attempts" >= 0)
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
	"journal_steps" jsonb NOT NULL,
	CONSTRAINT "decision_position_not_negative" CHECK ("decision"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "decision_dispute" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"path" text NOT NULL,
	"disputed_by_id" text NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_set" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"source_run_id" text,
	"generation_run_id" text,
	"generation_requested_at" timestamp (3) with time zone,
	"job_attempts" integer NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"status" "decision_status" NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "decision_set_job_attempts_not_negative" CHECK ("decision_set"."job_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "decision_set_merge" (
	"set_id" text NOT NULL,
	"repository" text NOT NULL,
	"commit" text NOT NULL,
	"merged_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "decision_set_merge_set_id_repository_pk" PRIMARY KEY("set_id","repository")
);
--> statement-breakpoint
CREATE TABLE "question_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text,
	"team_id" text,
	"stack_id" text NOT NULL,
	"repository" text,
	"question_id" text NOT NULL,
	"person_id" text NOT NULL,
	"asked" text NOT NULL,
	"expected" text NOT NULL,
	"reply" text,
	"verdict" "answer_verdict" NOT NULL,
	"feedback" text,
	"usage" jsonb NOT NULL,
	"answered_at" timestamp (3) with time zone NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"repository" text,
	"author_id" text,
	"author_run_id" text,
	"author_name" text,
	"verdict" "review_verdict" NOT NULL,
	"body" text NOT NULL,
	"state" "review_state" NOT NULL,
	"github_id" bigint,
	"verdict_on_github" "review_verdict",
	"submitted_at" timestamp (3) with time zone NOT NULL,
	"posted_at" timestamp (3) with time zone,
	"failure_code" "delivery_failure_code",
	"failure_detail" text,
	"version" integer NOT NULL,
	CONSTRAINT "review_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "review_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"repository" text,
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
	"edit_pending" boolean NOT NULL,
	"pending_own_edits" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"edited_at" timestamp (3) with time zone,
	"failure_code" "delivery_failure_code",
	"failure_detail" text,
	"version" integer NOT NULL,
	CONSTRAINT "review_comment_lines_check" CHECK (("review_comment"."side" is null) = ("review_comment"."line" is null) and ("review_comment"."line" is not null or "review_comment"."start_line" is null))
);
--> statement-breakpoint
CREATE TABLE "review_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"kind" "review_delivery_kind" NOT NULL,
	"review_id" text,
	"comment_id" text,
	"state" "review_delivery_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp (3) with time zone NOT NULL,
	"sending_since" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_delivery_attempts_not_negative" CHECK ("review_delivery"."attempts" >= 0),
	CONSTRAINT "review_delivery_one_subject" CHECK (("review_delivery"."kind" = 'review') = ("review_delivery"."review_id" is not null) and num_nonnulls("review_delivery"."review_id", "review_delivery"."comment_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "review_included_comment" (
	"review_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"comment_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "review_included_comment_review_id_comment_id_pk" PRIMARY KEY("review_id","comment_id"),
	CONSTRAINT "review_included_comment_position_not_negative" CHECK ("review_included_comment"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stack_check" (
	"stack_id" text NOT NULL,
	"recheck" boolean NOT NULL,
	"run_id" text NOT NULL,
	"task_id" text,
	"team_id" text,
	"trial" boolean NOT NULL,
	"workspace_id" text NOT NULL,
	"command" text NOT NULL,
	"setup" text,
	"placement" jsonb NOT NULL,
	"placement_image" text,
	"status" "stack_check_status" NOT NULL,
	"entries" jsonb NOT NULL,
	"redraft_count" integer NOT NULL,
	"outcome" jsonb,
	"claimed_by" text,
	"attempts" integer NOT NULL,
	"lease_expires_at" timestamp (3) with time zone,
	"claimed_at" timestamp (3) with time zone,
	"waiting_since" timestamp (3) with time zone NOT NULL,
	"reserved_for" text,
	"reserved_pool" text,
	"reserved_until" timestamp (3) with time zone,
	"provision_attempts" integer NOT NULL,
	"next_provision_attempt_at" timestamp (3) with time zone,
	"version" integer NOT NULL,
	CONSTRAINT "stack_check_stack_id_recheck_pk" PRIMARY KEY("stack_id","recheck"),
	CONSTRAINT "stack_check_redraft_count_not_negative" CHECK ("stack_check"."redraft_count" >= 0),
	CONSTRAINT "stack_check_attempts_not_negative" CHECK ("stack_check"."attempts" >= 0),
	CONSTRAINT "stack_check_provision_attempts_not_negative" CHECK ("stack_check"."provision_attempts" >= 0)
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
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "harness_profile_team_id_key_unique" UNIQUE("team_id","key")
);
--> statement-breakpoint
CREATE TABLE "skill_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"key" text NOT NULL,
	"files" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_definition_team_id_key_unique" UNIQUE("team_id","key")
);
--> statement-breakpoint
CREATE TABLE "terraform_state" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"lock" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terraform_state_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "terraform_state_version" (
	"id" text PRIMARY KEY NOT NULL,
	"state_id" text NOT NULL,
	"number" integer NOT NULL,
	"serial" integer NOT NULL,
	"lineage" text NOT NULL,
	"md5" text NOT NULL,
	"size" integer NOT NULL,
	"written_by" text NOT NULL,
	"written_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "terraform_state_version_state_id_number_unique" UNIQUE("state_id","number"),
	CONSTRAINT "terraform_state_version_size_not_negative" CHECK ("terraform_state_version"."size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "github_connection" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
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
	"opened_at" timestamp (3) with time zone NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"ready_for_review_at" timestamp (3) with time zone,
	"draft_periods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "github_pull_request_state" NOT NULL,
	"closed_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone NOT NULL,
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
CREATE TABLE "device_code" (
	"id" text PRIMARY KEY NOT NULL,
	"device_code" text NOT NULL,
	"user_code" text NOT NULL,
	"user_id" text,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"status" text NOT NULL,
	"last_polled_at" timestamp (3) with time zone,
	"polling_interval" integer,
	"client_id" text,
	"scope" text
);
--> statement-breakpoint
CREATE TABLE "avatar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text,
	"digest" text NOT NULL,
	"image_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_owner_idx" UNIQUE NULLS NOT DISTINCT("workspace_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "configuration_change" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "configuration_change_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text NOT NULL,
	"key" text NOT NULL,
	"action" "configuration_action" NOT NULL,
	"actor" "configuration_actor" NOT NULL,
	"user_id" text,
	"token_id" text,
	"trust_id" text,
	"client" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_email" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"added_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"verified_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_email_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "verification_send" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "verification_send_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"sent_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_trust" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"issuer" text NOT NULL,
	"audience" text NOT NULL,
	"subject" text NOT NULL,
	"claims" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scopes" "workspace_token_scope"[] NOT NULL,
	"lifetime_minutes" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"grant_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "oidc_trust_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "oidc_trust_lifetime_minutes_positive" CHECK ("oidc_trust"."lifetime_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "oidc_trust_usage" (
	"trust_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"last_issued_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_survey" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"respondent_id" text,
	"job_function" "job_function" NOT NULL,
	"referral_source" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"origin" "team_origin" NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"outbound_hosts" text[] DEFAULT '{}' NOT NULL,
	"first_team_pending" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workspace_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_id" text,
	"invited_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"accepted_at" timestamp (3) with time zone,
	"accepted_by_id" text,
	"revoked_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "workspace_invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "workspace_invite_role" CHECK ("workspace_invite"."role" <> 'owner'),
	CONSTRAINT "workspace_invite_accepted_by" CHECK ("workspace_invite"."accepted_by_id" is null or "workspace_invite"."accepted_at" is not null),
	CONSTRAINT "workspace_invite_ended_once" CHECK (not ("workspace_invite"."accepted_at" is not null and "workspace_invite"."revoked_at" is not null))
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
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
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
	"issued_by_id" text NOT NULL,
	"issued_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone,
	"issued_by_trust_id" text,
	"trust_version" integer,
	"run_id" text,
	"run_attempt" integer,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "workspace_token_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "workspace_token_trust_version" CHECK (("workspace_token"."issued_by_trust_id" is null) = ("workspace_token"."trust_version" is null)),
	CONSTRAINT "workspace_token_run_attempt" CHECK (("workspace_token"."run_id" is null) = ("workspace_token"."run_attempt" is null)),
	CONSTRAINT "workspace_token_issued_once" CHECK ("workspace_token"."issued_by_trust_id" is null or "workspace_token"."run_id" is null)
);
--> statement-breakpoint
CREATE TABLE "chat_record" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"started_by_id" text NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deleted_task" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deleted_team" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	CONSTRAINT "deleted_team_workspace_id_team_id_pk" PRIMARY KEY("workspace_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "deleted_workspace" (
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
	"pass_threshold" double precision NOT NULL,
	"rubric_version" text NOT NULL,
	"queued_at" timestamp (3) with time zone NOT NULL,
	"pending" boolean NOT NULL,
	"job_attempts" integer DEFAULT 0 NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"judged_at" timestamp (3) with time zone,
	"failure" "judging_failure",
	"failed_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "judging_job_attempts_not_negative" CHECK ("judging"."job_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pull_request_fact" (
	"workspace_id" text NOT NULL,
	"pull_request" text NOT NULL,
	"type" "pull_request_type" NOT NULL,
	"made_by" "pull_request_author" NOT NULL,
	"rounds" "review_round_bucket" NOT NULL,
	"merged_at" timestamp (3) with time zone,
	CONSTRAINT "pull_request_fact_workspace_id_pull_request_pk" PRIMARY KEY("workspace_id","pull_request")
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
	"opened_at" timestamp (3) with time zone,
	"state" "pull_request_state",
	"closed_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone,
	"ready_for_review_at" timestamp (3) with time zone,
	"draft_periods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_review_at" timestamp (3) with time zone,
	"first_unblocking_review_at" timestamp (3) with time zone,
	"first_approved_at" timestamp (3) with time zone,
	"human_reviewed_at" timestamp (3) with time zone[] DEFAULT '{}' NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"review_rounds" integer DEFAULT 0 NOT NULL,
	"review_comments" integer DEFAULT 0 NOT NULL,
	"bot_activity" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_revert" boolean DEFAULT false NOT NULL,
	"reverted_by" text,
	"seen_version" integer,
	"owner_task_id" text,
	"owner_team_id" text,
	"owner_opened_at" timestamp (3) with time zone,
	"review_task_ids" text[] DEFAULT '{}' NOT NULL,
	"review_team_ids" text[] DEFAULT '{}' NOT NULL,
	"github_purged_at" timestamp (3) with time zone,
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
	"queued_at" timestamp (3) with time zone,
	"started_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone NOT NULL,
	"began_at" timestamp (3) with time zone NOT NULL,
	"ended_as" "run_record_ending" NOT NULL,
	"ending" "run_record_ending" NOT NULL,
	"resolution" "run_resolution" NOT NULL,
	"ran" boolean NOT NULL,
	"ran_a_config" boolean NOT NULL,
	"size" "run_size",
	"failure" text,
	"visit" integer NOT NULL,
	"asked" boolean NOT NULL,
	"superseded_at" timestamp (3) with time zone,
	"checks" "run_record_checks",
	"checked_at" timestamp (3) with time zone,
	"first_human_action" "human_action",
	"first_human_action_at" timestamp (3) with time zone,
	"approval_answered_at" timestamp (3) with time zone,
	"passed_to" text,
	"passed_at" timestamp (3) with time zone,
	"usage_recorded" boolean NOT NULL,
	"ms" integer,
	"steps" integer,
	"errors" integer,
	"changed_lines" integer,
	"context_tokens" integer,
	"context_window" integer,
	"cost" numeric(24, 12),
	"currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"tools" jsonb,
	"dismissals" jsonb NOT NULL,
	"memories" jsonb NOT NULL,
	"opened_by_id" text,
	"task_opened_at" timestamp (3) with time zone,
	"pull_request" text,
	"pull_request_state" "pull_request_state",
	"pull_request_opened_at" timestamp (3) with time zone,
	"pull_request_closed_at" timestamp (3) with time zone,
	CONSTRAINT "run_fact_currency_code" CHECK ("run_fact"."currency" ~ '^[A-Z]{3}$')
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
	"queued_at" timestamp (3) with time zone,
	"started_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone,
	"ending" "run_record_ending",
	"failure" text,
	"visit" integer,
	"asked" boolean DEFAULT false NOT NULL,
	"superseded_at" timestamp (3) with time zone,
	"checks" "run_record_checks",
	"checked_at" timestamp (3) with time zone,
	"first_human_action" "human_action",
	"first_human_action_at" timestamp (3) with time zone,
	"approval_answered_at" timestamp (3) with time zone,
	"passed_to" text,
	"passed_at" timestamp (3) with time zone,
	"usage_recorded" boolean DEFAULT false NOT NULL,
	"ms" integer,
	"steps" integer,
	"errors" integer,
	"changed_lines" integer,
	"context_tokens" integer,
	"context_window" integer,
	"cost" numeric(24, 12),
	"currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"tools" jsonb,
	"dismissals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memories" jsonb DEFAULT '{"briefed":[],"recalled":[]}'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "run_record_currency_code" CHECK ("run_record"."currency" ~ '^[A-Z]{3}$')
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
	"claim_results" jsonb,
	"rubric_version" text,
	"model" text,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seen" jsonb DEFAULT '{"steps":[],"hunks":[]}'::jsonb NOT NULL,
	"scored_by_id" text,
	"at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"measure" "alert_measure" NOT NULL,
	"condition" "alert_condition" NOT NULL,
	"threshold" double precision NOT NULL,
	"over" integer NOT NULL,
	"value" double precision NOT NULL,
	"baseline" double precision,
	"run_id" text NOT NULL,
	"task_id" text NOT NULL,
	"fired_at" timestamp (3) with time zone NOT NULL,
	"resolved_at" timestamp (3) with time zone,
	"clear_runs" integer DEFAULT 0 NOT NULL,
	"last_seen_run_id" text,
	CONSTRAINT "station_alert_clear_runs_not_negative" CHECK ("station_alert"."clear_runs" >= 0)
);
--> statement-breakpoint
CREATE TABLE "station_alert_state" (
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
	"shaped_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_failures" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"occurrences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_human_action" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text,
	"line_id" text,
	"station_id" text,
	"opened_by_id" text,
	"opened_at" timestamp (3) with time zone,
	"asks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_action_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_pull_request_fact" (
	"task_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"pull_request" text NOT NULL,
	"state" "pull_request_state" NOT NULL,
	"opened_at" timestamp (3) with time zone NOT NULL,
	"first_review_at" timestamp (3) with time zone,
	"closed_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "inbound_delivery" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inbound_delivery_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"integration" text NOT NULL,
	"workspace_id" text,
	"team_id" text,
	"team_key" text,
	"id" text NOT NULL,
	"headers" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"cause_firing_id" text,
	"state" "delivery_state" NOT NULL,
	"attempts" integer NOT NULL,
	"due_at" timestamp (3) with time zone NOT NULL,
	"claimed_at" timestamp (3) with time zone,
	"failed" text,
	"received_at" timestamp (3) with time zone NOT NULL,
	"handled_at" timestamp (3) with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inbound_delivery_key" UNIQUE NULLS NOT DISTINCT("integration","team_id","id"),
	CONSTRAINT "inbound_delivery_attempts_not_negative" CHECK ("inbound_delivery"."attempts" >= 0),
	CONSTRAINT "inbound_delivery_whole_addressee" CHECK (num_nonnulls("inbound_delivery"."workspace_id", "inbound_delivery"."team_id", "inbound_delivery"."team_key") in (0, 3))
);
--> statement-breakpoint
CREATE TABLE "hook_callback" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"hook" text NOT NULL,
	"firing_id" text,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
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
	"blocks" boolean NOT NULL,
	"signing_secret" text,
	"signing_secret_version" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
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
	"run_attempt" integer,
	"station_key" text NOT NULL,
	"on" text NOT NULL,
	"occurrence" text NOT NULL,
	"event" jsonb NOT NULL,
	"matched" boolean NOT NULL,
	"cause" jsonb NOT NULL,
	"link" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"state" "hook_firing_state" NOT NULL,
	"attempts" integer NOT NULL,
	"due_at" timestamp (3) with time zone NOT NULL,
	"claimed_at" timestamp (3) with time zone,
	"failure" text,
	"failed" text,
	"skipped" text,
	"fired_at" timestamp (3) with time zone NOT NULL,
	"handled_at" timestamp (3) with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "hook_firing_hook_id_occurrence_unique" UNIQUE("hook_id","occurrence"),
	CONSTRAINT "hook_firing_attempts_not_negative" CHECK ("hook_firing"."attempts" >= 0),
	CONSTRAINT "hook_firing_skip_reason" CHECK (("hook_firing"."state" = 'skipped') = ("hook_firing"."skipped" is not null)),
	CONSTRAINT "hook_firing_whole_run" CHECK (num_nonnulls("hook_firing"."run_id", "hook_firing"."run_attempt") in (0, 2))
);
--> statement-breakpoint
CREATE TABLE "inferred_output_schema" (
	"team_id" text NOT NULL,
	"tool" text NOT NULL,
	"integration" text NOT NULL,
	"shape" jsonb NOT NULL,
	"calls" integer NOT NULL,
	"inferred_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inferred_output_schema_team_id_tool_pk" PRIMARY KEY("team_id","tool")
);
--> statement-breakpoint
CREATE TABLE "integration_connection" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"integration" text NOT NULL,
	"owner" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp (3) with time zone,
	"scopes" text DEFAULT '' NOT NULL,
	"linked_account" text,
	"refresh_failed_at" timestamp (3) with time zone,
	"refresh_claimed_until" timestamp (3) with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"connected_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "integration_connection_team_id_integration_owner_pk" PRIMARY KEY("team_id","integration","owner")
);
--> statement-breakpoint
CREATE TABLE "integration_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"integration" text NOT NULL,
	"definition" jsonb NOT NULL,
	"tools" jsonb NOT NULL,
	"spec_fingerprint" text,
	"spec_hash" text,
	"spec_read_at" timestamp (3) with time zone,
	"spec_problem" text,
	"spec_skipped" jsonb,
	"relists_tools" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_definition_team_id_integration_unique" UNIQUE("team_id","integration")
);
--> statement-breakpoint
CREATE TABLE "oauth2_client_registration" (
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"integration" text NOT NULL,
	"registration_endpoint" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"issuer" text,
	"authorize_endpoint" text,
	"token_endpoint" text,
	"client_id" text NOT NULL,
	"client_secret" text,
	"secret_expires_at" timestamp (3) with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"registered_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "oauth2_client_registration_team_id_integration_pk" PRIMARY KEY("team_id","integration")
);
--> statement-breakpoint
CREATE TABLE "oauth2_spent_nonce" (
	"nonce" text PRIMARY KEY NOT NULL,
	"until" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_tool_policy" (
	"team_id" text NOT NULL,
	"person_id" text NOT NULL,
	"integration" text NOT NULL,
	"rules" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "person_tool_policy_team_id_person_id_integration_pk" PRIMARY KEY("team_id","person_id","integration")
);
--> statement-breakpoint
CREATE TABLE "poll_cursor" (
	"team_id" text NOT NULL,
	"integration" text NOT NULL,
	"cursor" text,
	"polled_at" timestamp (3) with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "poll_cursor_team_id_integration_pk" PRIMARY KEY("team_id","integration")
);
--> statement-breakpoint
CREATE TABLE "schedule_cursor" (
	"team_id" text NOT NULL,
	"integration" text NOT NULL,
	"ran_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "schedule_cursor_team_id_integration_pk" PRIMARY KEY("team_id","integration")
);
--> statement-breakpoint
CREATE TABLE "spec_document" (
	"hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"operations" integer NOT NULL,
	"skipped" jsonb NOT NULL,
	"read_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spec_operation" (
	"hash" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"operation" jsonb NOT NULL,
	CONSTRAINT "spec_operation_hash_name_pk" PRIMARY KEY("hash","name"),
	CONSTRAINT "spec_operation_position_not_negative" CHECK ("spec_operation"."position" >= 0)
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
	"search" jsonb,
	"source" jsonb,
	"runners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warm_sandboxes" integer DEFAULT 0 NOT NULL,
	"default_assignee" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "line_reaction" (
	"line_id" text NOT NULL,
	"happening" text NOT NULL,
	"from_station_id" text,
	"to_station_id" text NOT NULL,
	CONSTRAINT "line_reaction_key" UNIQUE NULLS NOT DISTINCT("line_id","happening","from_station_id")
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
	"workspace_id" text NOT NULL,
	"line_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"color" text DEFAULT '#a3a8b0' NOT NULL,
	"description" text,
	"kind" "station_kind" DEFAULT 'work' NOT NULL,
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
	"search" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "station_position_not_negative" CHECK ("station"."position" >= 0)
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
	CONSTRAINT "station_skill_station_id_skill_pk" PRIMARY KEY("station_id","skill"),
	CONSTRAINT "station_skill_position_not_negative" CHECK ("station_skill"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "station_tool" (
	"station_id" text NOT NULL,
	"tool" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "station_tool_station_id_tool_pk" PRIMARY KEY("station_id","tool"),
	CONSTRAINT "station_tool_position_not_negative" CHECK ("station_tool"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "memory" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" integer GENERATED BY DEFAULT AS IDENTITY (sequence name "memory_handle_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
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
	"approved_by_id" text NOT NULL,
	"approved_at" timestamp (3) with time zone NOT NULL,
	"retired_at" timestamp (3) with time zone,
	"retired_by_id" text,
	"retire_reason" text,
	"superseded_by" text,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "memory_retired_at_matches_status" CHECK (("memory"."status" = 'retired') = ("memory"."retired_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "memory_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"drafting_run_id" text,
	"drafting_requested_at" timestamp (3) with time zone,
	"job_attempts" integer DEFAULT 0 NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"drafted_in" text,
	"notes_read" integer DEFAULT 0 NOT NULL,
	"failure" "memory_drafting_failure",
	"failed_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "memory_draft_job_attempts_not_negative" CHECK ("memory_draft"."job_attempts" >= 0),
	CONSTRAINT "memory_draft_notes_read_not_negative" CHECK ("memory_draft"."notes_read" >= 0)
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
	"proposed_by" "memory_proposer" NOT NULL,
	"supersedes" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"state" "memory_proposal_state" DEFAULT 'proposed' NOT NULL,
	"decided_by_id" text,
	"decided_at" timestamp (3) with time zone,
	CONSTRAINT "memory_proposal_position_not_negative" CHECK ("memory_proposal"."position" >= 0),
	CONSTRAINT "memory_proposal_decided_matches_state" CHECK (("memory_proposal"."state" = 'proposed') = ("memory_proposal"."decided_at" is null) and ("memory_proposal"."decided_by_id" is null) = ("memory_proposal"."decided_at" is null))
);
--> statement-breakpoint
CREATE TABLE "memory_use" (
	"memory_id" text NOT NULL,
	"run_id" text NOT NULL,
	"via" "memory_use_via" NOT NULL,
	"at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "memory_use_memory_id_run_id_via_pk" PRIMARY KEY("memory_id","run_id","via")
);
--> statement-breakpoint
CREATE TABLE "arrival_ledger" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"watching" jsonb NOT NULL,
	"announced" jsonb NOT NULL,
	"sighted_at" timestamp (3) with time zone,
	"recount_requested_at" timestamp (3) with time zone,
	"job_attempts" integer DEFAULT 0 NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "arrival_ledger_job_attempts_not_negative" CHECK ("arrival_ledger"."job_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"renewed_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_judging" (
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"rubric" text,
	"claims" jsonb NOT NULL,
	"pass_threshold" double precision NOT NULL,
	"reference_run_id" text,
	"queued_at" timestamp (3) with time zone NOT NULL,
	"pending" boolean NOT NULL,
	"job_attempts" integer DEFAULT 0 NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"judged_at" timestamp (3) with time zone,
	"failure" "replay_judging_failure",
	"failed_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "change_judging_run_id_attempt_pk" PRIMARY KEY("run_id","attempt"),
	CONSTRAINT "change_judging_job_attempts_not_negative" CHECK ("change_judging"."job_attempts" >= 0)
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
	"open" boolean NOT NULL,
	"url" text,
	"number" integer,
	"host_id" bigint,
	"based_on" text,
	"proposing" text,
	"checked_at" timestamp (3) with time zone,
	"closed_because" "config_pull_request_close_reason",
	"close_failure_code" "config_pull_request_error",
	"close_failure_message" text,
	"error_code" "config_pull_request_error",
	"error_message" text,
	"error_attribute" text,
	"error_expression" text,
	"error_wanted" jsonb,
	"retries" integer NOT NULL,
	"last_commit" text,
	"due_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "config_pull_request_retries_not_negative" CHECK ("config_pull_request"."retries" >= 0)
);
--> statement-breakpoint
CREATE TABLE "line_search_budget" (
	"line_id" text NOT NULL,
	"month" timestamp (3) with time zone NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"admissions" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "line_search_budget_line_id_month_pk" PRIMARY KEY("line_id","month")
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
	"live_candidate" boolean NOT NULL,
	"baseline" boolean NOT NULL,
	"takes_pairings" boolean NOT NULL,
	"judges" boolean NOT NULL,
	"checked" boolean NOT NULL,
	"rubric_version" text,
	"scoring_hash" text NOT NULL,
	"ceiling_amount" numeric(24, 12) NOT NULL,
	"ceiling_currency" text NOT NULL,
	"unpriced_rate" double precision,
	"run_subset" jsonb,
	"answers" jsonb,
	"repeats" integer NOT NULL,
	"calibration" boolean DEFAULT false NOT NULL,
	"reference_replay_id" text,
	"pairwise_reference_id" text,
	"search_id" text,
	"state" "replay_state" NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"stopped_at" timestamp (3) with time zone,
	"stopped_because" "replay_stop_cause",
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "replay_ceiling_currency_code" CHECK ("replay"."ceiling_currency" ~ '^[A-Z]{3}$')
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
	"behaviour_hash" text NOT NULL,
	"scoring_hash" text NOT NULL,
	"line_fields" jsonb,
	"checks_changes" boolean NOT NULL,
	"rubric" text,
	"claims" jsonb,
	"pass_threshold" double precision,
	"rubric_version" text,
	"changed_from" text NOT NULL,
	"changes" jsonb NOT NULL,
	"search_id" text,
	"iteration" integer,
	"hypothesis" text,
	"reference_commit" text,
	"reference_pull_request" integer,
	"created_at" timestamp (3) with time zone NOT NULL,
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
	"replay_id" text,
	"reused" jsonb,
	"reference_commit" text,
	"reference_pull_request" integer,
	"live_fingerprint" text NOT NULL,
	"candidate_fingerprint" text NOT NULL,
	"live_behaviour" text NOT NULL,
	"live_scoring" text NOT NULL,
	"candidate_behaviour" text NOT NULL,
	"candidate_scoring" text NOT NULL,
	"change" text NOT NULL,
	"max_regressions" integer NOT NULL,
	"min_gain" double precision NOT NULL,
	"ceiling_amount" numeric(24, 12) NOT NULL,
	"ceiling_currency" text NOT NULL,
	"repeats" integer NOT NULL,
	"scoring_pinned_to_live" jsonb NOT NULL,
	"baseline" "replay_check_baseline" NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "replay_check_ceiling_currency_code" CHECK ("replay_check"."ceiling_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "replay_entry" (
	"replay_id" text NOT NULL,
	"position" integer NOT NULL,
	"original_run_id" text NOT NULL,
	"task_id" text NOT NULL,
	"repeat" integer NOT NULL,
	"run_id" text,
	"pool" text NOT NULL,
	"slot" integer,
	"queued" boolean DEFAULT false NOT NULL,
	"fingerprint" text,
	"queue_attempts" integer DEFAULT 0 NOT NULL,
	"unreplayable_reason" "unreplayable_reason",
	"not_run" boolean DEFAULT false NOT NULL,
	"waiting" boolean NOT NULL,
	"occupying" boolean NOT NULL,
	"unconfirmed" boolean NOT NULL,
	"result" "replay_run_result",
	"failure" text,
	"stopped" boolean,
	"asked" boolean,
	"next" text,
	"ended_at" timestamp (3) with time zone,
	"measured" boolean DEFAULT false NOT NULL,
	"ms" double precision,
	"steps" integer,
	"changed_lines" integer,
	"cost_amount" numeric(24, 12),
	"cost_currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"checks" jsonb,
	"generation_spent" jsonb,
	"judging" jsonb,
	"succeeded" boolean,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"second_judging" jsonb,
	"recheck" jsonb,
	"pairing" jsonb,
	CONSTRAINT "replay_entry_replay_id_position_pk" PRIMARY KEY("replay_id","position"),
	CONSTRAINT "replay_entry_position_not_negative" CHECK ("replay_entry"."position" >= 0),
	CONSTRAINT "replay_entry_queue_attempts_not_negative" CHECK ("replay_entry"."queue_attempts" >= 0),
	CONSTRAINT "replay_entry_cost_currency_code" CHECK ("replay_entry"."cost_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "replay_outcome" (
	"replay_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"set_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"search_id" text,
	"state" "replay_state" NOT NULL,
	"serves_as_baseline" boolean NOT NULL,
	"health_sample_group" text,
	"sampled_at" timestamp (3) with time zone NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"outcome" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_run_decision" (
	"run_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"replay_id" text NOT NULL,
	"decided" "replay_run_decided" NOT NULL,
	"unreplayable_reason" "unreplayable_reason",
	"trial_fingerprint" text,
	"moves_on_after" jsonb,
	"decided_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "replay_run_decision_unreplayable_reason" CHECK (("replay_run_decision"."decided" = 'unreplayable') = ("replay_run_decision"."unreplayable_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "replay_search" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"set_id" text NOT NULL,
	"harness" text,
	"model" text,
	"effort" text,
	"iterations" integer NOT NULL,
	"per_iteration" integer NOT NULL,
	"ceiling_amount" numeric(24, 12) NOT NULL,
	"ceiling_currency" text NOT NULL,
	"concurrency" integer NOT NULL,
	"repeats" integer NOT NULL,
	"agent_runs" boolean NOT NULL,
	"objective" "replay_search_objective" NOT NULL,
	"split" jsonb NOT NULL,
	"calibrates" boolean NOT NULL,
	"seed_candidate_id" text NOT NULL,
	"seed_fingerprint" text NOT NULL,
	"seed_replay" jsonb NOT NULL,
	"requests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dropped_requests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"held_out" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "replay_search_state" NOT NULL,
	"stop_reason" "replay_search_stop_reason",
	"trigger" "replay_search_trigger" NOT NULL,
	"pick" jsonb,
	"awaits_replays" boolean NOT NULL,
	"awaits_agent_spend" boolean NOT NULL,
	"active" boolean NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "replay_search_ceiling_currency_code" CHECK ("replay_search"."ceiling_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "replay_search_iteration" (
	"search_id" text NOT NULL,
	"number" integer NOT NULL,
	"run_id" text,
	"kind" "replay_search_iteration_kind" NOT NULL,
	"state" "replay_search_iteration_state" NOT NULL,
	"proposals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"agent_spent" jsonb,
	"incumbent" text,
	"result" "replay_search_reflection_result",
	"reflected_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"causes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "replay_search_iteration_search_id_number_pk" PRIMARY KEY("search_id","number"),
	CONSTRAINT "replay_search_iteration_attempts_not_negative" CHECK ("replay_search_iteration"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "replay_set" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"refreshed_at" timestamp (3) with time zone,
	"last_refresh" jsonb,
	"station_gone_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_set_entry" (
	"set_id" text NOT NULL,
	"run_id" text NOT NULL,
	"task_id" text NOT NULL,
	"ended_at" timestamp (3) with time zone NOT NULL,
	"added_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "replay_set_entry_set_id_run_id_pk" PRIMARY KEY("set_id","run_id")
);
--> statement-breakpoint
CREATE TABLE "side_by_side_judging" (
	"run_id" text NOT NULL,
	"other_run_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"rubric" text,
	"claims" jsonb NOT NULL,
	"pass_threshold" double precision NOT NULL,
	"reference_run_id" text NOT NULL,
	"shown_order" "pair_order" NOT NULL,
	"queued_at" timestamp (3) with time zone NOT NULL,
	"pending" boolean NOT NULL,
	"job_attempts" integer DEFAULT 0 NOT NULL,
	"job_due_at" timestamp (3) with time zone,
	"judged_at" timestamp (3) with time zone,
	"failure" "replay_judging_failure",
	"failed_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "side_by_side_judging_run_id_other_run_id_pk" PRIMARY KEY("run_id","other_run_id"),
	CONSTRAINT "side_by_side_judging_job_attempts_not_negative" CHECK ("side_by_side_judging"."job_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "station_search_schedule" (
	"station_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"set_id" text NOT NULL,
	"last_started_at" timestamp (3) with time zone,
	"last_skip_reason" "search_skip_reason",
	"last_skip_at" timestamp (3) with time zone,
	"searched_tasks" jsonb NOT NULL,
	"alert_pending_since" timestamp (3) with time zone,
	"rejected" jsonb NOT NULL,
	"rejected_against" text,
	"last_rejected_at" timestamp (3) with time zone,
	"last_improved_at" timestamp (3) with time zone,
	"request_day" text,
	"requests" jsonb NOT NULL,
	"pending_steps" jsonb NOT NULL,
	"steps_pending_since" timestamp (3) with time zone,
	"check_after" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
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
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runner" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"pool_id" text,
	"trust_id" text,
	"host_id" text,
	"enters_sandbox_id" text,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_hash" text NOT NULL,
	"egress_token_hash" text,
	"proxy_credential_hash" text,
	"harnesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supported_models" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"harness_versions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"work_kind" "runner_work_kind",
	"work_id" text,
	"claim_by" timestamp (3) with time zone NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"last_heartbeat_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "runner_whole_work" CHECK (("runner"."work_kind" is null) = ("runner"."work_id" is null)),
	CONSTRAINT "runner_one_credential_source" CHECK (("runner"."pool_id" is null) <> ("runner"."trust_id" is null))
);
--> statement-breakpoint
CREATE TABLE "runner_host" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"pool_id" text,
	"trust_id" text,
	"name" text NOT NULL,
	"release" text NOT NULL,
	"container_runtime" text NOT NULL,
	"capacity" integer NOT NULL,
	"running" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sandboxes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stopping" boolean DEFAULT false NOT NULL,
	"boot_id" text NOT NULL,
	"first_heartbeat_at" timestamp (3) with time zone NOT NULL,
	"online_since" timestamp (3) with time zone NOT NULL,
	"last_heartbeat_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "runner_host_capacity_positive" CHECK ("runner_host"."capacity" > 0),
	CONSTRAINT "runner_host_one_credential_source" CHECK (("runner_host"."pool_id" is null) <> ("runner_host"."trust_id" is null))
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
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
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
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text,
	"host_id" text,
	"pool_id" text,
	"trust_id" text,
	"token_hash" text,
	"state" "sandbox_state" NOT NULL,
	"leases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idle_since" timestamp (3) with time zone,
	"started_at" timestamp (3) with time zone NOT NULL,
	"gone_at" timestamp (3) with time zone,
	"warm" jsonb,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sandbox_host_has_token" CHECK (("sandbox"."host_id" is null) = ("sandbox"."token_hash" is null)),
	CONSTRAINT "sandbox_host_has_one_credential_source" CHECK (("sandbox"."host_id" is null) = ("sandbox"."pool_id" is null and "sandbox"."trust_id" is null) and ("sandbox"."pool_id" is null or "sandbox"."trust_id" is null)),
	CONSTRAINT "sandbox_gone_at_matches_state" CHECK (("sandbox"."state" = 'gone') = ("sandbox"."gone_at" is not null)),
	CONSTRAINT "sandbox_warm_has_no_key" CHECK ("sandbox"."warm" is null or "sandbox"."key" is null)
);
--> statement-breakpoint
CREATE TABLE "used_token" (
	"holder_kind" "token_holder_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"holder_id" text NOT NULL,
	"used_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "used_token_holder_kind_token_hash_pk" PRIMARY KEY("holder_kind","token_hash")
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
CREATE TABLE "network_call" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"method" text NOT NULL,
	"url" text NOT NULL,
	"headers" jsonb NOT NULL,
	"body" text NOT NULL,
	"timeout_ms" integer NOT NULL,
	"secrets" text[] DEFAULT '{}'::text[] NOT NULL,
	"secrets_token_hash" text,
	"secrets_redeemed_at" timestamp (3) with time zone,
	"queued_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"state" "network_call_state" NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp (3) with time zone,
	"responded_at" timestamp (3) with time zone,
	"response_status" integer,
	"response_headers" jsonb,
	"response_body" text,
	"response_ms" integer,
	"response_error" text,
	"abandoned_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_connection" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "run_connection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
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
	"error" text,
	"at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"harness" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"requester_owner" text NOT NULL,
	"requester_kind" text NOT NULL,
	"requester_id" text NOT NULL,
	"requester_token" text,
	"team_id" text,
	"holds_turn" boolean NOT NULL,
	"gated" boolean NOT NULL,
	"acts_beyond_itself" boolean NOT NULL,
	"asks" "run_asks" NOT NULL,
	"listed" boolean NOT NULL,
	"exclusive" boolean NOT NULL,
	"injects_secrets" boolean DEFAULT false NOT NULL,
	"working_copy_key" text,
	"working_copy_rejoinable" boolean,
	"working_copy_restores" "working_copy_restores",
	"restore_archive_id" text,
	"extensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"line_id" text,
	"line_fingerprint" text,
	"api_grant" jsonb,
	"order_fingerprint" text,
	"state" "run_state" NOT NULL,
	"spec" jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"placement" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placement_image" text,
	"ran_in" text,
	"claimed_by" text,
	"lease_expires_at" timestamp (3) with time zone,
	"stop_requested_at" timestamp (3) with time zone,
	"reserved_for" text,
	"reserved_pool" text,
	"reserved_until" timestamp (3) with time zone,
	"provision_attempts" integer DEFAULT 0 NOT NULL,
	"next_provision_attempt_at" timestamp (3) with time zone,
	"requeue_count" integer DEFAULT 0 NOT NULL,
	"suspended_attempts" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"started_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone,
	"started_from_archive_id" text,
	"started_from_checkouts" jsonb,
	"started_from_attempt" integer,
	"started_from_at" timestamp (3) with time zone,
	"asked_a_person" boolean DEFAULT false NOT NULL,
	"turn" "run_turn",
	"turn_report" jsonb,
	"suspended_at" timestamp (3) with time zone,
	"claimable_from" timestamp (3) with time zone,
	"exit_code" integer,
	"detail" text,
	"failure" text,
	"failure_attempts" integer,
	"stopped" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"queued_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"traceparent" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "run_provision_attempts_not_negative" CHECK ("run"."provision_attempts" >= 0),
	CONSTRAINT "run_requeue_count_not_negative" CHECK ("run"."requeue_count" >= 0),
	CONSTRAINT "run_turn_check" CHECK (("run"."state" = 'suspended') = ("run"."turn" is not null) and ("run"."turn" is null) = ("run"."turn_report" is null) and ("run"."turn" is null) = ("run"."suspended_at" is null)),
	CONSTRAINT "run_ended_at_matches_state" CHECK (("run"."state" in ('completed', 'failed', 'cancelled')) = ("run"."ended_at" is not null)),
	CONSTRAINT "run_working_copy_check" CHECK (("run"."working_copy_key" is null) = ("run"."working_copy_rejoinable" is null) and ("run"."working_copy_key" is null) = ("run"."working_copy_restores" is null))
);
--> statement-breakpoint
CREATE TABLE "run_journal_entry" (
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"at" timestamp (3) with time zone NOT NULL,
	"message" text,
	"data" text,
	CONSTRAINT "run_journal_entry_run_id_attempt_seq_pk" PRIMARY KEY("run_id","attempt","seq")
);
--> statement-breakpoint
CREATE TABLE "run_usage" (
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"ms" integer,
	"steps" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"changed_lines" integer DEFAULT 0 NOT NULL,
	"context_tokens" integer,
	"context_window" integer,
	"cost" numeric(24, 12),
	"currency" text,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cache_read_tokens" bigint,
	"cache_write_tokens" bigint,
	"tools" jsonb DEFAULT '{"servers":[],"skills":[]}'::jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_usage_run_id_attempt_pk" PRIMARY KEY("run_id","attempt"),
	CONSTRAINT "run_usage_currency_code" CHECK ("run_usage"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "starting_point_hold" (
	"holder" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "starting_point_hold_workspace_id_holder_key" UNIQUE("workspace_id","holder")
);
--> statement-breakpoint
CREATE TABLE "starting_point_hold_run" (
	"holder" text NOT NULL,
	"workspace_id" text NOT NULL,
	"run_id" text NOT NULL,
	CONSTRAINT "starting_point_hold_run_holder_run_id_pk" PRIMARY KEY("holder","run_id")
);
--> statement-breakpoint
CREATE TABLE "working_copy_archive" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"working_copy_key" text NOT NULL,
	"granted_to_run_id" text,
	"granted_to_sandbox_id" text,
	"size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"granted_at" timestamp (3) with time zone NOT NULL,
	"completed_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "working_copy_archive_size_not_negative" CHECK ("working_copy_archive"."size" >= 0),
	CONSTRAINT "working_copy_archive_granted_to_one" CHECK (("working_copy_archive"."granted_to_run_id" is null) <> ("working_copy_archive"."granted_to_sandbox_id" is null))
);
--> statement-breakpoint
CREATE TABLE "run_grants" (
	"run_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"recipient" text,
	"fetched_by_egress_id" text,
	"lease_lost" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secret" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"source" "secret_source" NOT NULL,
	"source_secret_id" text,
	"source_field" text,
	"bindings" jsonb NOT NULL,
	"value_version" integer,
	"rotated_at" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secret_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "secret_data_key" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"key_id" text NOT NULL,
	"wrapped" text NOT NULL,
	"issued_at" timestamp (3) with time zone DEFAULT now() NOT NULL
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
	"stored_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text,
	"chat_id" text,
	"claimed_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
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
	"target_station" jsonb,
	"setup" jsonb,
	"current_run_id" text,
	"session_id" text,
	"runner_id" text,
	"working_copy_released_at" timestamp (3) with time zone,
	"resolved_at" timestamp (3) with time zone,
	"read_at" timestamp (3) with time zone,
	"reopened_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_workspace_id_id_key" UNIQUE("workspace_id","id")
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
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_attachment_place_not_negative" CHECK ("chat_attachment"."place" >= 0),
	CONSTRAINT "chat_attachment_size_not_negative" CHECK ("chat_attachment"."size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chat_mark" (
	"workspace_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"finds" boolean NOT NULL,
	CONSTRAINT "chat_mark_chat_id_kind_value_pk" PRIMARY KEY("chat_id","kind","value")
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"chat_id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "chat_message_kind" NOT NULL,
	"body" text NOT NULL,
	"at" timestamp (3) with time zone NOT NULL,
	"author_id" text,
	"run_id" text,
	"traces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal" jsonb,
	"acknowledged_at" timestamp (3) with time zone,
	"acknowledged_by_run_id" text,
	CONSTRAINT "chat_message_chat_id_position_pk" PRIMARY KEY("chat_id","position"),
	CONSTRAINT "chat_message_position_not_negative" CHECK ("chat_message"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dispatch" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text,
	"kind" "dispatch_kind" NOT NULL,
	"task_id" text,
	"task_revision" integer,
	"station_id" text,
	"chat_id" text,
	"based_on_run_id" text,
	"as_of" timestamp (3) with time zone,
	"trial_repositories" jsonb,
	"follow_up" "dispatch_follow_up",
	"order" jsonb,
	"briefed_task" jsonb,
	"briefing" text,
	"briefed_memories" jsonb DEFAULT '{"briefed":[],"omitted":[]}'::jsonb NOT NULL,
	"station_config" jsonb,
	"station_fingerprint" text,
	"tools_on_marks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ordered_at" timestamp (3) with time zone NOT NULL,
	"enqueued" boolean DEFAULT false NOT NULL,
	"refused" "dispatch_refusal",
	"detached_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone,
	"outcome" "dispatch_outcome",
	"failure" text,
	"stopped" boolean DEFAULT false NOT NULL,
	"asked_a_person" boolean DEFAULT false NOT NULL,
	"superseded" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dispatch_station_config_check" CHECK (("dispatch"."station_config" is null) = ("dispatch"."station_fingerprint" is null)),
	CONSTRAINT "dispatch_ending_check" CHECK (("dispatch"."ended_at" is null) = ("dispatch"."outcome" is null)),
	CONSTRAINT "dispatch_subject_check" CHECK (case "dispatch"."kind"
        when 'task' then "dispatch"."task_id" is not null and "dispatch"."task_revision" is not null and "dispatch"."station_id" is not null and "dispatch"."chat_id" is null and "dispatch"."based_on_run_id" is null
        when 'chat' then "dispatch"."chat_id" is not null and "dispatch"."task_id" is null and "dispatch"."station_id" is null and "dispatch"."based_on_run_id" is null
        else "dispatch"."based_on_run_id" is not null and "dispatch"."task_id" is not null and "dispatch"."station_id" is not null and "dispatch"."chat_id" is null
      end)
);
--> statement-breakpoint
CREATE TABLE "inbox_request" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"form" "inbox_request_form" NOT NULL,
	"about" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"opened_at" timestamp (3) with time zone NOT NULL,
	"resolved_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_request_read" (
	"inbox_request_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "inbox_request_read_inbox_request_id_user_id_pk" PRIMARY KEY("inbox_request_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notice" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"addressee_id" text,
	"form" "notice_form" NOT NULL,
	"subject" text NOT NULL,
	"link" text NOT NULL,
	"link_label" text NOT NULL,
	"external_url" text,
	"external_label" text,
	"headline" text NOT NULL,
	"points" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"resolved_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "notice_subject_idx" UNIQUE NULLS NOT DISTINCT("team_id","addressee_id","form","subject")
);
--> statement-breakpoint
CREATE TABLE "processed_event" (
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"processed_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "processed_event_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
CREATE TABLE "task_draft_state" (
	"task_id" text PRIMARY KEY NOT NULL,
	"state" "bytea" NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"station_id" text NOT NULL,
	"title" text NOT NULL,
	"branch" text NOT NULL,
	"description" text,
	"rank" text DEFAULT 'i' NOT NULL,
	"origin_station_id" text,
	"created_by_id" text,
	"opened_from" text NOT NULL,
	"proposed_in_chat_id" text,
	"proposed_in_position" integer,
	"assignee_id" text,
	"current_run_id" text,
	"session_id" text,
	"runner_id" text,
	"reviewed_pull_request" text,
	"review_from_outside" boolean DEFAULT false NOT NULL,
	"move_held_to" text,
	"finished_at" timestamp (3) with time zone,
	"working_copy_released_at" timestamp (3) with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"is_setup" boolean DEFAULT false NOT NULL,
	"setup_open" boolean DEFAULT false NOT NULL,
	"unread_ask" boolean DEFAULT false NOT NULL,
	"draft_generation" integer DEFAULT 0 NOT NULL,
	"awaited_turn_attempt" integer,
	"answered_turn_at" timestamp (3) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_workspace_id_id_key" UNIQUE("workspace_id","id")
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
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_attachment_place_not_negative" CHECK ("task_attachment"."place" >= 0),
	CONSTRAINT "task_attachment_size_not_negative" CHECK ("task_attachment"."size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task_mark" (
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"held_since" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "task_mark_task_id_kind_value_pk" PRIMARY KEY("task_id","kind","value")
);
--> statement-breakpoint
CREATE TABLE "task_note" (
	"task_id" text NOT NULL,
	"position" integer NOT NULL,
	"station" text,
	"station_id" text NOT NULL,
	"body" text NOT NULL,
	"at" timestamp (3) with time zone NOT NULL,
	"voice" "voice" DEFAULT 'station' NOT NULL,
	"author_id" text,
	"source" text,
	"co_author_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"run_id" text,
	"kind" "task_note_kind" NOT NULL,
	"closes_conversation" boolean DEFAULT false NOT NULL,
	"form" "task_note_form" DEFAULT 'words' NOT NULL,
	"anchor" jsonb,
	"approval" jsonb,
	"failure" jsonb,
	"deferred_move" jsonb,
	"connection_ask" jsonb,
	"answered_at" timestamp (3) with time zone,
	"read_at" timestamp (3) with time zone,
	"acknowledged_at" timestamp (3) with time zone,
	CONSTRAINT "task_note_task_id_position_pk" PRIMARY KEY("task_id","position"),
	CONSTRAINT "task_note_position_not_negative" CHECK ("task_note"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task_pull_request" (
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"url" text NOT NULL,
	"opened_at" timestamp (3) with time zone NOT NULL,
	"closed_at" timestamp (3) with time zone,
	"close_routed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "task_pull_request_task_id_url_pk" PRIMARY KEY("task_id","url")
);
--> statement-breakpoint
CREATE TABLE "team_welcome" (
	"team_id" text PRIMARY KEY NOT NULL,
	"welcomed_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_use" (
	"use_id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"tool" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"output" text NOT NULL,
	"failed" boolean NOT NULL,
	"acting_as" jsonb,
	"at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turn_retake" (
	"run_id" text NOT NULL,
	"suspended_at" timestamp (3) with time zone NOT NULL,
	"attempt" integer NOT NULL,
	"checked_at" timestamp (3) with time zone NOT NULL,
	"retake_due" boolean DEFAULT false NOT NULL,
	"retake_tries" integer DEFAULT 0 NOT NULL,
	"retake_leased_until" timestamp (3) with time zone,
	"retake_lease_token" text,
	CONSTRAINT "turn_retake_run_id_suspended_at_pk" PRIMARY KEY("run_id","suspended_at")
);
--> statement-breakpoint
CREATE TABLE "work_line" (
	"line_id" text PRIMARY KEY NOT NULL,
	"line_version" integer,
	"saved_version" integer
);
--> statement-breakpoint
CREATE TABLE "work_station" (
	"station_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"team_id" text NOT NULL,
	"line_id" text NOT NULL,
	"line_key" text NOT NULL,
	"line_name" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"kind" "work_station_kind" NOT NULL,
	"color" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
DROP INDEX "account_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "expires_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "event_delivery" ADD CONSTRAINT "event_delivery_event_id_event_outbox_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_set_id_decision_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."decision_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_dispute" ADD CONSTRAINT "decision_dispute_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_set_merge" ADD CONSTRAINT "decision_set_merge_set_id_decision_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."decision_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_included_comment" ADD CONSTRAINT "review_included_comment_review_fk" FOREIGN KEY ("workspace_id","review_id") REFERENCES "public"."review"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terraform_state_version" ADD CONSTRAINT "terraform_state_version_state_id_terraform_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."terraform_state"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email" ADD CONSTRAINT "user_email_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_send" ADD CONSTRAINT "verification_send_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_trust" ADD CONSTRAINT "oidc_trust_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_trust_usage" ADD CONSTRAINT "oidc_trust_usage_trust_fk" FOREIGN KEY ("workspace_id","trust_id") REFERENCES "public"."oidc_trust"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_survey" ADD CONSTRAINT "signup_survey_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_survey" ADD CONSTRAINT "signup_survey_respondent_id_user_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_fk" FOREIGN KEY ("workspace_id","team_id") REFERENCES "public"."team"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_workspace_member_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_member"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_accepted_by_id_user_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_team" ADD CONSTRAINT "workspace_invite_team_invite_id_workspace_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."workspace_invite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_token" ADD CONSTRAINT "workspace_token_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_alert" ADD CONSTRAINT "station_alert_station_id_station_alert_state_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station_alert_state"("station_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_operation" ADD CONSTRAINT "spec_operation_hash_spec_document_hash_fk" FOREIGN KEY ("hash") REFERENCES "public"."spec_document"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reaction" ADD CONSTRAINT "line_reaction_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reaction" ADD CONSTRAINT "line_reaction_from_station_id_station_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reaction" ADD CONSTRAINT "line_reaction_to_station_id_station_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_repository" ADD CONSTRAINT "line_repository_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_line_fk" FOREIGN KEY ("workspace_id","line_id") REFERENCES "public"."line"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_route" ADD CONSTRAINT "station_route_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_route" ADD CONSTRAINT "station_route_to_station_id_station_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_skill" ADD CONSTRAINT "station_skill_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_tool" ADD CONSTRAINT "station_tool_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_proposal" ADD CONSTRAINT "memory_proposal_draft_id_memory_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."memory_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_use" ADD CONSTRAINT "memory_use_memory_id_memory_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_entry" ADD CONSTRAINT "replay_entry_replay_id_replay_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."replay"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_outcome" ADD CONSTRAINT "replay_outcome_replay_id_replay_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."replay"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_search_iteration" ADD CONSTRAINT "replay_search_iteration_search_id_replay_search_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."replay_search"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_set_entry" ADD CONSTRAINT "replay_set_entry_set_id_replay_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."replay_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starting_point_hold_run" ADD CONSTRAINT "starting_point_hold_run_hold_fk" FOREIGN KEY ("workspace_id","holder") REFERENCES "public"."starting_point_hold"("workspace_id","holder") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_grant" ADD CONSTRAINT "secret_grant_run_id_run_grants_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run_grants"("run_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_value" ADD CONSTRAINT "secret_value_secret_id_secret_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secret"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_claim" ADD CONSTRAINT "attachment_claim_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."task"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_claim" ADD CONSTRAINT "attachment_claim_chat_fk" FOREIGN KEY ("workspace_id","chat_id") REFERENCES "public"."chat"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mark" ADD CONSTRAINT "chat_mark_chat_fk" FOREIGN KEY ("workspace_id","chat_id") REFERENCES "public"."chat"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_request_read" ADD CONSTRAINT "inbox_request_read_inbox_request_id_inbox_request_id_fk" FOREIGN KEY ("inbox_request_id") REFERENCES "public"."inbox_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_station_fk" FOREIGN KEY ("station_id") REFERENCES "public"."work_station"("station_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_mark" ADD CONSTRAINT "task_mark_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."task"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_pull_request" ADD CONSTRAINT "task_pull_request_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."task"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_delivery_due_idx" ON "event_delivery" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "event_delivery_pending_idx" ON "event_delivery" USING btree ("subscriber") WHERE "event_delivery"."delivered_at" is null;--> statement-breakpoint
CREATE INDEX "event_outbox_recorded_at_idx" ON "event_outbox" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "catalog_call_workspace_called_idx" ON "catalog_call" USING btree ("workspace_id","called_at");--> statement-breakpoint
CREATE INDEX "change_stack_run_idx" ON "change_stack" USING btree ("run_id","started_at");--> statement-breakpoint
CREATE INDEX "change_stack_task_idx" ON "change_stack" USING btree ("task_id","started_at");--> statement-breakpoint
CREATE INDEX "change_stack_team_idx" ON "change_stack" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "change_stack_pending_job_idx" ON "change_stack" USING btree ("pending_job","job_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_position_idx" ON "decision" USING btree ("set_id","position");--> statement-breakpoint
CREATE INDEX "decision_paths_idx" ON "decision" USING gin ("paths");--> statement-breakpoint
CREATE INDEX "decision_dispute_decision_idx" ON "decision_dispute" USING btree ("decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_set_task_idx" ON "decision_set" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "decision_set_generation_idx" ON "decision_set" USING btree ("generation_requested_at");--> statement-breakpoint
CREATE INDEX "decision_set_workspace_idx" ON "decision_set" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "decision_set_merge_repository_idx" ON "decision_set_merge" USING btree ("repository","merged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "question_answer_person_idx" ON "question_answer" USING btree ("stack_id","person_id","question_id");--> statement-breakpoint
CREATE INDEX "question_answer_task_idx" ON "question_answer" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "question_answer_team_idx" ON "question_answer" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "review_task_idx" ON "review" USING btree ("task_id","submitted_at");--> statement-breakpoint
CREATE INDEX "review_comment_reply_to_idx" ON "review_comment" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "review_comment_review_idx" ON "review_comment" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_comment_task_idx" ON "review_comment" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_comment_github_idx" ON "review_comment" USING btree ("workspace_id","github_id");--> statement-breakpoint
CREATE INDEX "review_delivery_due_idx" ON "review_delivery" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "review_delivery_task_idx" ON "review_delivery" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "review_delivery_review_idx" ON "review_delivery" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_delivery_comment_idx" ON "review_delivery" USING btree ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_included_comment_position_idx" ON "review_included_comment" USING btree ("review_id","position");--> statement-breakpoint
CREATE INDEX "review_included_comment_comment_idx" ON "review_included_comment" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "stack_check_run_idx" ON "stack_check" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "stack_check_task_idx" ON "stack_check" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "stack_check_team_idx" ON "stack_check" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "stack_check_waiting_idx" ON "stack_check" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "stack_check_reserved_idx" ON "stack_check" USING btree ("reserved_for");--> statement-breakpoint
CREATE INDEX "stack_check_wait_expiry_idx" ON "stack_check" USING btree ("status","waiting_since");--> statement-breakpoint
CREATE INDEX "github_pull_request_number_idx" ON "github_pull_request" USING btree ("workspace_id","repository","number");--> statement-breakpoint
CREATE INDEX "github_pull_request_closed_idx" ON "github_pull_request" USING btree ("closed_at");--> statement-breakpoint
CREATE INDEX "github_pull_request_updated_idx" ON "github_pull_request" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deviceCode_deviceCode_uidx" ON "device_code" USING btree ("device_code");--> statement-breakpoint
CREATE UNIQUE INDEX "deviceCode_userCode_uidx" ON "device_code" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "configuration_change_workspace_idx" ON "configuration_change" USING btree ("workspace_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_user_email_idx" ON "user_email" USING btree ("user_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_verified_email_idx" ON "user_email" USING btree (lower("email")) WHERE "user_email"."verified_at" is not null;--> statement-breakpoint
CREATE INDEX "user_email_user_idx" ON "user_email" USING btree ("user_id","added_at");--> statement-breakpoint
CREATE INDEX "verification_send_user_idx" ON "verification_send" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oidc_trust_workspace_key_idx" ON "oidc_trust" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "signup_survey_respondent_idx" ON "signup_survey" USING btree ("respondent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_workspace_key_idx" ON "team" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invite_workspace_email_idx" ON "workspace_invite" USING btree ("workspace_id",lower("email")) WHERE "workspace_invite"."accepted_at" is null and "workspace_invite"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "workspace_invite_invited_by_idx" ON "workspace_invite" USING btree ("invited_by_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_accepted_by_idx" ON "workspace_invite" USING btree ("accepted_by_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_workspace_idx" ON "workspace_invite" USING btree ("workspace_id","invited_at");--> statement-breakpoint
CREATE INDEX "workspace_invite_team_team_idx" ON "workspace_invite_team" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "workspace_member_user_idx" ON "workspace_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_token_workspace_name_idx" ON "workspace_token" USING btree ("workspace_id","name") WHERE "workspace_token"."issued_by_trust_id" is null and "workspace_token"."run_id" is null;--> statement-breakpoint
CREATE INDEX "workspace_token_run_id_idx" ON "workspace_token" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workspace_token_issued_by_trust_id_idx" ON "workspace_token" USING btree ("issued_by_trust_id");--> statement-breakpoint
CREATE INDEX "workspace_token_issued_expiry_idx" ON "workspace_token" USING btree ("expires_at") WHERE "workspace_token"."issued_by_trust_id" is not null or "workspace_token"."run_id" is not null;--> statement-breakpoint
CREATE INDEX "chat_record_team_idx" ON "chat_record" USING btree ("team_id","started_at");--> statement-breakpoint
CREATE INDEX "chat_record_workspace_idx" ON "chat_record" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "deleted_task_workspace_idx" ON "deleted_task" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "judging_pending_idx" ON "judging" USING btree ("queued_at") WHERE "judging"."pending";--> statement-breakpoint
CREATE INDEX "judging_task_idx" ON "judging" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "judging_workspace_idx" ON "judging" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "pull_request_record_opened_idx" ON "pull_request_record" USING btree ("workspace_id","opened_at");--> statement-breakpoint
CREATE INDEX "pull_request_record_repository_idx" ON "pull_request_record" USING btree ("workspace_id","repository");--> statement-breakpoint
CREATE INDEX "pull_request_record_owner_idx" ON "pull_request_record" USING btree ("owner_task_id");--> statement-breakpoint
CREATE INDEX "pull_request_record_team_idx" ON "pull_request_record" USING btree ("owner_team_id");--> statement-breakpoint
CREATE INDEX "pull_request_record_purged_idx" ON "pull_request_record" USING btree ("github_purged_at");--> statement-breakpoint
CREATE INDEX "pull_request_record_review_tasks_idx" ON "pull_request_record" USING gin ("review_task_ids");--> statement-breakpoint
CREATE INDEX "pull_request_record_review_teams_idx" ON "pull_request_record" USING gin ("review_team_ids");--> statement-breakpoint
CREATE INDEX "run_fact_team_ended_idx" ON "run_fact" USING btree ("workspace_id","team_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_fact_ended_idx" ON "run_fact" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "run_fact_station_began_idx" ON "run_fact" USING btree ("workspace_id","team_id","station_id","began_at","run_id" collate "C");--> statement-breakpoint
CREATE INDEX "run_fact_station_ended_idx" ON "run_fact" USING btree ("workspace_id","team_id","station_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_fact_config_idx" ON "run_fact" USING btree ("team_id","station_id","began_at","run_id" collate "C") WHERE "run_fact"."ran_a_config";--> statement-breakpoint
CREATE INDEX "run_fact_task_idx" ON "run_fact" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "run_record_team_idx" ON "run_record" USING btree ("team_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_record_task_idx" ON "run_record" USING btree ("task_id","ended_at");--> statement-breakpoint
CREATE INDEX "run_record_workspace_idx" ON "run_record" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_record_ended_idx" ON "run_record" USING btree ("ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "score_judge_idx" ON "score" USING btree ("run_id","rubric_version") WHERE "score"."source" = 'judge';--> statement-breakpoint
CREATE UNIQUE INDEX "score_person_idx" ON "score" USING btree ("run_id","scored_by_id") WHERE "score"."source" = 'person';--> statement-breakpoint
CREATE INDEX "score_station_idx" ON "score" USING btree ("station_id","at");--> statement-breakpoint
CREATE INDEX "score_task_idx" ON "score" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "score_workspace_idx" ON "score" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "station_alert_station_idx" ON "station_alert" USING btree ("station_id","fired_at");--> statement-breakpoint
CREATE INDEX "station_alert_task_idx" ON "station_alert" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "station_alert_open_rule_idx" ON "station_alert" USING btree ("station_id","measure","condition") WHERE "station_alert"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "station_alert_state_team_idx" ON "station_alert_state" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "task_change_shape_team_idx" ON "task_change_shape" USING btree ("workspace_id","team_id");--> statement-breakpoint
CREATE INDEX "task_failures_last_idx" ON "task_failures" USING btree ("workspace_id","last_at");--> statement-breakpoint
CREATE INDEX "task_failures_team_idx" ON "task_failures" USING btree ("team_id","last_at");--> statement-breakpoint
CREATE INDEX "task_human_action_team_idx" ON "task_human_action" USING btree ("team_id","last_action_at");--> statement-breakpoint
CREATE INDEX "task_human_action_workspace_idx" ON "task_human_action" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_pull_request_fact_team_idx" ON "task_pull_request_fact" USING btree ("workspace_id","team_id","opened_at");--> statement-breakpoint
CREATE INDEX "inbound_delivery_state_idx" ON "inbound_delivery" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "hook_callback_expires_idx" ON "hook_callback" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "hook_definition_on_idx" ON "hook_definition" USING btree ("team_id","on");--> statement-breakpoint
CREATE INDEX "hook_firing_state_idx" ON "hook_firing" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "hook_firing_repeats_idx" ON "hook_firing" USING btree ("hook_id","task_id","fired_at");--> statement-breakpoint
CREATE INDEX "inferred_output_schema_integration_idx" ON "inferred_output_schema" USING btree ("team_id","integration");--> statement-breakpoint
CREATE INDEX "integration_connection_owner_idx" ON "integration_connection" USING btree ("team_id","owner");--> statement-breakpoint
CREATE INDEX "line_workspace_idx" ON "line" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "line_team_key_idx" ON "line" USING btree ("team_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "line_team_role_idx" ON "line" USING btree ("team_id","role") WHERE "line"."role" is not null;--> statement-breakpoint
CREATE INDEX "line_reaction_from_station_idx" ON "line_reaction" USING btree ("from_station_id");--> statement-breakpoint
CREATE INDEX "line_reaction_to_station_idx" ON "line_reaction" USING btree ("to_station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "station_line_key_idx" ON "station" USING btree ("line_id","key");--> statement-breakpoint
CREATE INDEX "station_route_to_station_idx" ON "station_route" USING btree ("to_station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_handle_idx" ON "memory" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "memory_superseded_by_idx" ON "memory" USING btree ("superseded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_supersedes_idx" ON "memory" USING btree ("supersedes");--> statement-breakpoint
CREATE INDEX "memory_status_idx" ON "memory" USING btree ("team_id","status","approved_at");--> statement-breakpoint
CREATE INDEX "memory_body_search_idx" ON "memory" USING gin (to_tsvector('english', "body"));--> statement-breakpoint
CREATE UNIQUE INDEX "memory_draft_task_idx" ON "memory_draft" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "memory_draft_drafting_idx" ON "memory_draft" USING btree ("drafting_requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_proposal_position_idx" ON "memory_proposal" USING btree ("draft_id","position");--> statement-breakpoint
CREATE INDEX "memory_proposal_decided_idx" ON "memory_proposal" USING btree ("team_id","state","decided_at");--> statement-breakpoint
CREATE INDEX "memory_use_run_idx" ON "memory_use" USING btree ("run_id","at");--> statement-breakpoint
CREATE INDEX "arrival_ledger_recount_idx" ON "arrival_ledger" USING btree ("recount_requested_at");--> statement-breakpoint
CREATE INDEX "push_subscription_person_idx" ON "push_subscription" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "change_judging_pending_idx" ON "change_judging" USING btree ("queued_at") WHERE "change_judging"."pending";--> statement-breakpoint
CREATE INDEX "change_judging_team_idx" ON "change_judging" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "config_pull_request_candidate_idx" ON "config_pull_request" USING btree ("search_id","candidate_id");--> statement-breakpoint
CREATE INDEX "config_pull_request_team_idx" ON "config_pull_request" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "config_pull_request_station_idx" ON "config_pull_request" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "config_pull_request_host_idx" ON "config_pull_request" USING btree ("workspace_id","host_id");--> statement-breakpoint
CREATE UNIQUE INDEX "config_pull_request_number_idx" ON "config_pull_request" USING btree ("workspace_id",lower("repository"),"number");--> statement-breakpoint
CREATE UNIQUE INDEX "config_pull_request_open_station_idx" ON "config_pull_request" USING btree ("station_id") WHERE "config_pull_request"."open";--> statement-breakpoint
CREATE INDEX "config_pull_request_check_idx" ON "config_pull_request" USING btree ("checked_at") WHERE "config_pull_request"."state" = 'opened';--> statement-breakpoint
CREATE INDEX "config_pull_request_due_idx" ON "config_pull_request" USING btree ("state","due_at") WHERE "config_pull_request"."state" in ('opening', 'closing');--> statement-breakpoint
CREATE INDEX "line_search_budget_team_idx" ON "line_search_budget" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_set_idx" ON "replay" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "replay_candidate_idx" ON "replay" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "replay_team_state_idx" ON "replay" USING btree ("team_id","state");--> statement-breakpoint
CREATE INDEX "replay_team_started_idx" ON "replay" USING btree ("team_id","started_at");--> statement-breakpoint
CREATE INDEX "replay_search_idx" ON "replay" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "replay_pairwise_reference_idx" ON "replay" USING btree ("pairwise_reference_id");--> statement-breakpoint
CREATE INDEX "replay_candidate_station_idx" ON "replay_candidate" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "replay_candidate_team_idx" ON "replay_candidate" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_candidate_search_idx" ON "replay_candidate" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "replay_check_team_idx" ON "replay_check" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_check_awaiting_idx" ON "replay_check" USING btree ("created_at") WHERE "replay_check"."baseline" = 'awaiting';--> statement-breakpoint
CREATE INDEX "replay_check_set_idx" ON "replay_check" USING btree ("set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_check_attempt_idx" ON "replay_check" USING btree ("station_id","change","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_entry_run_idx" ON "replay_entry" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_entry_slot_idx" ON "replay_entry" USING btree ("pool","slot") WHERE "replay_entry"."occupying";--> statement-breakpoint
CREATE INDEX "replay_outcome_team_started_idx" ON "replay_outcome" USING btree ("team_id","started_at");--> statement-breakpoint
CREATE INDEX "replay_outcome_set_baseline_idx" ON "replay_outcome" USING btree ("set_id","started_at") WHERE "replay_outcome"."serves_as_baseline";--> statement-breakpoint
CREATE INDEX "replay_outcome_set_health_sample_idx" ON "replay_outcome" USING btree ("set_id","health_sample_group","sampled_at") WHERE "replay_outcome"."health_sample_group" is not null;--> statement-breakpoint
CREATE INDEX "replay_outcome_search_idx" ON "replay_outcome" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "replay_run_decision_team_idx" ON "replay_run_decision" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_run_decision_replay_idx" ON "replay_run_decision" USING btree ("replay_id");--> statement-breakpoint
CREATE INDEX "replay_search_team_idx" ON "replay_search" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_search_set_idx" ON "replay_search" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "replay_search_line_started_idx" ON "replay_search" USING btree ("line_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_search_active_idx" ON "replay_search" USING btree ("station_id") WHERE "replay_search"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "replay_search_iteration_run_idx" ON "replay_search_iteration" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_set_station_idx" ON "replay_set" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "replay_set_team_idx" ON "replay_set" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "replay_set_line_idx" ON "replay_set" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "replay_set_refreshed_at_idx" ON "replay_set" USING btree ("refreshed_at");--> statement-breakpoint
CREATE INDEX "side_by_side_judging_pending_idx" ON "side_by_side_judging" USING btree ("queued_at") WHERE "side_by_side_judging"."pending";--> statement-breakpoint
CREATE INDEX "side_by_side_judging_team_idx" ON "side_by_side_judging" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "station_search_schedule_set_idx" ON "station_search_schedule" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "station_search_schedule_team_idx" ON "station_search_schedule" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "station_search_schedule_line_idx" ON "station_search_schedule" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "station_search_schedule_check_after_idx" ON "station_search_schedule" USING btree ("check_after");--> statement-breakpoint
CREATE INDEX "station_search_schedule_steps_pending_idx" ON "station_search_schedule" USING btree ("steps_pending_since") WHERE "station_search_schedule"."steps_pending_since" is not null;--> statement-breakpoint
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
CREATE INDEX "runner_host_last_heartbeat_idx" ON "runner_host" USING btree ("last_heartbeat_at");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_pool_workspace_key_idx" ON "runner_pool" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_pool_token_hash_idx" ON "runner_pool" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_trust_workspace_key_idx" ON "runner_trust" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_open_key_idx" ON "sandbox" USING btree ("workspace_id","key") WHERE "sandbox"."key" is not null and "sandbox"."state" = 'open';--> statement-breakpoint
CREATE INDEX "sandbox_host_live_idx" ON "sandbox" USING btree ("host_id") WHERE "sandbox"."state" <> 'gone';--> statement-breakpoint
CREATE INDEX "sandbox_idle_idx" ON "sandbox" USING btree ("idle_since") WHERE "sandbox"."state" = 'open';--> statement-breakpoint
CREATE INDEX "sandbox_pool_idle_idx" ON "sandbox" USING btree ("pool_id") WHERE "sandbox"."state" <> 'gone' and "sandbox"."idle_since" is not null;--> statement-breakpoint
CREATE INDEX "sandbox_gone_idx" ON "sandbox" USING btree ("gone_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_token_hash_idx" ON "sandbox" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sandbox_requested_idx" ON "sandbox" USING btree ("workspace_id","started_at") WHERE "sandbox"."host_id" is null and "sandbox"."state" = 'open';--> statement-breakpoint
CREATE INDEX "sandbox_warm_idx" ON "sandbox" USING btree ("workspace_id","state") WHERE "sandbox"."warm" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_runners_workspace_idx" ON "workspace_runners" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "network_call_waiting_idx" ON "network_call" USING btree ("workspace_id","state","queued_at");--> statement-breakpoint
CREATE INDEX "network_call_expiring_idx" ON "network_call" USING btree ("state","expires_at");--> statement-breakpoint
CREATE INDEX "network_call_responded_idx" ON "network_call" USING btree ("state","responded_at");--> statement-breakpoint
CREATE INDEX "network_call_abandoned_idx" ON "network_call" USING btree ("state","abandoned_at");--> statement-breakpoint
CREATE INDEX "run_connection_run_idx" ON "run_connection" USING btree ("run_id","at");--> statement-breakpoint
CREATE INDEX "run_connection_at_idx" ON "run_connection" USING btree ("at");--> statement-breakpoint
CREATE INDEX "run_queue_idx" ON "run" USING btree ("harness","state","priority","created_at");--> statement-breakpoint
CREATE INDEX "run_lease_idx" ON "run" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "run_workspace_idx" ON "run" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_requester_idx" ON "run" USING btree ("requester_owner","requester_kind","requester_id");--> statement-breakpoint
CREATE INDEX "run_queued_line_idx" ON "run" USING btree ("workspace_id","line_id") WHERE "run"."line_id" is not null and "run"."state" = 'queued';--> statement-breakpoint
CREATE INDEX "run_working_copy_key_idx" ON "run" USING btree ("workspace_id","working_copy_key");--> statement-breakpoint
CREATE INDEX "run_team_idx" ON "run" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "run_created_idx" ON "run" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "run_turn_idx" ON "run" USING btree ("turn","suspended_at");--> statement-breakpoint
CREATE INDEX "run_reserved_idx" ON "run" USING btree ("reserved_for");--> statement-breakpoint
CREATE INDEX "run_started_from_idx" ON "run" USING btree ("started_from_archive_id","started_from_at");--> statement-breakpoint
CREATE INDEX "starting_point_hold_run_run_idx" ON "starting_point_hold_run" USING btree ("workspace_id","run_id");--> statement-breakpoint
CREATE INDEX "working_copy_archive_key_idx" ON "working_copy_archive" USING btree ("workspace_id","working_copy_key","completed_at");--> statement-breakpoint
CREATE INDEX "working_copy_archive_granted_idx" ON "working_copy_archive" USING btree ("granted_at","id");--> statement-breakpoint
CREATE INDEX "working_copy_archive_granted_to_run_idx" ON "working_copy_archive" USING btree ("granted_to_run_id");--> statement-breakpoint
CREATE INDEX "run_grants_workspace_idx" ON "run_grants" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_grants_ended_idx" ON "run_grants" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "attachment_claim_task_idx" ON "attachment_claim" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "attachment_claim_chat_idx" ON "attachment_claim" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "chat_team_starter_idx" ON "chat" USING btree ("team_id","started_by_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "chat_attachment_chat_idx" ON "chat_attachment" USING btree ("chat_id","message_position");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_mark_finding_uidx" ON "chat_mark" USING btree ("workspace_id","kind","value") WHERE "chat_mark"."finds";--> statement-breakpoint
CREATE INDEX "chat_message_run_idx" ON "chat_message" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "dispatch_task_idx" ON "dispatch" USING btree ("task_id","ordered_at");--> statement-breakpoint
CREATE INDEX "dispatch_station_ended_idx" ON "dispatch" USING btree ("station_id","ended_at");--> statement-breakpoint
CREATE INDEX "dispatch_station_fingerprint_idx" ON "dispatch" USING btree ("station_fingerprint");--> statement-breakpoint
CREATE INDEX "dispatch_chat_idx" ON "dispatch" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "dispatch_based_on_idx" ON "dispatch" USING btree ("based_on_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_request_about_idx" ON "inbox_request" USING btree ("task_id","form","about");--> statement-breakpoint
CREATE INDEX "inbox_request_workspace_idx" ON "inbox_request" USING btree ("workspace_id","resolved_at");--> statement-breakpoint
CREATE INDEX "inbox_request_workspace_opened_idx" ON "inbox_request" USING btree ("workspace_id","opened_at","id");--> statement-breakpoint
CREATE INDEX "notice_addressee_idx" ON "notice" USING btree ("workspace_id","addressee_id");--> statement-breakpoint
CREATE INDEX "notice_team_idx" ON "notice" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "notice_workspace_created_idx" ON "notice" USING btree ("workspace_id","created_at","id");--> statement-breakpoint
CREATE INDEX "processed_event_processed_at_idx" ON "processed_event" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_proposed_in_uidx" ON "task" USING btree ("proposed_in_chat_id","proposed_in_position");--> statement-breakpoint
CREATE INDEX "task_station_idx" ON "task" USING btree ("station_id","rank");--> statement-breakpoint
CREATE INDEX "task_origin_station_idx" ON "task" USING btree ("origin_station_id");--> statement-breakpoint
CREATE INDEX "task_workspace_idx" ON "task" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_workspace_assignee_idx" ON "task" USING btree ("workspace_id","assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_workspace_branch_uidx" ON "task" USING btree ("workspace_id","branch");--> statement-breakpoint
CREATE INDEX "task_attachment_task_idx" ON "task_attachment" USING btree ("task_id","note_position");--> statement-breakpoint
CREATE INDEX "task_mark_mark_idx" ON "task_mark" USING btree ("workspace_id","kind","value");--> statement-breakpoint
CREATE INDEX "task_note_run_idx" ON "task_note" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "task_note_closing_idx" ON "task_note" USING btree ("task_id","at") WHERE "task_note"."closes_conversation";--> statement-breakpoint
CREATE INDEX "task_note_connection_ask_idx" ON "task_note" USING btree (("connection_ask"->>'personId'),("connection_ask"->>'integration')) WHERE "task_note"."connection_ask" is not null and ("task_note"."connection_ask"->>'met')::boolean = false;--> statement-breakpoint
CREATE INDEX "task_pull_request_url_idx" ON "task_pull_request" USING btree ("workspace_id","url");--> statement-breakpoint
CREATE INDEX "tool_use_at_idx" ON "tool_use" USING btree ("at");--> statement-breakpoint
CREATE INDEX "work_station_team_idx" ON "work_station" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "work_station_line_idx" ON "work_station" USING btree ("line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_uidx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "issuer";