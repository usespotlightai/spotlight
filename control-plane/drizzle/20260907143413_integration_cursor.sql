CREATE TABLE "integration_cursor" (
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"cursor" text,
	"ran_at" timestamp,
	CONSTRAINT "integration_cursor_team_id_source_pk" PRIMARY KEY("team_id","source")
);
--> statement-breakpoint
ALTER TABLE "integration_cursor" ADD CONSTRAINT "integration_cursor_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;