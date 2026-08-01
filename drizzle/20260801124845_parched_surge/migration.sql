ALTER TABLE "customers" ALTER COLUMN "mood" SET DATA TYPE text USING "mood"::text;--> statement-breakpoint
ALTER TABLE "intakes" ALTER COLUMN "mood" SET DATA TYPE text USING "mood"::text;