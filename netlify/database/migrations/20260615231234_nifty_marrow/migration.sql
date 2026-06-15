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
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(255) NOT NULL UNIQUE,
	"password" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"gender" varchar(50),
	"created_at" timestamp DEFAULT now()
);
