CREATE TABLE "inference_endpoint" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"base_url" text NOT NULL,
	"model" text NOT NULL,
	"supports_reasoning_effort" boolean DEFAULT false NOT NULL,
	"api_key_version" integer,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "inference_endpoint_workspace_idx" ON "inference_endpoint" USING btree ("workspace_id");