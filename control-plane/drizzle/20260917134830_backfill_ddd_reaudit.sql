UPDATE "task_mark" SET "workspace_id" = "task"."workspace_id" FROM "task" WHERE "task"."id" = "task_mark"."task_id" AND "task_mark"."workspace_id" IS NULL;--> statement-breakpoint
UPDATE "team_config" SET "begun_at" = "read_at" WHERE "begun_at" IS NULL;--> statement-breakpoint
UPDATE "review_comment" SET "sent_body" = "body" WHERE "state" = 'submitted' AND "sent_body" IS NULL;--> statement-breakpoint
INSERT INTO "attachment_claim" ("id", "workspace_id", "task_id", "claimed_at")
  SELECT "task_attachment"."id", "task"."workspace_id", "task_attachment"."task_id", "task_attachment"."created_at"
  FROM "task_attachment" JOIN "task" ON "task"."id" = "task_attachment"."task_id"
  ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "attachment_claim" ("id", "workspace_id", "chat_id", "claimed_at")
  SELECT "chat_attachment"."id", "chat"."workspace_id", "chat_attachment"."chat_id", "chat_attachment"."created_at"
  FROM "chat_attachment" JOIN "chat" ON "chat"."id" = "chat_attachment"."chat_id"
  ON CONFLICT ("id") DO NOTHING;
