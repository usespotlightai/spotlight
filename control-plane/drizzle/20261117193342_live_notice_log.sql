CREATE TABLE "live_channel" (
	"channel" text PRIMARY KEY NOT NULL,
	"last_sequence" bigint NOT NULL,
	CONSTRAINT "live_channel_last_sequence_positive" CHECK ("live_channel"."last_sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "live_notice" (
	"channel" text NOT NULL,
	"sequence" bigint NOT NULL,
	"topic" text NOT NULL,
	"ids" jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_notice_channel_sequence_pk" PRIMARY KEY("channel","sequence")
);
--> statement-breakpoint
CREATE INDEX "live_notice_recorded_at_idx" ON "live_notice" USING btree ("recorded_at");