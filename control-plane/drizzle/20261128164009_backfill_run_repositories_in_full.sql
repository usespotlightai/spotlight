-- A task's dispatch now records each repository its run checks out by its full owner/name, as its line spells it. Earlier dispatches knew only the reviewed repository, by owner/name, or their station config's short names: resolve each short name against the station's line, and leave out one the line no longer has. A station since removed is found by the line its run's record names.
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
    LEFT JOIN "run_record" ON "run_record"."run_id" = "ordered"."id"
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
      WHERE "line_repository"."line_id" = coalesce("work_station"."line_id", "run_record"."line_id")
        AND CASE
          WHEN strpos("each"."name", '/') = 0
            THEN lower(split_part("line_repository"."repository", '/', 2)) = lower("each"."name")
          ELSE lower("line_repository"."repository") = lower("each"."name")
        END
      ORDER BY
        CASE
          WHEN strpos("each"."name", '/') = 0
            THEN split_part("line_repository"."repository", '/', 2) = "each"."name"
          ELSE "line_repository"."repository" = "each"."name"
        END DESC,
        "line_repository"."repository"
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
-- Insights recorded a task run's repositories as its config named them. Name each as its dispatch now does, and keep a name the dispatch could not resolve, so its spend stays attributed. A record left empty, by a run ordered on a pod without the dispatch's repositories, takes the dispatch's.
UPDATE "run_record"
SET
  "repositories" = "named"."repositories",
  "version" = "run_record"."version" + 1
FROM (
  SELECT
    "kept"."run_id",
    jsonb_agg("kept"."repository" ORDER BY "kept"."position") AS "repositories"
  FROM (
    SELECT DISTINCT ON ("recorded"."run_id", lower(coalesce("checked_out"."repository", "each"."name")))
      "recorded"."run_id",
      coalesce("checked_out"."repository", "each"."name") AS "repository",
      "each"."position"
    FROM "run_record" AS "recorded"
    JOIN "dispatch" ON "dispatch"."id" = "recorded"."run_id" AND "dispatch"."kind" = 'task'
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof("recorded"."repositories") <> 'array' THEN '[]'::jsonb
        WHEN jsonb_array_length("recorded"."repositories") = 0 THEN "dispatch"."repositories"
        ELSE "recorded"."repositories"
      END
    ) WITH ORDINALITY AS "each"("name", "position")
    LEFT JOIN LATERAL (
      SELECT "listed"."repository"
      FROM jsonb_array_elements_text("dispatch"."repositories") AS "listed"("repository")
      WHERE CASE
        WHEN strpos("each"."name", '/') = 0
          THEN lower(split_part("listed"."repository", '/', 2)) = lower("each"."name")
        ELSE lower("listed"."repository") = lower("each"."name")
      END
      ORDER BY "listed"."repository"
      LIMIT 1
    ) AS "checked_out" ON true
    WHERE jsonb_typeof("recorded"."repositories") = 'array'
    ORDER BY "recorded"."run_id", lower(coalesce("checked_out"."repository", "each"."name")), "each"."position"
  ) AS "kept"
  GROUP BY "kept"."run_id"
) AS "named"
WHERE "run_record"."run_id" = "named"."run_id"
  AND "run_record"."repositories" IS DISTINCT FROM "named"."repositories";
--> statement-breakpoint
-- A run's fact copies its record's repositories, so it follows them here as a facts rebuild would.
UPDATE "run_fact"
SET "repositories" = "run_record"."repositories"
FROM "run_record"
WHERE "run_fact"."run_id" = "run_record"."run_id"
  AND jsonb_typeof("run_record"."repositories") = 'array'
  AND "run_fact"."repositories" IS DISTINCT FROM "run_record"."repositories";
