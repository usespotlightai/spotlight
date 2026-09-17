ALTER TABLE "github_connection" RENAME COLUMN "external_id" TO "installation_id";--> statement-breakpoint
ALTER TABLE "host_connection" RENAME COLUMN "identity" TO "handle";--> statement-breakpoint
DROP INDEX "workspace_connection_workspace_source_idx";--> statement-breakpoint
ALTER TABLE "github_connection" DROP CONSTRAINT "github_connection_source_external_id_pk";--> statement-breakpoint
ALTER TABLE "github_connection" ADD PRIMARY KEY ("workspace_id");--> statement-breakpoint
ALTER TABLE "github_connection" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "host_connection" ADD COLUMN "renewal_refused_at" timestamp;--> statement-breakpoint
ALTER TABLE "host_connection" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "github_connection" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "github_connection" ADD CONSTRAINT "github_connection_installation_id_unique" UNIQUE("installation_id");