import { pgTable, serial, varchar, text, integer, jsonb, timestamp, bigint, boolean } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).notNull(),
  gender: varchar({ length: 50 }),
  role: varchar({ length: 20 }).default('user'),
  tokensUsed: bigint('tokens_used', { mode: 'number' }).default(0),
  tokenLimit: bigint('token_limit', { mode: 'number' }).default(1000000),
  createdAt: timestamp('created_at').defaultNow(),
});

export const quotesTable = pgTable('quotes', {
  id: varchar({ length: 50 }).primaryKey(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  title: varchar({ length: 255 }),
  client: varchar({ length: 255 }),
  date: varchar({ length: 50 }),
  intro: text(),
  color: varchar({ length: 50 }),
  vat: integer().default(22),
  status: varchar({ length: 50 }).default('BOZZA'),
  owner: varchar({ length: 255 }),
  options: jsonb(),
  clauses: jsonb(),
  isTemplate: boolean('is_template').default(false),
  shareToken: varchar('share_token', { length: 255 }),
  isShared: boolean('is_shared').default(false),
  pdfUrl: text('pdf_url'),
  documentTheme: varchar('document_theme', { length: 50 }).default('corporate'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userSettingsTable = pgTable('user_settings', {
  userEmail: varchar('user_email', { length: 255 }).primaryKey().references(() => usersTable.email),
  displayName: varchar('display_name', { length: 255 }),
  companyName: varchar('company_name', { length: 255 }),
  profession: varchar('profession', { length: 100 }),
  defaultColor: varchar('default_color', { length: 50 }),
  defaultVat: integer('default_vat').default(22),
  logoUrl: text('logo_url'),
  documentTheme: varchar('document_theme', { length: 50 }).default('corporate'),
  onboardingDone: boolean('onboarding_done').default(false),
});

export { db } from '../../db';
