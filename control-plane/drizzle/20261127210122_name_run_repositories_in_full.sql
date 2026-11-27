-- A task run recorded each repository by its name alone, a run that reviewed a pull request by owner/name, so Insights counted one repository twice. Name each as its line does, owner/name in full. A name the line no longer has stays as it was.
UPDATE "run_record"
SET
  "repositories" = "renamed"."repositories",
  "version" = "run_record"."version" + 1
FROM (
  SELECT
    "run"."run_id",
    jsonb_agg(coalesce("named"."repository", "each"."name") ORDER BY "each"."position") AS "repositories"
  FROM "run_record" AS "run"
  CROSS JOIN LATERAL jsonb_array_elements_text("run"."repositories") WITH ORDINALITY AS "each"("name", "position")
  LEFT JOIN LATERAL (
    SELECT "line_repository"."repository"
    FROM "line_repository"
    WHERE "line_repository"."line_id" = "run"."line_id"
      AND CASE
        WHEN strpos("each"."name", '/') = 0
          THEN lower(split_part("line_repository"."repository", '/', 2)) = lower("each"."name")
        ELSE lower("line_repository"."repository") = lower("each"."name")
      END
    ORDER BY "line_repository"."repository"
    LIMIT 1
  ) AS "named" ON true
  WHERE jsonb_typeof("run"."repositories") = 'array'
  GROUP BY "run"."run_id"
) AS "renamed"
WHERE "run_record"."run_id" = "renamed"."run_id"
  AND "run_record"."repositories" IS DISTINCT FROM "renamed"."repositories";
--> statement-breakpoint
-- A run's fact names its repositories as its record does.
UPDATE "run_fact"
SET "repositories" = "run_record"."repositories"
FROM "run_record"
WHERE "run_fact"."run_id" = "run_record"."run_id"
  AND jsonb_typeof("run_record"."repositories") = 'array'
  AND "run_fact"."repositories" IS DISTINCT FROM "run_record"."repositories";
