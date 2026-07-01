import { pgTable, serial, varchar, text, integer, jsonb, timestamp, bigint, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).notNull(),
  gender: varchar({ length: 50 }),
  role: varchar({ length: 20 }).default("user"),
  tokensUsed: bigint("tokens_used", { mode: "number" }).default(0),
  tokenLimit: bigint("token_limit", { mode: "number" }).default(1000000),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar({ length: 50 }).primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  documentType: varchar("document_type", { length: 30 }).notNull().default("quote"),
  title: varchar({ length: 255 }),
  client: varchar({ length: 255 }),
  date: varchar({ length: 50 }),
  intro: text(),
  color: varchar({ length: 50 }),
  vat: integer().default(22),
  status: varchar({ length: 50 }).default("BOZZA"),
  owner: varchar({ length: 255 }),
  options: jsonb(),
  clauses: jsonb(),
  isTemplate: boolean("is_template").default(false),
  shareToken: varchar("share_token", { length: 255 }),
  isShared: boolean("is_shared").default(false),
  pdfUrl: text("pdf_url"),
  documentTheme: varchar("document_theme", { length: 50 }).default("corporate"),
  data: jsonb(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  userEmail: varchar("user_email", { length: 255 }).primaryKey().references(() => users.email),
  displayName: varchar("display_name", { length: 255 }),
  companyName: varchar("company_name", { length: 255 }),
  profession: varchar("profession", { length: 100 }),
  defaultColor: varchar("default_color", { length: 50 }),
  defaultVat: integer("default_vat").default(22),
  logoUrl: text("logo_url"),
  documentTheme: varchar("document_theme", { length: 50 }).default("corporate"),
  onboardingDone: boolean("onboarding_done").default(false),
  // Phase 5, tier system (freemium + unlock code)
  tier: varchar({ length: 20 }).default("free"),
  unlockCode: varchar("unlock_code", { length: 50 }),
  unlockedAt: timestamp("unlocked_at"),
  documentCount: integer("document_count").default(0),
  // Phase 7, onboarding step 5 preference (SPEC REQ-002). Stores the
  // view the user picked as starting point. Optional, null if the
  // user skipped the step. Soft fail: missing value is treated the
  // same as "no preference" and the user lands on the default
  // (editor) view per spec AC-003.
  preferredDocumentType: varchar("preferred_document_type", { length: 30 }),
});

export const unlockCodes = pgTable("unlock_codes", {
  code: varchar({ length: 50 }).primaryKey(),
  package: varchar({ length: 50 }).notNull(),
  usedBy: varchar("used_by", { length: 255 }),
  usedAt: timestamp("used_at"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
