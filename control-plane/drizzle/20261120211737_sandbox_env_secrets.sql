ALTER TABLE "harness_profile" ADD COLUMN "env" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "secret" ADD COLUMN "sandbox" text DEFAULT 'stand-in' NOT NULL;