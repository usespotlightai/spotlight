-- Teams created before the factory table exists have no envelope, but the
-- domain assumes every team has exactly one. Give each of them a factory.
INSERT INTO "factory" ("id", "workspace_id", "team_id")
SELECT gen_random_uuid()::text, "team"."workspace_id", "team"."id"
FROM "team"
LEFT JOIN "factory" ON "factory"."team_id" = "team"."id"
WHERE "factory"."id" IS NULL;
