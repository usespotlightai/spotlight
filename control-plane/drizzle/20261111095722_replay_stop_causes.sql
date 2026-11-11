CREATE TYPE "public"."replay_stop_cause" AS ENUM('superseded', 'insufficient-credits', 'search-ended', 'stale');--> statement-breakpoint
ALTER TYPE "public"."judging_failure" ADD VALUE 'insufficient-credits' BEFORE 'unreadable';--> statement-breakpoint
ALTER TYPE "public"."replay_judging_failure" ADD VALUE 'insufficient-credits' BEFORE 'unreadable';--> statement-breakpoint
ALTER TABLE "replay" ADD COLUMN "stopped_because" "replay_stop_cause";