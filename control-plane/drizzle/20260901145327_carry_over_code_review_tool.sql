-- Opening a pull request is a tool a station has now, rather than a paragraph
-- in what it tells its agent. The stations that were told about it are the
-- ones that had it, so those are the ones that get it.
INSERT INTO "station_tool" ("station_id", "tool")
SELECT "id", 'pull-request'
FROM "station"
WHERE "agent_prompt" LIKE '%spotlight pull-request%'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- And the paragraph goes, so nothing is told twice.
UPDATE "station"
SET "agent_prompt" = REPLACE(
  "agent_prompt",
  $old$If it is sound, say so plainly and say what you checked, then open a pull
request and give its address in your note:

    spotlight pull-request --title "<what it does>" --body "<the detail>"

Spotlight opens it for the branch this task was worked on. You cannot reach
GitHub yourself, and do not need to.$old$,
  $new$If it is sound, say so plainly and say what you checked, then open a pull
request and give its address in your note.$new$
)
WHERE "agent_prompt" LIKE '%spotlight pull-request%';
