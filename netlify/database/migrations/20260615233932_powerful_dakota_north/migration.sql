ALTER TABLE "users" ADD COLUMN "role" varchar(20) DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tokens_used" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_limit" bigint DEFAULT 1000000;