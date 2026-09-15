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
	"proposal" jsonb,
	"delivered_at" timestamp,
	CONSTRAINT "chat_message_chat_id_position_pk" PRIMARY KEY("chat_id","position")
);
--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "chat_id" text;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_started_by_id_user_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_runner_id_runner_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runner"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_team_starter_idx" ON "chat" USING btree ("team_id","started_by_id","updated_at");--> statement-breakpoint
CREATE INDEX "chat_attachment_chat_idx" ON "chat_attachment" USING btree ("chat_id","message_position");--> statement-breakpoint
CREATE INDEX "run_chat_idx" ON "run" USING btree ("chat_id");