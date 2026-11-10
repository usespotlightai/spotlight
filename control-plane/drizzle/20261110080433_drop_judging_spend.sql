ALTER TABLE "change_judging" DROP COLUMN "spent";--> statement-breakpoint
ALTER TABLE "replay_entry" DROP COLUMN "judging_spent";--> statement-breakpoint
ALTER TABLE "replay_entry" DROP COLUMN "rejudging_spent";--> statement-breakpoint
ALTER TABLE "replay_entry" DROP COLUMN "pairing_spent";--> statement-breakpoint
ALTER TABLE "side_by_side_judging" DROP COLUMN "most_attempts";--> statement-breakpoint
ALTER TABLE "side_by_side_judging" DROP COLUMN "spent";