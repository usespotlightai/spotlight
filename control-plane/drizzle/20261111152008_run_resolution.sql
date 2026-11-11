CREATE TYPE "public"."run_resolution" AS ENUM('accepted', 'sent-back', 'moved-on', 'failed', 'other');--> statement-breakpoint
ALTER TABLE "run_fact" ADD COLUMN "resolution" "run_resolution";