-- Factories created before assembly lines exist have no board, but every
-- factory is meant to open with one. Give each of them the default line and
-- its four stations. gen_random_uuid() matches CryptoIdGenerator's format.
WITH seeded AS (
  INSERT INTO "assembly_line" ("id", "workspace_id", "factory_id", "name")
  SELECT
    gen_random_uuid()::text,
    "factory"."workspace_id",
    "factory"."id",
    'Default'
  FROM "factory"
  LEFT JOIN "assembly_line" ON "assembly_line"."factory_id" = "factory"."id"
  WHERE "assembly_line"."id" IS NULL
  RETURNING "id"
)
INSERT INTO "station" ("id", "assembly_line_id", "name", "position")
SELECT
  gen_random_uuid()::text,
  "seeded"."id",
  "defaults"."name",
  "defaults"."position"
FROM "seeded"
CROSS JOIN (
  VALUES ('Triage', 0), ('Spec', 1), ('Implementation', 2), ('Code Review', 3)
) AS "defaults"("name", "position");
