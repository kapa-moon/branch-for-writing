CREATE TABLE "main_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "main_documents" ADD CONSTRAINT "main_documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;