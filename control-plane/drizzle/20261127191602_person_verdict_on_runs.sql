ALTER TYPE "public"."judge_label_source" ADD VALUE 'marked-right';--> statement-breakpoint
ALTER TYPE "public"."judge_label_source" ADD VALUE 'marked-wrong';--> statement-breakpoint
ALTER TABLE "run_fact" ADD COLUMN "person_verdict_right" boolean;--> statement-breakpoint
ALTER TABLE "run_fact" ADD COLUMN "person_verdict_reason" text;--> statement-breakpoint
ALTER TABLE "run_fact" ADD COLUMN "person_verdict_by" text;--> statement-breakpoint
ALTER TABLE "run_fact" ADD COLUMN "person_verdict_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "run_record" ADD COLUMN "person_verdict_right" boolean;--> statement-breakpoint
ALTER TABLE "run_record" ADD COLUMN "person_verdict_reason" text;--> statement-breakpoint
ALTER TABLE "run_record" ADD COLUMN "person_verdict_by" text;--> statement-breakpoint
ALTER TABLE "run_record" ADD COLUMN "person_verdict_at" timestamp (3) with time zone;