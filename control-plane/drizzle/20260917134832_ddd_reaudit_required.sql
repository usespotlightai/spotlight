ALTER TABLE "task_mark" DROP CONSTRAINT "task_mark_kind_value_pk";--> statement-breakpoint
ALTER TABLE "team_config" ALTER COLUMN "begun_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "task_mark" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "task_mark" ADD CONSTRAINT "task_mark_workspace_id_kind_value_pk" PRIMARY KEY("workspace_id","kind","value");