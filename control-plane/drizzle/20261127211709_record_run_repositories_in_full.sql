ALTER TABLE "dispatch" ADD COLUMN "repositories" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- A task's dispatch now records each repository its run checks out by its full owner/name, as its line spells it. Earlier dispatches knew only the reviewed repository, by owner/name, or their station config's short names: resolve each short name against the station's line, and leave out one the line no longer has.
UPDATE "dispatch"
SET
  "repositories" = "checked_out"."repositories",
  "version" = "dispatch"."version" + 1
FROM (
  SELECT
    "resolved"."id",
    jsonb_agg("resolved"."repository" ORDER BY "resolved"."position") AS "repositories"
  FROM (
    SELECT DISTINCT ON ("ordered"."id", lower(coalesce("named"."repository", "each"."name")))
      "ordered"."id",
      coalesce("named"."repository", "each"."name") AS "repository",
      "each"."position"
    FROM "dispatch" AS "ordered"
    LEFT JOIN "work_station" ON "work_station"."station_id" = "ordered"."station_id"
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN coalesce("ordered"."briefed_task" ->> 'reviewing', '') <> ''
          THEN jsonb_build_array("ordered"."briefed_task" ->> 'reviewing')
        ELSE coalesce(jsonb_path_query_array("ordered"."station_config", '$.repositories[*].name'), '[]'::jsonb)
      END
    ) WITH ORDINALITY AS "each"("name", "position")
    LEFT JOIN LATERAL (
      SELECT "line_repository"."repository"
      FROM "line_repository"
      WHERE "line_repository"."line_id" = "work_station"."line_id"
        AND CASE
          WHEN strpos("each"."name", '/') = 0
            THEN lower(split_part("line_repository"."repository", '/', 2)) = lower("each"."name")
          ELSE lower("line_repository"."repository") = lower("each"."name")
        END
      ORDER BY "line_repository"."repository"
      LIMIT 1
    ) AS "named" ON true
    WHERE "ordered"."kind" = 'task'
      AND ("named"."repository" IS NOT NULL OR strpos("each"."name", '/') > 0)
    ORDER BY "ordered"."id", lower(coalesce("named"."repository", "each"."name")), "each"."position"
  ) AS "resolved"
  GROUP BY "resolved"."id"
) AS "checked_out"
WHERE "dispatch"."id" = "checked_out"."id"
  AND "dispatch"."repositories" IS DISTINCT FROM "checked_out"."repositories";
--> statement-breakpoint
-- Insights recorded a task run's repositories as its config named them. Record them as its dispatch now does. Run `npm run facts:rebuild` afterwards, so each run's fact follows its record.
UPDATE "run_record"
SET
  "repositories" = "dispatch"."repositories",
  "version" = "run_record"."version" + 1
FROM "dispatch"
WHERE "dispatch"."id" = "run_record"."run_id"
  AND "dispatch"."kind" = 'task'
  AND jsonb_typeof("run_record"."repositories") = 'array'
  AND "run_record"."repositories" IS DISTINCT FROM "dispatch"."repositories";
