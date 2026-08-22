import { pgTable, serial, varchar, text, integer, jsonb, timestamp, bigint, boolean, numeric } from 'drizzle-orm/pg-core';
// drizzle-orm/neon-http is ESM-only — static import crashes Vercel Lambda.
// Loaded dynamically inside getDb() on first use.
// TB-023 REQ-TC-006: costo flat mensile Ollama Pro.
export const OLLAMA_PRO_FLAT_MONTHLY = 20;

export let _db: any = null;
export async function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Database non configurato sul server');
    const { drizzle } = await import('drizzle-orm/neon-http');
    _db = drizzle(connectionString, { schema: {} as never });
  }
  return _db;
}

export const usersTable = pgTable('users', {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).notNull(),
  gender: varchar({ length: 50 }),
  role: varchar({ length: 20 }).default('user'),
  tokensUsed: bigint('tokens_used', { mode: 'number' }).default(0),
  tokenLimit: bigint('token_limit', { mode: 'number' }).default(1000000),
  // TB-023: tracking costi reale per provider (numeric 10,6 USD)
  tokensCostUsd: numeric('tokens_cost_usd', { precision: 10, scale: 6 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const documentsTable = pgTable('documents', {
  id: varchar({ length: 50 }).primaryKey(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  // TB-027 CRM: cliente collegato (nullable per retrocompat)
  customerId: varchar('customer_id', { length: 50 }),
  documentType: varchar('document_type', { length: 30 }).notNull().default('quote'),
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
  data: jsonb(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// TB-027 CRM: cliente business. vedi db/schema.ts
export const customersTable = pgTable('customers', {
  id: varchar({ length: 50 }).primaryKey(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  ownerName: varchar('owner_name', { length: 255 }),
  sector: varchar({ length: 100 }),
  activity: text(),
  mood: text(),
  target: text(),
  preferredColors: text(),
  contacts: jsonb(),
  // TB-030 sync CRM↔website: social del cliente {platform, url}[] — shape
  // identica a website.brief.socials per il sync bidirezionale.
  socials: jsonb(),
  // TB-030 sync CRM↔website: font preferito del cliente (auto-build prefill).
  font: varchar({ length: 50 }),
  // Brief website → CRM parity (pagine/sezioni/CTA/feature per confronto onesto)
  pages: text(),
  sections: text(),
  cta: text(),
  features: text(),
  package: varchar({ length: 50 }).default('apertura'),
  source: varchar({ length: 20 }).default('manual'),
  intakeId: varchar('intake_id', { length: 50 }),
  status: varchar({ length: 30 }).default('new'),
  logoUrl: text('logo_url'),
  placeId: varchar('place_id', { length: 100 }),
  placeData: jsonb('place_data'),
  customerPhotos: jsonb('customer_photos'),
  detectedLogoUrl: text('detected_logo_url'),
  researchStatus: jsonb('research_status'),
  webData: jsonb('web_data'),
  aiSuggestedFields: jsonb('ai_suggested_fields'),
  // TB-029 fase 3: A/B testing prompt per cliente {promptName: label}
  promptLabels: jsonb('prompt_labels'),
  // TB-032: versione prompt per cliente {promptName: version} — override
  // su label in /api/ai/prompt (test prompt×modello).
  promptVersions: jsonb('prompt_versions'),
  webAnswers: jsonb('web_answers'),
  notes: text(),
  assignedTo: varchar('assigned_to', { length: 255 }),
  googleMapsUrl: text('google_maps_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// TB-019 intake: brief da form pubblico. vedi db/schema.ts
export const intakesTable = pgTable('intakes', {
  id: varchar({ length: 50 }).primaryKey(),
  status: varchar({ length: 20 }).default('new'),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  ownerName: varchar('owner_name', { length: 255 }),
  sector: varchar({ length: 100 }),
  activity: text(),
  mood: text(),
  target: text(),
  preferredColors: text(),
  contacts: jsonb(),
  package: varchar({ length: 50 }).default('apertura'),
  sourceRef: varchar('source_ref', { length: 100 }),
  webAnswers: jsonb('web_answers'),
  notes: text(),
  assignedTo: varchar('assigned_to', { length: 255 }),
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
  // Phase 5, tier system
  tier: varchar({ length: 20 }).default('free'),
  unlockCode: varchar('unlock_code', { length: 50 }),
  unlockedAt: timestamp('unlocked_at'),
  documentCount: integer('document_count').default(0),
  // Phase 7, onboarding step 5 preference. Optional, null if the
  // user skipped the step. See spec REQ-002.
  preferredDocumentType: varchar('preferred_document_type', { length: 30 }),
});

// TB-027 RAG: chunk di conoscenza cliente con embedding Gemini.
export const customerKnowledgeTable = pgTable('customer_knowledge', {
  id: serial().primaryKey(),
  customerId: varchar('customer_id', { length: 50 }).notNull(),
  chunk: text().notNull(),
  embedding: jsonb(),
  source: varchar({ length: 100 }).notNull().default('firecrawl:homepage'),
  metadata: jsonb().default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

export const unlockCodesTable = pgTable('unlock_codes', {
  code: varchar({ length: 50 }).primaryKey(),
  package: varchar({ length: 50 }).notNull(),
  usedBy: varchar('used_by', { length: 255 }),
  usedAt: timestamp('used_at'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
export const VALID_PACKAGES = new Set(['starter', 'apertura', 'presenza', 'custom']);
export const FREE_DOCUMENT_LIMIT = 10;
