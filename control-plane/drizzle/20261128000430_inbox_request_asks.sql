ALTER TABLE "inbox_request" ADD COLUMN "asks" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Open judge questions ask each disputed claim still unanswered, as
-- JudgeDisagreement.openQuestions counts them: where people passed the run
-- (accepted or merged), the claims the judge failed; one where none is
-- disputed. Everything else keeps the default of one.
UPDATE "inbox_request" AS "request"
SET "asks" = GREATEST(
  1,
  (
    SELECT count(*)::integer
    FROM jsonb_array_elements("disagreement"."claim_results")
      WITH ORDINALITY AS "result"("met", "at")
    WHERE "disagreement"."label_from" IN ('accepted', 'merged')
      AND "result"."met" = 'false'::jsonb
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements("disagreement"."claim_answers") AS "answer"
        WHERE ("answer" ->> 'claim')::integer = "result"."at" - 1
      )
  )
)
FROM "judge_disagreement" AS "disagreement"
WHERE "request"."form" = 'judge-disagreement'
  AND "request"."resolved_at" IS NULL
  AND "disagreement"."id" = "request"."about"
  AND "disagreement"."answered_at" IS NULL
  AND "disagreement"."withdrawn_at" IS NULL;
