CREATE TABLE "ai_chat_records" (
	"id" text PRIMARY KEY NOT NULL,
	"main_doc_id" text,
	"ref_doc_id" text,
	"context_content" text,
	"user_prompt" text NOT NULL,
	"ai_output" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_records" ADD CONSTRAINT "ai_chat_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;