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
ALTER TABLE "quotes" ADD COLUMN "is_template" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "share_token" varchar(255);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "is_shared" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_email_users_email_fkey" FOREIGN KEY ("user_email") REFERENCES "users"("email");