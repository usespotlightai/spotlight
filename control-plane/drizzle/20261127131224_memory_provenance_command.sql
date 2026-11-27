ALTER TABLE "memory" ADD COLUMN "command" integer;--> statement-breakpoint
ALTER TABLE "memory_proposal" ADD COLUMN "command" integer;--> statement-breakpoint
ALTER TABLE "memory" ADD CONSTRAINT "memory_command_not_negative" CHECK ("memory"."command" >= 0);--> statement-breakpoint
ALTER TABLE "memory_proposal" ADD CONSTRAINT "memory_proposal_command_not_negative" CHECK ("memory_proposal"."command" >= 0);