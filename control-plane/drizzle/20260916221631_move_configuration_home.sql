CREATE TABLE "configuration_home" (
	"team_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kept_in" text,
	"moving_to" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuration_home" ADD CONSTRAINT "configuration_home_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuration_home" ADD CONSTRAINT "configuration_home_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" DROP COLUMN "config_repository";--> statement-breakpoint
ALTER TABLE "team" DROP COLUMN "config_moving_to";