CREATE TABLE "repository_visibility" (
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"visibility" text NOT NULL,
	"checked_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "repository_visibility_owner_name_pk" PRIMARY KEY("owner","name")
);
