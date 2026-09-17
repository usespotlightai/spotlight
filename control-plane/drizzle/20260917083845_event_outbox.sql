CREATE TABLE "event_delivery" (
	"event_id" uuid NOT NULL,
	"subscriber" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"last_error" text,
	CONSTRAINT "event_delivery_event_id_subscriber_pk" PRIMARY KEY("event_id","subscriber")
);
--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_delivery" ADD CONSTRAINT "event_delivery_event_id_event_outbox_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_delivery_due_idx" ON "event_delivery" USING btree ("due_at");