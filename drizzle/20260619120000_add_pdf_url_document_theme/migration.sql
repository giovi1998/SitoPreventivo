ALTER TABLE "quotes" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "document_theme" varchar(50) DEFAULT 'corporate';--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "profession" varchar(100);
