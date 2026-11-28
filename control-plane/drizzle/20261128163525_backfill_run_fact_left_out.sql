-- Runs that ended outside their station's work before left_out existed: set it from how they ended, as RunEndings does for new runs.
UPDATE "run_fact" SET "left_out" = CASE
	WHEN "ended_as" = 'cancelled' THEN 'cancelled'
	WHEN "failure" = 'refused' THEN 'refused'
	WHEN "failure" = 'unprepared' THEN 'setup'
	WHEN "failure" = 'unprovisioned' THEN 'infrastructure'
	WHEN "failure" = 'start-gate-unanswered' THEN 'infrastructure'
	WHEN "failure" = 'runner-lost' THEN 'infrastructure'
	WHEN "failure" = 'cancelled' THEN 'cancelled'
END::"run_left_out"
WHERE "left_out" IS NULL;
