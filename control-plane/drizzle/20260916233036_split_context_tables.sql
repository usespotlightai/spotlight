ALTER TABLE "change_stack" DROP CONSTRAINT "change_stack_run_id_run_id_fk";
--> statement-breakpoint
ALTER TABLE "change_stack" DROP CONSTRAINT "change_stack_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "review" DROP CONSTRAINT "review_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "review" DROP CONSTRAINT "review_task_id_task_id_fk";
--> statement-breakpoint
ALTER TABLE "review" DROP CONSTRAINT "review_author_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "review_comment" DROP CONSTRAINT "review_comment_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "review_comment" DROP CONSTRAINT "review_comment_task_id_task_id_fk";
--> statement-breakpoint
ALTER TABLE "review_comment" DROP CONSTRAINT "review_comment_author_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "review_sync" DROP CONSTRAINT "review_sync_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "review_sync" DROP CONSTRAINT "review_sync_task_id_task_id_fk";
--> statement-breakpoint
ALTER TABLE "configuration_home" DROP CONSTRAINT "configuration_home_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "configuration_home" DROP CONSTRAINT "configuration_home_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "team_config" DROP CONSTRAINT "team_config_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "team_vault_key" DROP CONSTRAINT "team_vault_key_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "chat" DROP CONSTRAINT "chat_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "chat" DROP CONSTRAINT "chat_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "chat" DROP CONSTRAINT "chat_started_by_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_author_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "factory" DROP CONSTRAINT "factory_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "factory" DROP CONSTRAINT "factory_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_cursor" DROP CONSTRAINT "integration_cursor_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth2_connection" DROP CONSTRAINT "oauth2_connection_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "line" DROP CONSTRAINT "line_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "run" DROP CONSTRAINT "run_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_raised_by_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_assignee_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task_note" DROP CONSTRAINT "task_note_author_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_connection" DROP CONSTRAINT "workspace_connection_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "change_stack" ADD COLUMN "task_id" text;--> statement-breakpoint
CREATE INDEX "change_stack_task_idx" ON "change_stack" USING btree ("task_id","drafted_at");