CREATE TABLE "run_digest" (
	"run_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"ms" integer,
	"steps" integer DEFAULT 0 NOT NULL,
	"faults" integer DEFAULT 0 NOT NULL,
	"used" integer,
	"size" integer,
	"cost" double precision,
	"currency" text,
	"readable" boolean DEFAULT true NOT NULL,
	"digested_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "run_digest_run_id_attempt_pk" PRIMARY KEY("run_id","attempt")
);
--> statement-breakpoint
ALTER TABLE "run_digest" ADD CONSTRAINT "run_digest_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;