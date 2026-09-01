CREATE TABLE "assembly_line_reaction" (
	"assembly_line_id" text NOT NULL,
	"happening" text NOT NULL,
	"from_station_id" text,
	"to_station_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assembly_line_reaction" ADD CONSTRAINT "assembly_line_reaction_assembly_line_id_assembly_line_id_fk" FOREIGN KEY ("assembly_line_id") REFERENCES "public"."assembly_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line_reaction" ADD CONSTRAINT "assembly_line_reaction_from_station_id_station_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line_reaction" ADD CONSTRAINT "assembly_line_reaction_to_station_id_station_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assembly_line_reaction_line_idx" ON "assembly_line_reaction" USING btree ("assembly_line_id");