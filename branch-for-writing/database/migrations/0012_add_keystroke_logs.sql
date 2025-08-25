CREATE TABLE "keystroke_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"before_text" text NOT NULL,
	"after_text" text NOT NULL,
	"diff_data" jsonb NOT NULL,
	"action_type" text NOT NULL,
	"cursor_position" integer,
	"text_length_before" integer NOT NULL,
	"text_length_after" integer NOT NULL,
	"keystroke_count" integer DEFAULT 1,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keystroke_logs" ADD CONSTRAINT "keystroke_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;