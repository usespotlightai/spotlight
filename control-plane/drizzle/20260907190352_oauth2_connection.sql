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
ALTER TABLE "oauth2_connection" ADD CONSTRAINT "oauth2_connection_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;