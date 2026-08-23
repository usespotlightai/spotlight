CREATE TABLE "assembly_line" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"factory_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station" (
	"id" text PRIMARY KEY NOT NULL,
	"assembly_line_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assembly_line" ADD CONSTRAINT "assembly_line_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_line" ADD CONSTRAINT "assembly_line_factory_id_factory_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_assembly_line_id_assembly_line_id_fk" FOREIGN KEY ("assembly_line_id") REFERENCES "public"."assembly_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assembly_line_factory_idx" ON "assembly_line" USING btree ("factory_id");--> statement-breakpoint
CREATE INDEX "assembly_line_workspace_idx" ON "assembly_line" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "station_assembly_line_idx" ON "station" USING btree ("assembly_line_id");