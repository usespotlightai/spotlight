CREATE TABLE "task_note" (
	"task_id" text NOT NULL,
	"position" integer NOT NULL,
	"station" text NOT NULL,
	"body" text NOT NULL,
	"at" timestamp NOT NULL,
	CONSTRAINT "task_note_task_id_position_pk" PRIMARY KEY("task_id","position")
);
--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_note_task_idx" ON "task_note" USING btree ("task_id","position");--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "run_id";