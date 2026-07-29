CREATE TABLE "customer_knowledge" (
	"id" serial PRIMARY KEY,
	"customer_id" varchar(50) NOT NULL,
	"chunk" text NOT NULL,
	"embedding" jsonb,
	"source" varchar(100) DEFAULT 'firecrawl:homepage' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "google_maps_url" text;--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "places_api_key";--> statement-breakpoint
ALTER TABLE "customer_knowledge" ADD CONSTRAINT "customer_knowledge_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");