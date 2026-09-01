-- A happening is now named by the source that raises it, so two hosts saying
-- the same thing say two different words. The five GitHub already raised keep
-- their meaning under their new names.
UPDATE "station_reaction" SET "happening" = 'github.pull_request.merged' WHERE "happening" = 'merged';--> statement-breakpoint
UPDATE "station_reaction" SET "happening" = 'github.pull_request.commented' WHERE "happening" = 'commented';--> statement-breakpoint
UPDATE "station_reaction" SET "happening" = 'github.pull_request.changes-requested' WHERE "happening" = 'changes-requested';--> statement-breakpoint
UPDATE "station_reaction" SET "happening" = 'github.checks.failed' WHERE "happening" = 'checks-failed';--> statement-breakpoint
UPDATE "station_reaction" SET "happening" = 'github.pull_request.closed-unmerged' WHERE "happening" = 'closed-unmerged';
