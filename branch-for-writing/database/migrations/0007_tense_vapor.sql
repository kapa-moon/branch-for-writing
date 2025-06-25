CREATE TABLE "ai_comparison_results" (
	"id" text PRIMARY KEY NOT NULL,
	"main_doc_id" text NOT NULL,
	"ref_doc_id" text NOT NULL,
	"comparison_results" jsonb NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_comparison_results" ADD CONSTRAINT "ai_comparison_results_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;