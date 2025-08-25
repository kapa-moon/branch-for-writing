CREATE TABLE "ai_platform_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" text NOT NULL,
	"sender" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"metadata" jsonb,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_platform_messages" ADD CONSTRAINT "ai_platform_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;