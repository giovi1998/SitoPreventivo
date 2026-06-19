CREATE TABLE "quotes" (
	"id" varchar(50) PRIMARY KEY,
	"user_email" varchar(255) NOT NULL,
	"title" varchar(255),
	"client" varchar(255),
	"date" varchar(50),
	"intro" text,
	"color" varchar(50),
	"vat" integer DEFAULT 22,
	"status" varchar(50) DEFAULT 'BOZZA',
	"owner" varchar(255),
	"options" jsonb,
	"clauses" jsonb,
	"is_template" boolean DEFAULT false,
	"share_token" varchar(255),
	"is_shared" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_email" varchar(255) PRIMARY KEY,
	"display_name" varchar(255),
	"company_name" varchar(255),
	"default_color" varchar(50),
	"default_vat" integer DEFAULT 22,
	"logo_url" text,
	"onboarding_done" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(255) NOT NULL UNIQUE,
	"password" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"gender" varchar(50),
	"role" varchar(20) DEFAULT 'user',
	"tokens_used" bigint DEFAULT 0,
	"token_limit" bigint DEFAULT 1000000,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_email_users_email_fkey" FOREIGN KEY ("user_email") REFERENCES "users"("email");