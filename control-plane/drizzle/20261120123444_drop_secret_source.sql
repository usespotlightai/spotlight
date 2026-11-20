ALTER TABLE "secret" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "secret" DROP COLUMN "source_secret_id";--> statement-breakpoint
ALTER TABLE "secret" DROP COLUMN "source_field";--> statement-breakpoint
DROP TYPE "public"."secret_source";