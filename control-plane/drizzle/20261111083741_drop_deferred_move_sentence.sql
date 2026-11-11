UPDATE "task_note"
SET "body" = regexp_replace(
  "body",
  '^This arrived while a run was in progress on the task\. If the run does not pass the task on, the task moves to [^\n]+ when the run ends\.\n\n',
  ''
)
WHERE "deferred_move" IS NOT NULL
  AND "body" LIKE 'This arrived while a run was in progress on the task.%';
