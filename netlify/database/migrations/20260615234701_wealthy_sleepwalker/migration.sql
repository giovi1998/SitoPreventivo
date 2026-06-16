CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY,
	"value" text,
	"updated_at" timestamp DEFAULT now()
);
