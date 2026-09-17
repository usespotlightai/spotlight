UPDATE "runner" SET "workspace_id" = COALESCE(
  (SELECT "workspace_id" FROM "github_connection" ORDER BY "created_at" LIMIT 1),
  (SELECT "id" FROM "workspace" ORDER BY "created_at" LIMIT 1)
) WHERE "workspace_id" IS NULL;--> statement-breakpoint
DELETE FROM "runner" WHERE "workspace_id" IS NULL;--> statement-breakpoint
UPDATE "change_stack" SET "facts" = '{"hunks":[],"links":[],"imports":[]}'::jsonb WHERE "facts" IS NULL;--> statement-breakpoint
UPDATE "github_connection" SET "version" = 1 WHERE "version" = 0;--> statement-breakpoint
UPDATE "run" SET "stopped" = true WHERE "message" = 'Stopped from the console.';
