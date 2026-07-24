ALTER TABLE "quotes" RENAME TO "documents";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_type" varchar(30) NOT NULL DEFAULT 'quote';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "data" jsonb;
