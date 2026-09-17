ALTER TABLE "line" DROP CONSTRAINT "line_factory_id_factory_id_fk";
--> statement-breakpoint
DROP INDEX "line_factory_idx";--> statement-breakpoint
ALTER TABLE "line" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "line_team_idx" ON "line" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "line" DROP COLUMN "factory_id";