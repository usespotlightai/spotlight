UPDATE "run" SET "turn_report" = jsonb_set("turn_report", '{heads}', '[]'::jsonb) WHERE "turn_report" IS NOT NULL AND NOT ("turn_report" ? 'heads');
