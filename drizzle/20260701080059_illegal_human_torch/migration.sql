CREATE TABLE "unlock_codes" (
	"code" varchar(50) PRIMARY KEY,
	"package" varchar(50) NOT NULL,
	"used_by" varchar(255),
	"used_at" timestamp,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "tier" varchar(20) DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "unlock_code" varchar(50);--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "unlocked_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "document_count" integer DEFAULT 0;