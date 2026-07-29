CREATE TABLE "customers" (
	"id" varchar(50) PRIMARY KEY,
	"business_name" varchar(255) NOT NULL,
	"owner_name" varchar(255),
	"sector" varchar(100),
	"activity" text,
	"mood" varchar(100),
	"target" text,
	"preferredColors" text,
	"contacts" jsonb,
	"package" varchar(50) DEFAULT 'apertura',
	"source" varchar(20) DEFAULT 'manual',
	"intake_id" varchar(50),
	"status" varchar(30) DEFAULT 'new',
	"logo_url" text,
	"place_id" varchar(100),
	"place_data" jsonb,
	"customer_photos" jsonb,
	"detected_logo_url" text,
	"research_status" jsonb,
	"ai_suggested_fields" jsonb,
	"notes" text,
	"assigned_to" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intakes" (
	"id" varchar(50) PRIMARY KEY,
	"status" varchar(20) DEFAULT 'new',
	"business_name" varchar(255) NOT NULL,
	"owner_name" varchar(255),
	"sector" varchar(100),
	"activity" text,
	"mood" varchar(100),
	"target" text,
	"preferredColors" text,
	"contacts" jsonb,
	"package" varchar(50) DEFAULT 'apertura',
	"source_ref" varchar(100),
	"notes" text,
	"assigned_to" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "customer_id" varchar(50);