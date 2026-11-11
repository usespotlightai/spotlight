UPDATE "run_fact" SET "resolution" = (CASE
  WHEN "first_human_action" = 'sent-back' THEN 'sent-back'
  WHEN "first_human_action" = 'accepted' THEN 'accepted'
  WHEN "ending" = 'failed' THEN 'failed'
  WHEN "ending" <> 'completed' THEN 'other'
  WHEN "passed_to" IS NOT NULL OR "first_human_action" = 'started' THEN 'moved-on'
  WHEN "pull_request_state" = 'merged' THEN 'accepted'
  ELSE 'other'
END)::"run_resolution";
