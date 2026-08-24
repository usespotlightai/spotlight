ALTER TABLE "run" ADD COLUMN "target_runner_id" text;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_target_runner_id_runner_id_fk" FOREIGN KEY ("target_runner_id") REFERENCES "public"."runner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_target_idx" ON "run" USING btree ("target_runner_id");