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
CREATE TABLE "secret_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"secret_id" text NOT NULL,
	"secret_name" text NOT NULL,
	"change" text NOT NULL,
	"by" text,
	"value_version" integer,
	"hosts" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "host_connection" ADD COLUMN "workspace_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "secret_grant" ADD CONSTRAINT "secret_grant_secret_id_secret_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secret"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_value" ADD CONSTRAINT "secret_value_secret_id_secret_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secret"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "secret_audit_secret_idx" ON "secret_audit" USING btree ("workspace_id","secret_id");