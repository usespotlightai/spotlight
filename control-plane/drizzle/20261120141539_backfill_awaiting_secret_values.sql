UPDATE "secret" SET "value_version" = NULL WHERE "value_version" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "secret_value" WHERE "secret_value"."secret_id" = "secret"."id");
