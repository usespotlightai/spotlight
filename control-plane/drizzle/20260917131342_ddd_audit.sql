ALTER TABLE "workspace_connection" RENAME TO "github_connection";--> statement-breakpoint
ALTER TABLE "oauth2_connection" RENAME TO "host_connection";--> statement-breakpoint
DROP INDEX "team_invite_team_email_idx";--> statement-breakpoint
ALTER TABLE "github_connection" DROP CONSTRAINT "workspace_connection_source_external_id_pk";--> statement-breakpoint
ALTER TABLE "host_connection" DROP CONSTRAINT "oauth2_connection_team_id_source_pk";--> statement-breakpoint
ALTER TABLE "github_connection" ADD CONSTRAINT "github_connection_source_external_id_pk" PRIMARY KEY("source","external_id");--> statement-breakpoint
ALTER TABLE "host_connection" ADD CONSTRAINT "host_connection_team_id_source_pk" PRIMARY KEY("team_id","source");--> statement-breakpoint
ALTER TABLE "change_stack" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_comment" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_config" ADD COLUMN "integrations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runner" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "runner" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "line" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "stopped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "team_invite_team_idx" ON "team_invite" USING btree ("team_id","email");--> statement-breakpoint
CREATE INDEX "runner_workspace_idx" ON "runner" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_team_email_idx" ON "team_invite" USING btree ("team_id","email") WHERE "team_invite"."accepted_at" is null and "team_invite"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "team_invite" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "team_member" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."team_role";