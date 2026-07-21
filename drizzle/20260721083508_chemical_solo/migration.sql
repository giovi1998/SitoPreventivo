CREATE TABLE "client_kb" (
	"id" serial PRIMARY KEY,
	"user_email" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(100),
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tokens_cost_usd" numeric(10,6) DEFAULT '0';