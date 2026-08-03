import { eq, and, sql, inArray } from 'drizzle-orm';
import { pgTable, serial, varchar, text, integer, jsonb, timestamp, bigint, boolean, numeric } from 'drizzle-orm/pg-core';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
// drizzle-orm/neon-http is ESM-only — static import crashes Vercel Lambda.
// Loaded dynamically inside getDb() on first use.
// TB-023 REQ-TC-006: costo flat mensile Ollama Pro.
// Inlined to avoid cross-boundary api/→src/ import (Vercel Lambda ERR_MODULE_NOT_FOUND).
const OLLAMA_PRO_FLAT_MONTHLY = 20;

type VercelRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};
type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string | number): void;
  write(chunk: string | Uint8Array): boolean;
  end(): void;
  writableEnded: boolean;
};

let _db: any = null;
async function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Database non configurato sul server');
    const { drizzle } = await import('drizzle-orm/neon-http');
    _db = drizzle(connectionString, { schema: {} as never });
  }
  return _db;
}

const usersTable = pgTable('users', {
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

const documentsTable = pgTable('documents', {
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
const customersTable = pgTable('customers', {
  id: varchar({ length: 50 }).primaryKey(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  ownerName: varchar('owner_name', { length: 255 }),
  sector: varchar({ length: 100 }),
  activity: text(),
  mood: text(),
  target: text(),
  preferredColors: text(),
  contacts: jsonb(),
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
  webAnswers: jsonb('web_answers'),
  notes: text(),
  assignedTo: varchar('assigned_to', { length: 255 }),
  googleMapsUrl: text('google_maps_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// TB-019 intake: brief da form pubblico. vedi db/schema.ts
const intakesTable = pgTable('intakes', {
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

const userSettingsTable = pgTable('user_settings', {
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
const customerKnowledgeTable = pgTable('customer_knowledge', {
  id: serial().primaryKey(),
  customerId: varchar('customer_id', { length: 50 }).notNull(),
  chunk: text().notNull(),
  embedding: jsonb(),
  source: varchar({ length: 100 }).notNull().default('firecrawl:homepage'),
  metadata: jsonb().default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

const unlockCodesTable = pgTable('unlock_codes', {
  code: varchar({ length: 50 }).primaryKey(),
  package: varchar({ length: 50 }).notNull(),
  usedBy: varchar('used_by', { length: 255 }),
  usedAt: timestamp('used_at'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const VALID_PACKAGES = new Set(['starter', 'apertura', 'presenza', 'custom']);
const FREE_DOCUMENT_LIMIT = 10;

type RouteHandler = (
  path: string,
  method: string,
  req: VercelRequest,
  res: VercelResponse,
  body: Record<string, unknown>
) => Promise<void>;

const ADMIN_EMAIL = 'admin@gmail.com';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const IS_PROD = process.env.VERCEL_ENV === 'production';

function getAllowedOrigin(req: VercelRequest): string {
  if (!IS_PROD) return '*';
  if (ALLOWED_ORIGIN) return ALLOWED_ORIGIN;
  const origin = (req.headers['origin'] || req.headers['referer'] || '') as string;
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.vercel.app')) return url.origin;
  } catch {}
  return 'https://precisionquote.vercel.app';
}

function addCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(req: VercelRequest, res: VercelResponse, status: number, data: unknown): void {
  addCorsHeaders(req, res);
  res.status(status).json(data);
}

// Modello immagine Gemini corrente. `gemini-2.0-flash-preview-image-generation`
// è stato ritirato da Google (404 upstream → 502, bug prod 2026-07-30):
// normalizza i pref client stale verso il modello corrente.
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
const RETIRED_GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';
function normalizeGeminiImageModel(id?: string): string {
  return !id || id === RETIRED_GEMINI_IMAGE_MODEL ? GEMINI_IMAGE_MODEL : id;
}

function getRequestId(req: VercelRequest): string {
  const header = req.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  if (value) return value;
  return crypto.randomUUID();
}

interface AILogPayload {
  tag: string;
  requestId: string;
  email?: string;
  model?: string;
  durationMs: number;
  tokens?: number;
  outcome: 'ok' | 'error';
  errorKind?: string;
  sizeKB?: number;
  provider?: string;
  costUsd?: number;
}

function logAI(payload: AILogPayload): void {
  console.info(JSON.stringify({ ...payload, ts: Date.now() }));
}

function jsonWithRequestId(
  req: VercelRequest,
  res: VercelResponse,
  status: number,
  data: Record<string, unknown>,
  requestId: string
): void {
  json(req, res, status, { ...data, requestId });
}

function errorResponse(req: VercelRequest, res: VercelResponse, status: number, err: unknown): void {
  const errMsg = (err as Error)?.message || String(err);
  const errStack = (err as Error)?.stack;
  console.error(`[API] error`, { status, msg: errMsg, stack: errStack });
  const msg = process.env.VERCEL_ENV === 'development' ? errMsg : 'Errore interno del server';
  json(req, res, status, { error: msg });
}

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(bBuf, bBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const xff = req.headers['x-forwarded-for'];
  const ip = (typeof xff === 'string' ? xff : xff?.[0]) || '';
  return ip.split(',')[0]?.trim() || 'unknown';
}

/**
 * Builds the `input` payload for the @google/genai image-generation
 * endpoints. Accepts a text prompt plus optional inline image parts.
 * The part shape (`inlineData`) is the SDK convention for the
 * `interactions.create` API. If the SDK rejects it, the caller falls
 * back to the `contents: [{ role, parts }]` shape manually.
 */
type GeminiInputStep = {
  type: 'user_input';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mime_type: string }
  >;
};

type GeminiInputPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mime_type: string };

function buildGeminiMultimodalInput(
  text: string,
  images: Array<{ data: string; mimeType: string } | null>,
): string | GeminiInputPart[] {
  const hasImages = images.some((img) => !!img);
  if (!hasImages) return text;
  const parts: GeminiInputPart[] = [{ type: 'text', text }];
  for (const img of images) {
    if (!img) continue;
    const b64 = img.data.includes(',') ? img.data.split(',')[1] : img.data;
    parts.push({ type: 'image', data: b64, mime_type: img.mimeType });
  }
  return parts;
}

const rateLimitStore = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(
  ip: string,
  scope: string = 'login',
  max: number = 5,
  windowMs: number = 15 * 60 * 1000
): { blocked: boolean } {
  const key = `${scope}:${ip}`;
  const record = rateLimitStore.get(key);
  const now = Date.now();
  if (record) {
    if (now - record.firstAttempt < windowMs) {
      if (record.count >= max) return { blocked: true };
      return { blocked: false };
    }
    rateLimitStore.delete(key);
  }
  return { blocked: false };
}

function recordRateAttempt(ip: string, success: boolean, scope: string = 'login'): void {
  const key = `${scope}:${ip}`;
  if (success) {
    rateLimitStore.delete(key);
  } else {
    const record = rateLimitStore.get(key);
    const now = Date.now();
    if (record && now - record.firstAttempt < 15 * 60 * 1000) {
      record.count++;
      rateLimitStore.set(key, record);
    } else {
      rateLimitStore.set(key, { count: 1, firstAttempt: now });
    }
  }
}

/**
 * Unconditional rate limiter: every successful call counts toward
 * the cap. Used for high-volume AI endpoints (aistream, flyerCopy)
 * where the login-style "max N failed attempts" semantics don't
 * make sense. Returns `blocked: true` if the cap has been hit in
 * the current window.
 */
function consumeRateLimit(
  ip: string,
  scope: string,
  max: number,
  windowMs: number
): { blocked: boolean; retryAfterMs?: number } {
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (record && now - record.firstAttempt < windowMs) {
    if (record.count >= max) {
      return { blocked: true, retryAfterMs: windowMs - (now - record.firstAttempt) };
    }
    record.count += 1;
    rateLimitStore.set(key, record);
    return { blocked: false };
  }
  rateLimitStore.set(key, { count: 1, firstAttempt: now });
  return { blocked: false };
}

function validate<T>(schema: z.ZodType<T>, data: unknown): { error: true; errors: string[] } | { error: false; data: T } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error?.issues;
    const messages = issues ? issues.map((e: z.ZodIssue) => e.message) : ['Errore di validazione dati'];
    return { error: true, errors: messages };
  }
  return { error: false, data: result.data };
}

function randomHex(n: number): string {
  const chars = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function generateUnlockCode(): string {
  return `PQ-${randomHex(8)}-${randomHex(8)}-${randomHex(8)}`;
}

const passwordSchema = z.string()
  .min(12, 'Password: minimo 12 caratteri')
  .max(100)
  .regex(/[A-Z]/, 'Password: deve contenere una maiuscola')
  .regex(/[a-z]/, 'Password: deve contenere una minuscola')
  .regex(/[0-9]/, 'Password: deve contenere un numero')
  .regex(/[^A-Za-z0-9]/, 'Password: deve contenere un carattere speciale');

const RegisterSchema = z.object({
  email: z.string().email('Email non valida'),
  password: passwordSchema,
  username: z.string().min(2, 'Username: minimo 2 caratteri').max(50),
  gender: z.string().optional(),
  role: z.string().optional(),
  tokenLimit: z.number().optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

const ChangePasswordSchema = z.object({
  email: z.string().email('Email non valida'),
  oldPassword: z.string().min(1, 'Vecchia password richiesta'),
  newPassword: passwordSchema,
});

const TokenLimitSchema = z.object({
  email: z.string().email('Email non valida'),
  tokenLimit: z.number().positive('tokenLimit deve essere positivo'),
});

const TrackTokensSchema = z.object({
  email: z.string().email('Email non valida'),
  tokens: z.number().positive('tokens deve essere positivo'),
  // TB-023: costo USD opzionale (backward compatible)
  costUsd: z.number().min(0).optional(),
});

const RedeemCodeSchema = z.object({
  email: z.string().email('Email non valida'),
  code: z.string().min(1, 'Codice richiesto').max(50),
});

const DocumentCountSchema = z.object({
  email: z.string().email('Email non valida'),
  delta: z.number().int().min(-100).max(100).optional().default(1),
});

const GenerateCodeSchema = z.object({
  adminEmail: z.string().email('Email non valida'),
  package: z.enum(['starter', 'apertura', 'presenza', 'custom']),
});

const UnlockUserSchema = z.object({
  adminEmail: z.string().email('Email non valida'),
  userEmail: z.string().email('Email utente non valida'),
});

const QuoteBodySchema = z.object({
  email: z.string().email('Email non valida'),
  quote: z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    client: z.string().optional(),
    date: z.string().optional(),
    intro: z.string().optional(),
    color: z.string().optional(),
    vat: z.number().optional(),
    status: z.string().optional(),
    owner: z.string().optional(),
    options: z.array(z.any()).optional(),
    clauses: z.array(z.any()).optional(),
    isTemplate: z.boolean().optional(),
    pdfUrl: z.string().optional(),
    documentTheme: z.string().optional(),
  }),
});

const qrPayloadDataSchema = z.object({
  type: z.enum(['url', 'text', 'email', 'phone', 'vcard', 'wifi', 'sms']),
  payload: z.string(),
});

const qrStyleDataSchema = z.object({
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).optional(),
  fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  size: z.number().min(128).max(2048).optional(),
  margin: z.number().min(0).max(16).optional(),
  logoOverlay: z.string().nullable().optional(),
  dotStyle: z.enum(['square', 'rounded', 'dots']).optional(),
});

const qrDocumentSchema = z.object({
  id: z.string().min(1),
  documentType: z.literal('qrCode'),
  title: z.string().default(''),
  data: qrPayloadDataSchema,
  style: qrStyleDataSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Business card / logo / flyer payloads are stored opaquely as
// jsonb. We validate the discriminated key + id + title at the
// boundary and trust the schema on the client (documentSchemas.ts)
// for the deep shape. This keeps the API surface small and avoids
// duplicating the Zod tree for nested card/grid style fields.
// .passthrough() keeps flat client fields (builder/front/content) so
// extractDocumentData can nest them under jsonb `data` if `data` is
// missing. Without passthrough Zod strips unknown keys → data:null in prod.
const genericDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().default(''),
  data: z.any().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();
const businessCardDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('businessCard'),
});
const logoDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('logo'),
});
// Phase 3: flyer schema is now live. Same opaque-jsonb treatment as
// the card / logo handlers.
const flyerDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('flyer'),
});

const generatedImageDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('generatedImage'),
});

const DocumentBodySchema = z.object({
  email: z.string().email('Email non valida'),
  document: z.discriminatedUnion('documentType', [
    qrDocumentSchema,
    businessCardDocumentSchema,
    logoDocumentSchema,
    flyerDocumentSchema,
    generatedImageDocumentSchema,   // <-- ADD THIS
  ]),
});

const UserSettingsSchema = z.object({
  email: z.string().email('Email non valida'),
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  profession: z.string().optional(),
  defaultColor: z.string().optional(),
  defaultVat: z.number().optional(),
  logoUrl: z.string().optional(),
  onboardingDone: z.boolean().optional(),
  documentTheme: z.string().optional(),
  // Phase 7, onboarding step 5 preference. Optional, no transform.
  // Accepts one of: 'editor' | 'qr' | 'card' | 'flyer' | 'logo'. Other
  // values are rejected by the regex to keep the column clean.
  // Phase 3 added 'flyer' to the allowlist.
  preferredDocumentType: z
    .string()
    .regex(/^(editor|qr|card|flyer|logo)$/, 'Tipo documento non valido')
    .optional(),
});

const MAX_LOG_MSG = 2000;
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

const handleHealth: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/ping' && method === 'GET') {
    return json(req, res, 200, { ok: true });
  }

  // TB-027: config pubblica per client (feature flag registrazione).
  if (path === '/config' && method === 'GET') {
    return json(req, res, 200, {
      registrationEnabled: process.env.REGISTRATION_ENABLED === 'true',
    });
  }

  if (path === '/logs' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'logs', 200, 60 * 1000);
    if (rl.blocked) {
      return json(req, res, 429, { error: 'Troppi log' });
    }
    const { level, msg, meta, url, t } = (body as Record<string, unknown>) || {};
    if (typeof msg !== 'string' || msg.length > MAX_LOG_MSG) {
      return json(req, res, 400, { error: 'Invalid log payload' });
    }
    const safeLevel = VALID_LEVELS.has(level as string) ? (level as 'info') : 'info';
    console[safeLevel](`[client] ${msg.slice(0, 500)}`, { ...(meta as object), url, clientTs: t });
    return json(req, res, 204, {});
  }

  return json(req, res, 404, { error: 'Endpoint non trovato' });
};

const handleUsers: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/users/register' && method === 'POST') {
    // TB-027 WHITELABEL: signup disabilitato di default. Riattivare con
    // REGISTRATION_ENABLED=true (vedi spec-architecture-crm-auto-build.md
    // REQ-REG-001). Codice signup conservato per whitelabel futuro.
    if (process.env.REGISTRATION_ENABLED !== 'true') {
      return json(req, res, 403, { error: 'Registrazione non disponibile' });
    }
    const v = validate(RegisterSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, password, username, gender, tokenLimit } = v.data;
    if (email === ADMIN_EMAIL) return json(req, res, 403, { error: 'Email non disponibile' });

    const existing = await (await getDb()).select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) return json(req, res, 409, { error: 'Email già registrata' });

    const hashed = await bcrypt.hash(password, 12);
    const [created] = await (await getDb()).insert(usersTable).values({
      email, password: hashed, username, gender, role: 'user',
      tokenLimit: tokenLimit || 1000000,
    }).returning();
    return json(req, res, 201, {
      success: true,
      user: {
        email: created.email, username: created.username, gender: created.gender,
        role: created.role, createdAt: created.createdAt,
        tokensUsed: created.tokensUsed, tokenLimit: created.tokenLimit,
      },
    });
  }

  if (path === '/users/login' && method === 'POST') {
    const ip = getClientIp(req);
    const rate = checkRateLimit(ip, 'login');
    if (rate.blocked) return json(req, res, 429, { error: 'Troppi tentativi. Riprova tra 15 minuti.' });

    const v = validate(LoginSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, password } = v.data;

    if (email === ADMIN_EMAIL) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        return json(req, res, 503, { error: 'Admin password non configurata. Imposta ADMIN_PASSWORD su Vercel.' });
      }
      if (!safeCompare(password, adminPassword)) {
        recordRateAttempt(ip, false, 'login');
        return json(req, res, 401, { error: 'Email o password errati' });
      }
      recordRateAttempt(ip, true, 'login');
      return json(req, res, 200, {
        success: true,
        user: {
          email: ADMIN_EMAIL, username: 'admin', gender: 'male',
          role: 'admin', createdAt: new Date().toISOString(),
          tokensUsed: 0, tokenLimit: 999999999,
        },
      });
    }

    const [found] = await (await getDb()).select().from(usersTable).where(eq(usersTable.email, email));
    if (!found || !(await bcrypt.compare(password, found.password))) {
      recordRateAttempt(ip, false, 'login');
      return json(req, res, 401, { error: 'Email o password errati' });
    }
    recordRateAttempt(ip, true, 'login');
    return json(req, res, 200, {
      success: true,
      user: {
        email: found.email, username: found.username, gender: found.gender,
        role: found.role || 'user',
        createdAt: found.createdAt,
        tokensUsed: found.tokensUsed, tokenLimit: found.tokenLimit,
      },
    });
  }

  if (path === '/users/change-password' && method === 'POST') {
    const v = validate(ChangePasswordSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, oldPassword, newPassword } = v.data;
    const [found] = await (await getDb()).select().from(usersTable).where(eq(usersTable.email, email));
    if (!found) return json(req, res, 404, { error: 'Utente non trovato' });
    if (!(await bcrypt.compare(oldPassword, found.password))) {
      return json(req, res, 401, { error: 'Password attuale errata' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await (await getDb()).update(usersTable).set({ password: hashed }).where(eq(usersTable.email, email));
    return json(req, res, 200, { success: true });
  }

  if (path === '/users' && method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const adminEmail = url.searchParams.get('adminEmail');
    if (adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const list = await (await getDb()).select({
      email: usersTable.email, username: usersTable.username, gender: usersTable.gender,
      role: usersTable.role, createdAt: usersTable.createdAt,
      tokensUsed: usersTable.tokensUsed, tokenLimit: usersTable.tokenLimit,
    }).from(usersTable).orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  // TB-023 REQ-TC-006: cost breakdown per admin dashboard.
  // DEVIAZIONE dalla spec: non esiste una tabella di log per-chiamata con
  // provider/data — `users` ha solo aggregati lifetime (tokens_used,
  // tokens_cost_usd). Il breakdown per-provider e per finestra temporale
  // non è calcolabile senza storico: il parametro `days` è accettato per
  // compatibilità con la spec ma i valori ritornati sono aggregati totali.
  // Ollama Pro è $20/mo flat (costante condivisa con providerPricing).
  if (path === '/users/cost-breakdown' && method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const adminEmail = url.searchParams.get('adminEmail');
    if (adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const daysParam = Number(url.searchParams.get('days'));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(365, Math.floor(daysParam)) : 30;
    const list = await (await getDb()).select({
      email: usersTable.email,
      tokensUsed: usersTable.tokensUsed,
      tokensCostUsd: usersTable.tokensCostUsd,
    }).from(usersTable).orderBy(sql`tokens_cost_usd DESC`);
    return json(req, res, 200, {
      days,
      ollamaProFlatMonthly: OLLAMA_PRO_FLAT_MONTHLY,
      users: list.map((u: any) => ({
        email: u.email,
        tokensUsed: u.tokensUsed ?? 0,
        tokensCostUsd: Number(u.tokensCostUsd ?? 0),
      })),
    });
  }

  if (path.startsWith('/users/') && path.endsWith('/profile') && method === 'GET') {
    const email = decodeURIComponent(path.replace('/users/', '').replace('/profile', ''));
    const [found] = await (await getDb()).select().from(usersTable).where(eq(usersTable.email, email));
    if (!found) return json(req, res, 404, { error: 'Utente non trovato' });
    return json(req, res, 200, {
      email: found.email, username: found.username, gender: found.gender,
      role: found.role, tokensUsed: found.tokensUsed, tokenLimit: found.tokenLimit,
    });
  }

  if (path === '/users/limits' && method === 'PATCH') {
    if (body.adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const v = validate(TokenLimitSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, tokenLimit } = v.data;
    await (await getDb()).update(usersTable).set({ tokenLimit }).where(eq(usersTable.email, email));
    return json(req, res, 200, { success: true });
  }

  if (path === '/users/tokens' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'tokens', 30, 60 * 1000);
    if (rl.blocked) {
      return json(req, res, 429, { error: 'Troppi aggiornamenti token. Attendi un minuto.' });
    }
    const v = validate(TrackTokensSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, tokens, costUsd } = v.data;
    if (tokens > 100000) {
      return json(req, res, 400, { error: 'Token count anomalo. Max 100k per richiesta.' });
    }
    // TB-023: aggiorna anche tokens_cost_usd se passato
    if (typeof costUsd === 'number' && costUsd > 0) {
      await (await getDb()).update(usersTable).set({
        tokensUsed: sql`tokens_used + ${tokens}`,
        tokensCostUsd: sql`COALESCE(tokens_cost_usd, 0) + ${costUsd}`,
      }).where(eq(usersTable.email, email));
    } else {
      await (await getDb()).update(usersTable).set({
        tokensUsed: sql`tokens_used + ${tokens}`,
      }).where(eq(usersTable.email, email));
    }
    return json(req, res, 200, { success: true });
  }

  // ─── TIER SYSTEM (phase 5) ────────────────────────────

  if (path === '/users/tier' && method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const email = url.searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });
    if (email === ADMIN_EMAIL) {
      return json(req, res, 200, { data: { tier: 'unlocked', documentCount: 0, documentLimit: null } });
    }
    const [settings] = await (await getDb()).select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    const tier = settings?.tier === 'unlocked' ? 'unlocked' : 'free';
    return json(req, res, 200, {
      data: {
        tier,
        documentCount: settings?.documentCount || 0,
        documentLimit: tier === 'unlocked' ? null : FREE_DOCUMENT_LIMIT,
      },
    });
  }

  if (path === '/users/document-count' && method === 'PATCH') {
    const v = validate(DocumentCountSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, delta } = v.data;
    if (email === ADMIN_EMAIL) {
      return json(req, res, 200, { data: { documentCount: 0 } });
    }
    // upsert: ensure user_settings row exists, then increment
    const [existing] = await (await getDb()).select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    if (!existing) {
      const [created] = await (await getDb()).insert(userSettingsTable).values({
        userEmail: email,
        tier: 'free',
        documentCount: Math.max(0, delta),
      }).returning();
      return json(req, res, 200, { data: { documentCount: created.documentCount || 0 } });
    }
    const newCount = Math.max(0, (existing.documentCount || 0) + delta);
    await (await getDb()).update(userSettingsTable).set({
      documentCount: newCount,
    }).where(eq(userSettingsTable.userEmail, email));
    return json(req, res, 200, { data: { documentCount: newCount } });
  }

  if (path === '/users/redeem-code' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, 'redeem', 5, 15 * 60 * 1000);
    if (rl.blocked) {
      return json(req, res, 429, { error: 'Troppi tentativi di riscatto. Riprova tra 15 minuti.' });
    }
    const v = validate(RedeemCodeSchema, body);
    if (v.error) {
      recordRateAttempt(ip, false, 'redeem');
      return json(req, res, 400, { errors: v.errors });
    }
    const { email, code } = v.data;
    const normalized = code.trim().toUpperCase();

    // Admin short-circuit
    if (email === ADMIN_EMAIL) {
      recordRateAttempt(ip, true, 'redeem');
      return json(req, res, 200, { data: { tier: 'unlocked' } });
    }

    // Lookup case-insensitive
    const [found] = await (await getDb()).select().from(unlockCodesTable)
      .where(sql`LOWER(${unlockCodesTable.code}) = LOWER(${normalized})`);

    if (!found) {
      recordRateAttempt(ip, false, 'redeem');
      return json(req, res, 404, { error: 'Codice non valido' });
    }
    if (found.usedBy) {
      recordRateAttempt(ip, false, 'redeem');
      return json(req, res, 409, { error: 'Codice già utilizzato' });
    }

    // Atomic claim: only update if used_by is still null (race-condition safe)
    const claimResult = await (await getDb()).update(unlockCodesTable).set({
      usedBy: email,
      usedAt: sql`now()`,
    }).where(sql`${unlockCodesTable.code} = ${found.code} AND ${unlockCodesTable.usedBy} IS NULL`).returning();
    if (claimResult.length === 0) {
      recordRateAttempt(ip, false, 'redeem');
      return json(req, res, 409, { error: 'Codice già utilizzato' });
    }

    // Upsert user_settings → unlocked
    const [existing] = await (await getDb()).select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    if (existing) {
      await (await getDb()).update(userSettingsTable).set({
        tier: 'unlocked',
        unlockCode: normalized,
        unlockedAt: sql`now()`,
      }).where(eq(userSettingsTable.userEmail, email));
    } else {
      await (await getDb()).insert(userSettingsTable).values({
        userEmail: email,
        tier: 'unlocked',
        unlockCode: normalized,
        unlockedAt: sql`now()`,
        documentCount: 0,
      });
    }

    recordRateAttempt(ip, true, 'redeem');
    console.info('[tier] code redeemed', { email, codePrefix: normalized.slice(0, 4) });
    return json(req, res, 200, { data: { tier: 'unlocked' } });
  }

  return json(req, res, 404, { error: 'Endpoint users non trovato' });
};

const handleAdmin: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/admin/deepseek-status' && method === 'GET') {
    return json(req, res, 200, { configured: !!process.env.DEEPSEEK_API_KEY });
  }

  if (path === '/admin/generate-unlock-code' && method === 'POST') {
    const v = validate(GenerateCodeSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { adminEmail, package: pkg } = v.data;
    if (adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    if (!VALID_PACKAGES.has(pkg)) {
      return json(req, res, 400, { error: 'Package non valido' });
    }
    const code = generateUnlockCode();
    const [created] = await (await getDb()).insert(unlockCodesTable).values({
      code,
      package: pkg,
      usedBy: null,
      usedAt: null,
      createdBy: adminEmail,
    }).returning();
    return json(req, res, 201, { data: { code: created.code } });
  }

  if (path === '/admin/unlock-codes' && method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const adminEmail = url.searchParams.get('adminEmail');
    if (adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const list = await (await getDb()).select().from(unlockCodesTable).orderBy(sql`created_at DESC`);
    return json(req, res, 200, {
      data: list.map((c: any) => ({
        code: c.code,
        package: c.package,
        usedBy: c.usedBy,
        usedAt: c.usedAt,
        createdAt: c.createdAt,
      })),
    });
  }

  // Admin sblocca direttamente un utente senza codice
  if (path === '/admin/unlock-user' && method === 'POST') {
    const v = validate(UnlockUserSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { adminEmail, userEmail } = v.data;
    if (adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    if (userEmail === ADMIN_EMAIL) {
      return json(req, res, 200, { data: { tier: 'unlocked' } });
    }
    const [existing] = await (await getDb()).select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, userEmail));
    if (existing) {
      await (await getDb()).update(userSettingsTable).set({
        tier: 'unlocked',
        unlockedAt: sql`now()`,
      }).where(eq(userSettingsTable.userEmail, userEmail));
    } else {
      await (await getDb()).insert(userSettingsTable).values({
        userEmail,
        tier: 'unlocked',
        unlockedAt: sql`now()`,
        documentCount: 0,
      });
    }
    console.info('[tier] admin unlocked user', { adminEmail, userEmail });
    return json(req, res, 200, { data: { tier: 'unlocked' } });
  }

  return json(req, res, 404, { error: 'Endpoint admin non trovato' });
};

const handleQuotes: RouteHandler = async (path, method, req, res, body) => {
  const url = new URL(req.url, 'http://localhost');
  const searchParams = url.searchParams;

  if (path === '/quotes' && method === 'GET') {
    const userEmail = searchParams.get('email');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    // Phase 7 fix: legacy /quotes endpoint must only return quote documents.
    // Without this filter, CollectionView merges the full list into unified
    // documents and creates duplicate ids with conflicting documentTypes,
    // breaking React keys and the per-type tab filter in production.
    const list = await (await getDb()).select().from(documentsTable)
      .where(and(eq(documentsTable.userEmail, userEmail), eq(documentsTable.documentType, 'quote')))
      .orderBy(sql`created_at DESC`);
    // Defense-in-depth: even if the DB mock/test returns the full row set,
    // the public contract of /quotes is quote-only.
    return json(req, res, 200, list.filter((d: any) => d.documentType === 'quote'));
  }

  if (path === '/quotes/all' && method === 'GET') {
    if (searchParams.get('adminEmail') !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const list = await (await getDb()).select().from(documentsTable)
      .where(eq(documentsTable.documentType, 'quote'))
      .orderBy(sql`created_at DESC`);
    // Defense-in-depth: enforce quote-only shape for the admin endpoint too.
    return json(req, res, 200, list.filter((d: any) => d.documentType === 'quote'));
  }

  if (path === '/quotes' && method === 'POST') {
    const v = validate(QuoteBodySchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, quote } = v.data;

    const existing = await (await getDb()).select().from(documentsTable).where(eq(documentsTable.id, quote.id));
    if (existing.length > 0) {
      if (existing[0].userEmail !== email) {
        return json(req, res, 403, { error: 'Non autorizzato' });
      }
      const [updated] = await (await getDb()).update(documentsTable).set({
        documentType: existing[0].documentType || 'quote',
        title: quote.title, client: quote.client, date: quote.date,
        intro: quote.intro, color: quote.color, vat: quote.vat,
        status: quote.status || 'BOZZA', owner: quote.owner,
        options: quote.options || [],
        clauses: quote.clauses || [],
        isTemplate: quote.isTemplate ?? existing[0].isTemplate ?? false,
        pdfUrl: quote.pdfUrl ?? existing[0].pdfUrl,
        documentTheme: quote.documentTheme ?? existing[0].documentTheme,
        updatedAt: sql`now()`,
      }).where(eq(documentsTable.id, quote.id)).returning();
      return json(req, res, 200, updated);
    }

    const [saved] = await (await getDb()).insert(documentsTable).values({
      id: quote.id, userEmail: email, documentType: 'quote',
      title: quote.title, client: quote.client,
      date: quote.date, intro: quote.intro, color: quote.color, vat: quote.vat,
      status: quote.status || 'BOZZA', owner: quote.owner,
      options: quote.options || [],
      clauses: quote.clauses || [],
      isTemplate: quote.isTemplate ?? false,
      pdfUrl: quote.pdfUrl || null,
      documentTheme: quote.documentTheme || 'corporate',
    }).returning();
    return json(req, res, 201, saved);
  }

  if (path.startsWith('/quotes/') && method === 'DELETE') {
    const quoteId = path.replace('/quotes/', '');
    const email = body.email || searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });

    const [existing] = await (await getDb()).select().from(documentsTable).where(eq(documentsTable.id, quoteId));
    if (!existing) return json(req, res, 404, { error: 'Preventivo non trovato' });
    if (existing.userEmail !== email) {
      return json(req, res, 403, { error: 'Non autorizzato' });
    }
    await (await getDb()).delete(documentsTable).where(eq(documentsTable.id, quoteId));
    return json(req, res, 200, { success: true });
  }

  if (path === '/quotes/templates' && method === 'GET') {
    const userEmail = searchParams.get('email');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    const list = await (await getDb()).select().from(documentsTable)
      .where(and(eq(documentsTable.userEmail, userEmail), eq(documentsTable.isTemplate, true)))
      .orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  return json(req, res, 404, { error: 'Endpoint quotes non trovato' });
};

const handleDocuments: RouteHandler = async (path, method, req, res, body) => {
  const url = new URL(req.url, 'http://localhost');
  const searchParams = url.searchParams;

  if (path === '/documents' && method === 'GET') {
    const userEmail = searchParams.get('email');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    const type = searchParams.get('type');
    const all = await (await getDb()).select().from(documentsTable)
      .where(eq(documentsTable.userEmail, userEmail))
      .orderBy(sql`updated_at DESC`);
    const filtered = type ? all.filter((d: any) => d.documentType === type) : all;
    return json(req, res, 200, filtered);
  }

  if (path.startsWith('/documents/') && method === 'GET') {
    const documentId = path.replace('/documents/', '');
    const userEmail = searchParams.get('email');
    const type = searchParams.get('type');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    const [existing] = await (await getDb()).select().from(documentsTable).where(eq(documentsTable.id, documentId));
    if (!existing || existing.userEmail !== userEmail || (type && existing.documentType !== type)) {
      return json(req, res, 404, { error: 'Documento non trovato' });
    }
    return json(req, res, 200, existing);
  }

  if (path === '/documents' && method === 'POST') {
    const v = validate(DocumentBodySchema, body);
    if (v.error) {
      return json(req, res, 400, { errors: v.errors });
    }
    const { email, document } = v.data;

    // Extract payload for jsonb `data` column.
    // Client may send either:
    //   a) wrapped: { id, documentType, title, data: {...} }  (preferred)
    //   b) flat:    { id, documentType, title, builder|front|content|... }
    // Without this, flat logo/card/flyer used to store data:null in prod.
    const extractDocumentData = (doc: any): unknown => {
      if (doc.documentType === 'qrCode') return doc.data ?? null;
      if (doc.data != null) return doc.data;
      const META = new Set(['id', 'documentType', 'title', 'userEmail', 'customerId', 'createdAt', 'updatedAt', 'isTemplate', 'data']);
      const domain: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(doc)) {
        if (!META.has(k)) domain[k] = val;
      }
      return Object.keys(domain).length > 0 ? domain : null;
    };

    const dataToStore = extractDocumentData(document);
    const existing = await (await getDb()).select().from(documentsTable).where(eq(documentsTable.id, document.id));
    if (existing.length > 0) {
      if (existing[0].userEmail !== email) {
        return json(req, res, 403, { error: 'Non autorizzato' });
      }
      const [updated] = await (await getDb()).update(documentsTable).set({
        documentType: document.documentType,
        title: document.title,
        data: dataToStore as never,
        updatedAt: sql`now()`,
      }).where(eq(documentsTable.id, document.id)).returning();
      return json(req, res, 200, updated);
    }
    const [saved] = await (await getDb()).insert(documentsTable).values({
      id: document.id,
      userEmail: email,
      documentType: document.documentType,
      title: document.title,
      data: dataToStore as never,
      isTemplate: false,
    }).returning();
    console.log('[doc] POST creato', { id: document.id, type: document.documentType, email, dataBytes: JSON.stringify(dataToStore)?.length });
    // Phase 5: increment user document count (admin excluded, no-op)
    if (email !== ADMIN_EMAIL) {
      const [settings] = await (await getDb()).select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
      if (settings) {
        await (await getDb()).update(userSettingsTable).set({
          documentCount: sql`COALESCE(${userSettingsTable.documentCount}, 0) + 1`,
        }).where(eq(userSettingsTable.userEmail, email));
      } else {
        await (await getDb()).insert(userSettingsTable).values({
          userEmail: email,
          tier: 'free',
          documentCount: 1,
        });
      }
    }
    return json(req, res, 201, saved);
  }

  if (path.startsWith('/documents/') && method === 'DELETE') {
    const documentId = path.replace('/documents/', '');
    const email = body.email || searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });

    const [existing] = await (await getDb()).select().from(documentsTable).where(eq(documentsTable.id, documentId));
    if (!existing) {
      console.log('[doc] DELETE 404', { id: documentId, email, bodyEmail: body.email, queryEmail: searchParams.get('email') });
      return json(req, res, 404, { error: 'Documento non trovato' });
    }
    if (existing.userEmail !== email) {
      return json(req, res, 403, { error: 'Non autorizzato' });
    }
    await (await getDb()).delete(documentsTable).where(eq(documentsTable.id, documentId));
    return json(req, res, 200, { success: true });
  }

  if (path === '/documents/cleanup-ghosts' && method === 'POST') {
    if (!requireAdmin(req, res, body)) return;
    const db = await getDb();
    const deleted = await db.delete(documentsTable).where(
      and(eq(documentsTable.status, 'BOZZA'), sql`data IS NULL`)
    ).returning({ id: documentsTable.id });
    console.log('[doc] cleanup-ghosts', { count: deleted.length, ids: deleted.map((d: any) => d.id) });
    return json(req, res, 200, { deleted: deleted.length });
  }

  return json(req, res, 404, { error: 'Endpoint documents non trovato' });
};

const handleUserSettings: RouteHandler = async (path, method, req, res, body) => {
  const url = new URL(req.url, 'http://localhost');
  const searchParams = url.searchParams;

  if (path === '/user-settings' && method === 'GET') {
    const email = searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });
    const [settings] = await (await getDb()).select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    if (email === ADMIN_EMAIL) {
      return json(req, res, 200, settings || { userEmail: ADMIN_EMAIL, onboardingDone: true });
    }
    if (settings) {
      // SEC: user_settings may contain server-only keys; return only known safe fields
      const safe: Record<string, unknown> = {};
      for (const k of ['userEmail', 'displayName', 'companyName', 'profession', 'defaultColor', 'defaultVat', 'logoUrl', 'documentTheme', 'onboardingDone', 'tier', 'unlockCode', 'unlockedAt', 'documentCount', 'preferredDocumentType']) {
        if ((settings as Record<string, unknown>)[k] !== undefined) safe[k] = (settings as Record<string, unknown>)[k];
      }
      return json(req, res, 200, safe);
    }
    return json(req, res, 200, { userEmail: email, onboardingDone: false });
  }

  if (path === '/user-settings' && method === 'POST') {
    const v = validate(UserSettingsSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, ...settings } = v.data;
    // Preserve fields not in schema but known to be persisted by dataService (imageGenModel etc.)
    const bodyRecord = body as Record<string, unknown>;
    const settingsRecord = settings as Record<string, unknown>;
    const extraFields = ['imageGenModel', 'tier', 'unlockCode', 'documentCount'];
    for (const k of extraFields) {
      const val = bodyRecord[k];
      if (val !== undefined && settingsRecord[k] === undefined) {
        settingsRecord[k] = val;
      }
    }
    const setPayload: Record<string, unknown> = {};
    if (settings.displayName !== undefined) setPayload.displayName = settings.displayName;
    if (settings.companyName !== undefined) setPayload.companyName = settings.companyName;
    if (settings.profession !== undefined) setPayload.profession = settings.profession;
    if (settings.defaultColor !== undefined) setPayload.defaultColor = settings.defaultColor;
    if (settings.defaultVat !== undefined) setPayload.defaultVat = settings.defaultVat;
    if (settings.logoUrl !== undefined) setPayload.logoUrl = settings.logoUrl;
    if (settings.onboardingDone !== undefined) setPayload.onboardingDone = settings.onboardingDone;
    if (settings.documentTheme !== undefined) setPayload.documentTheme = settings.documentTheme;
    if (settings.preferredDocumentType !== undefined) setPayload.preferredDocumentType = settings.preferredDocumentType;
    if (settingsRecord.imageGenModel !== undefined) setPayload.imageGenModel = settingsRecord.imageGenModel || null;
    if (settingsRecord.tier !== undefined) setPayload.tier = settingsRecord.tier;
    if (settingsRecord.unlockCode !== undefined) setPayload.unlockCode = settingsRecord.unlockCode;
    if (settingsRecord.documentCount !== undefined) setPayload.documentCount = settingsRecord.documentCount;
    const existing = await (await getDb()).select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    if (existing.length > 0) {
      const [updated] = await (await getDb()).update(userSettingsTable).set(setPayload).where(eq(userSettingsTable.userEmail, email)).returning();
      return json(req, res, 200, updated);
    }
    const [created] = await (await getDb()).insert(userSettingsTable).values({
      userEmail: email,
      displayName: settings.displayName ?? null,
      companyName: settings.companyName ?? null,
      profession: settings.profession ?? null,
      defaultColor: settings.defaultColor ?? null,
      defaultVat: settings.defaultVat ?? 22,
      logoUrl: settings.logoUrl ?? null,
      documentTheme: settings.documentTheme ?? 'corporate',
      onboardingDone: settings.onboardingDone ?? false,
      preferredDocumentType: settings.preferredDocumentType ?? null,
      imageGenModel: settingsRecord.imageGenModel ?? null,
      tier: settingsRecord.tier ?? 'free',
      unlockCode: settingsRecord.unlockCode ?? null,
      documentCount: settingsRecord.documentCount ?? 0,
    }).returning();
    return json(req, res, 201, created);
  }

  return json(req, res, 404, { error: 'Endpoint user-settings non trovato' });
};

const handleAI: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/ai/chat' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aichat', 30, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste AI. Attendi un minuto.' }, requestId);
    }
    const v = validate(
      z.object({
        model: z.string().optional(),
        messages: z
          .array(
            z.object({
              role: z.enum(['system', 'user', 'assistant', 'tool']),
              content: z.string(),
              tool_call_id: z.string().optional(),
              name: z.string().optional(),
              // TB-023: Ollama multimodal messages may include images
              images: z.array(z.string()).optional(),
              tool_calls: z
                .array(
                  z.object({
                    function: z.object({
                      name: z.string(),
                      arguments: z.string(),
                    }),
                  }),
                )
                .optional(),
            }),
          )
          .min(1)
          .max(50),
        response_format: z.object({ type: z.literal('json_object') }).optional(),
        temperature: z.number().min(0).max(2).optional(),
        max_tokens: z.number().int().positive().max(8192).optional(),
        userEmail: z.string().email().optional(),
        // TB-023: provider routing (default deepseek)
        provider: z.enum(['deepseek', 'ollama']).optional(),
        // Ollama-only fields
        tools: z
          .array(
            z.object({
              type: z.literal('function'),
              function: z.object({
                name: z.string(),
                description: z.string().optional(),
                parameters: z.record(z.string(), z.unknown()).optional(),
              }),
            }),
          )
          .optional(),
        format: z.union([z.literal('json'), z.record(z.string(), z.unknown())]).optional(),
        stream: z.boolean().optional(),
        options: z.record(z.string(), z.unknown()).optional(),
      }),
      body
    );
    if (v.error) {
      logAI({ tag: 'ai_chat', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const provider = v.data.provider || 'deepseek';

    // ─── TB-023: Ollama Pro Cloud routing ─────────────────────────
    if (provider === 'ollama') {
      const ollamaKey = process.env.OLLAMA_API_KEY;
      if (!ollamaKey) {
        logAI({ tag: 'ai_chat', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
        return jsonWithRequestId(req, res, 503, { error: 'Ollama non configurato. Configura OLLAMA_API_KEY su Vercel.' }, requestId);
      }
      const { model, messages, temperature, max_tokens, tools, format, options: ollamaOptions } = v.data;
      const ollamaModel = model || 'minimax-m3:cloud';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // Ollama Cloud più lento di DeepSeek
      const startedAt = Date.now();
      let apiRes: Response;
      try {
        const ollamaBody: Record<string, unknown> = {
          model: ollamaModel,
          messages: messages.map((m) => {
            const msg: Record<string, unknown> = { role: m.role, content: m.content };
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
            if (m.name) msg.name = m.name;
            if (m.images && m.images.length > 0) msg.images = m.images;
            if (m.tool_calls && m.tool_calls.length > 0) {
              msg.tool_calls = m.tool_calls.map((tc) => ({
                function: { name: tc.function.name, arguments: tc.function.arguments },
              }));
            }
            return msg;
          }),
          stream: false,
        };
        if (temperature !== undefined) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), temperature };
        }
        if (max_tokens !== undefined) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), num_predict: max_tokens };
        }
        if (ollamaOptions) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), ...ollamaOptions };
        }
        if (v.data.response_format?.type === 'json_object' || format === 'json') {
          ollamaBody.format = 'json';
        } else if (format) {
          ollamaBody.format = format;
        }
        if (tools && tools.length > 0) ollamaBody.tools = tools;

        apiRes = await fetch('https://ollama.com/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ollamaKey}`,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
          logAI({ tag: 'ai_chat', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'timeout' });
          return jsonWithRequestId(req, res, 504, { error: 'Ollama non ha risposto entro 60 secondi. Riprova.' }, requestId);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
      if (!apiRes.ok) {
        const errBody = await apiRes.text().catch(() => 'Unknown error');
        const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
        logAI({ tag: 'ai_chat', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
        if (apiRes.status === 429) {
          return jsonWithRequestId(req, res, 429, { error: 'Quota Ollama Pro superato. Riprova tra qualche ora o passa a DeepSeek.' }, requestId);
        }
        if (apiRes.status === 401) {
          return jsonWithRequestId(req, res, 401, { error: 'Chiave API Ollama non valida' }, requestId);
        }
        return jsonWithRequestId(req, res, apiRes.status, { error: `Ollama (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
      }
      const raw = await apiRes.json();
      // Normalizza risposta Ollama → formato DeepSeek-like per il client
      const ollamaRaw = raw as {
        message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string | object } }> };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const toolCalls = ollamaRaw.message?.tool_calls?.map((tc, i) => ({
        id: `call_${Date.now()}_${i}`,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments ?? {}),
        },
      }));
      const normalized = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: ollamaRaw.message?.content || '',
              ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: ollamaRaw.prompt_eval_count ?? 0,
          completion_tokens: ollamaRaw.eval_count ?? 0,
          total_tokens: (ollamaRaw.prompt_eval_count ?? 0) + (ollamaRaw.eval_count ?? 0),
        },
        requestId,
      };
      logAI({
        tag: 'ai_chat',
        requestId,
        email: userEmail,
        model: ollamaModel,
        durationMs: Date.now() - startedAt,
        outcome: 'ok',
        tokens: normalized.usage.total_tokens || undefined,
        provider: 'ollama',
      });
      return json(req, res, 200, normalized);
    }

    // ─── DeepSeek (default, preesistente) ─────────────────────────
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_chat', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'DeepSeek non configurato.' }, requestId);
    }
    const { model, messages, response_format, temperature } = v.data;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const startedAt = Date.now();
    let apiRes: Response;
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'deepseek-v4-flash',
          messages,
          response_format: response_format || { type: 'json_object' },
          temperature: temperature ?? 0.7,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        logAI({ tag: 'ai_chat', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'timeout' });
        return jsonWithRequestId(req, res, 504, { error: 'DeepSeek non ha risposto entro 25 secondi. Riprova.' }, requestId);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => 'Unknown error');
      const errorKind = apiRes.status === 402 ? 'quota' : apiRes.status === 401 ? 'auth' : apiRes.status === 429 ? 'rate_limit' : 'upstream';
      logAI({ tag: 'ai_chat', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (apiRes.status === 402) return jsonWithRequestId(req, res, 402, { error: 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com' }, requestId);
      if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API DeepSeek non valida' }, requestId);
      if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.' }, requestId);
      return jsonWithRequestId(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
    }
    const data = await apiRes.json();
    const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
    logAI({
      tag: 'ai_chat',
      requestId,
      email: userEmail,
      model: model || 'deepseek-v4-flash',
      durationMs: Date.now() - startedAt,
      outcome: 'ok',
      tokens: usage?.total_tokens,
      provider: 'deepseek',
    });
    return json(req, res, 200, { ...data, requestId });
  }

  // Phase 3: dedicated copy endpoint for flyers. Same DeepSeek upstream
  // as /ai/chat, but with a tighter rate limit (10/min per IP) since
  // copy generation is more expensive (full prompt + system instructions)
  // and not interactive like chat. Auth: same as /ai/chat (serverless
  // function is auth-gated at the route level: a valid session cookie or
  // Vercel-Auth is required; the actual authorization check happens in
  // dataService.chatWithAI client side). The endpoint trusts the client
  // to have a valid session.
  if (path === '/ai/copy-flyer' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'flyerCopy', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni di copy. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_copy_flyer', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'DeepSeek non configurato.' }, requestId);
    }
    const v = validate(
      z.object({
        brief: z.string().max(1000),
        tone: z.enum(['formale', 'giovanile', 'tecnico']),
        layout: z.enum(['classic', 'centered', 'split', 'magazine']).optional(),
        size: z.enum(['A6', 'A5', 'A4', 'Letter', 'Square']).optional(),
        model: z.string().optional(),
      }),
      body
    );
    if (v.error) {
      logAI({ tag: 'ai_copy_flyer', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { errors: v.errors }, requestId);
    }
    const { brief, tone, layout, size, model } = v.data;
    const startedAt = Date.now();
    // Brief is sanitized server-side: strip HTML tags and control
    // characters before it hits the LLM prompt. This is a defense in
    // depth: the client sanitizes too (see sanitizeFlyerBrief in
    // src/ai/prompts/flyerSystem.ts), but we never trust a client.
    const sanitizedBrief = String(brief || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    if (!sanitizedBrief) return json(req, res, 400, { error: 'Brief vuoto' });
    // Build the prompt server-side: the public API surface doesn't
    // expose the prompt template (proprietary copy framework). Same
    // template as the client's flyerCopy.ts so behavior is consistent
    // regardless of where the call originates.
    const systemMsg = `Sei un copywriter italiano esperto in volantini pubblicitari. Rispondi SOLO con JSON valido.`;
    const toneLine =
      tone === 'formale'
        ? 'tono formale e professionale'
        : tone === 'giovanile'
          ? 'tono fresco e giovanile, contrazioni ammesse'
          : 'tono tecnico e preciso, includi numeri e specifiche';
    const bodyBudget = size === 'A4' || size === 'Letter' ? 800 : size === 'Square' ? 600 : size === 'A6' ? 300 : 500;
    const userMsg = `Brief: "${sanitizedBrief}"
Tono: ${toneLine}
${layout ? `Layout: ${layout}` : ''}
${size ? `Formato: ${size}` : ''}

Restituisci SOLO un oggetto JSON valido con questa struttura:
{
  "headline": "titolo principale, max 60 caratteri",
  "subheadline": "sottotitolo, max 100 caratteri",
  "body": "corpo del testo, max ${bodyBudget} caratteri, usa \\\\n per paragrafi",
  "cta": { "label": "call to action, max 30 caratteri" }
}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let apiRes: Response;
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'timeout' });
        return jsonWithRequestId(req, res, 504, { error: 'DeepSeek non ha risposto entro 25 secondi. Riprova.' }, requestId);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => 'Unknown error');
      const errorKind = apiRes.status === 402 ? 'quota' : apiRes.status === 401 ? 'auth' : apiRes.status === 429 ? 'rate_limit' : 'upstream';
      logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (apiRes.status === 402) return jsonWithRequestId(req, res, 402, { error: 'Credito DeepSeek esaurito.' }, requestId);
      if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API DeepSeek non valida' }, requestId);
      if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.' }, requestId);
      return jsonWithRequestId(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
    }
    const data = await apiRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_response' });
      return jsonWithRequestId(req, res, 502, { error: 'Risposta AI vuota o malformata' }, requestId);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'not_json' });
      return jsonWithRequestId(req, res, 502, { error: 'AI non ha restituito JSON valido', raw: content.slice(0, 500) }, requestId);
    }
    const usage = (data as { usage?: { total_tokens?: number } }).usage;
    logAI({ tag: 'ai_copy_flyer', requestId, model: model || 'deepseek-v4-flash', durationMs: Date.now() - startedAt, outcome: 'ok', tokens: usage?.total_tokens });
    return json(req, res, 200, { data: parsed, raw: content, requestId });
  }

  // POST /ai/embeddings → Gemini gemini-embedding-2 (RAG customer knowledge)
  if (path === '/ai/embeddings' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'embeddings', 30, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return json(req, res, 429, { error: 'Troppe richieste embeddings. Attendi un minuto.' });
    }
    const v = validate(
      z.object({
        input: z.string().max(8000),
        model: z.enum(['gemini-embedding-2']).optional(),
      }),
      body
    );
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(req, res, 503, { error: 'Gemini non configurato. Configura GEMINI_API_KEY su Vercel.' });
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.embedContent({
        model: 'models/gemini-embedding-2',
        contents: v.data.input,
      });
      const embedding = (result as unknown as { embedding?: { values?: number[] } })?.embedding?.values || [];
      if (!Array.isArray(embedding) || embedding.length === 0) {
        return json(req, res, 502, { error: 'Embedding vuoto da Gemini' });
      }
      return json(req, res, 200, { data: { embedding, model: v.data.model || 'gemini-embedding-2' } });
    } catch (err) {
      console.error('[embeddings] Gemini error', (err as Error)?.message);
      return json(req, res, 502, { error: 'Errore embedding Gemini' });
    }
  }

  if (path === '/ai/chat/stream' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aistream', 30, 60 * 1000);
    if (rl.blocked) {
      return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste AI. Attendi un minuto.' }, requestId);
    }
    const v = validate(
      z.object({
        model: z.string().optional(),
        messages: z
          .array(
            z.object({
              role: z.enum(['system', 'user', 'assistant', 'tool']),
              content: z.string(),
              tool_call_id: z.string().optional(),
              name: z.string().optional(),
              // TB-023: Ollama multimodal messages may include images
              images: z.array(z.string()).optional(),
            }),
          )
          .min(1)
          .max(50),
        tools: z.array(z.any()).optional(),
        temperature: z.number().min(0).max(2).optional(),
        max_tokens: z.number().int().positive().max(8192).optional(),
        userEmail: z.string().email().optional(),
        // TB-023: provider routing (default deepseek)
        provider: z.enum(['deepseek', 'ollama']).optional(),
        // Ollama-only options
        options: z.record(z.string(), z.unknown()).optional(),
        format: z.union([z.literal('json'), z.record(z.string(), z.unknown())]).optional(),
      }),
      body
    );
    if (v.error) {
      logAI({ tag: 'ai_chat_stream', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const provider = v.data.provider || 'deepseek';
    const startedAt = Date.now();

    // ─── TB-023: Ollama Pro Cloud streaming ─────────────────────────
    if (provider === 'ollama') {
      const ollamaKey = process.env.OLLAMA_API_KEY;
      if (!ollamaKey) {
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
        return jsonWithRequestId(req, res, 503, { error: 'Ollama non configurato. Configura OLLAMA_API_KEY su Vercel.' }, requestId);
      }
      const { model, messages, temperature, max_tokens, tools, options: ollamaOptions, format } = v.data;
      const ollamaModel = model || 'minimax-m3:cloud';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      let apiRes: Response;
      try {
        const ollamaBody: Record<string, unknown> = {
          model: ollamaModel,
          messages: messages.map((m) => {
            const msg: Record<string, unknown> = { role: m.role, content: m.content };
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
            if (m.name) msg.name = m.name;
            if (m.images && m.images.length > 0) msg.images = m.images;
            return msg;
          }),
          stream: true,
        };
        if (temperature !== undefined) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), temperature };
        }
        if (max_tokens !== undefined) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), num_predict: max_tokens };
        }
        if (ollamaOptions) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), ...ollamaOptions };
        }
        if (tools && tools.length > 0) ollamaBody.tools = tools;
        if (format) ollamaBody.format = format;

        apiRes = await fetch('https://ollama.com/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ollamaKey}`,
            'X-Request-Id': requestId,
            Accept: 'application/x-ndjson',
          },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        const errorKind = err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError' ? 'timeout' : 'connection';
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: model || ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
        if (errorKind === 'timeout') {
          return jsonWithRequestId(req, res, 504, { error: 'Ollama non ha risposto entro 60 secondi. Riprova.' }, requestId);
        }
        return jsonWithRequestId(req, res, 502, { error: `Connessione Ollama fallita: ${(err as Error)?.message || 'unknown'}` }, requestId);
      }
      if (!apiRes.ok) {
        clearTimeout(timeout);
        const errBody = await apiRes.text().catch(() => 'Unknown error');
        const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
        if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Quota Ollama Pro superato. Riprova tra qualche ora o passa a DeepSeek.' }, requestId);
        if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API Ollama non valida' }, requestId);
        return jsonWithRequestId(req, res, apiRes.status, { error: `Ollama (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
      }

      addCorsHeaders(req, res);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-Provider', 'ollama');

      const reader = apiRes.body?.getReader();
      if (!reader) {
        clearTimeout(timeout);
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_body' });
        return res.end();
      }
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'ok', provider: 'ollama' });

      const decoder = new TextDecoder();
      let buffer = '';
      let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              const content = parsed.message?.content || '';
              if (parsed.prompt_eval_count !== undefined || parsed.eval_count !== undefined) {
                finalUsage = {
                  prompt_tokens: parsed.prompt_eval_count ?? finalUsage?.prompt_tokens ?? 0,
                  completion_tokens: parsed.eval_count ?? finalUsage?.completion_tokens ?? 0,
                  total_tokens: (parsed.prompt_eval_count ?? finalUsage?.prompt_tokens ?? 0) + (parsed.eval_count ?? finalUsage?.completion_tokens ?? 0),
                };
              }
              const ssePayload: Record<string, unknown> = {
                choices: [{ index: 0, delta: { content } }],
              };
              if (parsed.message?.tool_calls) {
                (ssePayload.choices as any)[0].delta.tool_calls = parsed.message.tool_calls.map((tc: any, i: number) => ({
                  index: i,
                  function: { name: tc.function?.name, arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments ?? {}) },
                }));
              }
              if (parsed.done && finalUsage) {
                ssePayload.usage = finalUsage;
              }
              res.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
            } catch {
              // skip malformed NDJSON line
            }
          }
        }
        res.write('data: [DONE]\n\n');
      } catch (err) {
        console.error('[Stream Ollama] Errore durante lo streaming', { msg: (err as Error)?.message, requestId });
      } finally {
        clearTimeout(timeout);
        if (!res.writableEnded) res.end();
      }
      return;
    }

    // ─── DeepSeek streaming (default, preesistente) ─────────────────────────
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'DeepSeek non configurato.' }, requestId);
    }
    const { model, messages, tools, temperature, max_tokens } = v.data;
    const upBody = {
      model: model || 'deepseek-v4-flash',
      messages,
      stream: true,
      ...(tools ? { tools } : {}),
      ...(temperature !== undefined ? { temperature } : { temperature: 0.7 }),
      ...(max_tokens ? { max_tokens } : {}),
    };
    let apiRes: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(upBody),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const errorKind = err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError' ? 'timeout' : 'connection';
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (errorKind === 'timeout') {
        return jsonWithRequestId(req, res, 504, { error: 'DeepSeek non ha risposto entro 60 secondi. Riprova.' }, requestId);
      }
      return jsonWithRequestId(req, res, 502, { error: `Connessione fallita: ${(err as Error)?.message || 'unknown'}` }, requestId);
    }
    if (!apiRes.ok) {
      clearTimeout(timeout);
      const errBody = await apiRes.text().catch(() => 'Unknown');
      const errorKind = apiRes.status === 402 ? 'quota' : apiRes.status === 401 ? 'auth' : apiRes.status === 429 ? 'rate_limit' : 'upstream';
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (apiRes.status === 402) return jsonWithRequestId(req, res, 402, { error: 'Credito DeepSeek esaurito' }, requestId);
      if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API DeepSeek non valida' }, requestId);
      if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste. Attendi e riprova.' }, requestId);
      return jsonWithRequestId(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
    }
    const contentType = apiRes.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      clearTimeout(timeout);
      const data = await apiRes.json();
      return json(req, res, 200, { ...data, requestId });
    }
    addCorsHeaders(req, res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Request-Id', requestId);
    const reader = apiRes.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_body' });
      return res.end();
    }
    logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'ok' });
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } catch (err) {
      console.error('[Stream] Errore durante lo streaming', { msg: (err as Error)?.message, requestId });
      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      clearTimeout(timeout);
    }
    return res.end();
  }

  // Spec 13: Onboarding AI suggest (rate-limit 5/min/IP, opt-in).
  if (path === '/ai/onboarding-suggest' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiOnboarding', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return json(req, res, 429, { error: 'Troppe richieste onboarding. Attendi un minuto.' });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return json(req, res, 503, { error: 'Onboarding AI non configurato (DEEPSEEK_API_KEY mancante)' });
    }
    const v = validate(
      z.object({
        name: z.string().max(50),
        sector: z.string().optional(),
        model: z.string().optional(),
        userEmail: z.string().email().optional(),
      }),
      body,
    );
    if (v.error) return json(req, res, 400, { error: 'Invalid body', details: v.errors });
    if (v.data.userEmail) {
      console.info('[ai_onboarding_suggest] user', { email: v.data.userEmail, ts: Date.now() });
    }
    // Placeholder: the production caller uses the client-side
    // useAIOnboarding hook (DeepSeek via /api/ai/chat proxy). This
    // endpoint exists for parity with /ai/logo-config and future
    // server-side onboarding flows (e.g. registration funnel). The
    // contract (Zod, rate-limit, 503 fallback) is in place and tested.
    return json(req, res, 202, {
      data: { status: 'queued' },
      message: 'Onboarding AI endpoint is staged; client-side useAIOnboarding is the v1 path.',
    });
  }

  // Spec 11: Logo AI v2 — config (no rate-limit) + generate (rate-limit aiLogo 10/min/IP).
  if (path === '/ai/logo-config' && method === 'GET') {
    const geminiKey = !!process.env.GEMINI_API_KEY || !!process.env.VITE_GEMINI_API_KEY;
    const enabled = !!process.env.REPLICATE_API_TOKEN || geminiKey;
    const provider = geminiKey ? 'gemini' : process.env.REPLICATE_API_TOKEN ? 'replicate' : 'none';
    return json(req, res, 200, { enabled, provider });
  }

  if (path === '/ai/card-cover' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiCardCover', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni di cover. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_card_cover', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Cover AI non configurata (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        context: z.string().max(2000).optional(),
        cardImage: z.string().max(600_000).optional(),
        logoImage: z.string().max(150_000).optional(),
        side: z.enum(['front', 'back']).optional(),
        userEmail: z.string().email().optional(),
        // TB-023: modello immagine Gemini selezionabile
        imageModel: z.enum(['gemini-3.1-flash-image', 'gemini-2.0-flash-preview-image-generation']).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_card_cover', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const startedAt = Date.now();
    try {
      // Dynamic import of @google/genai (node_modules, always bundled).
      // Avoids the ESM/CJS interop issue with static import and the
      // "Cannot find module src/..." issue with importing from src/.
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const basePrompt = v.data.context
        ? `${v.data.prompt}\n\nCARD CONTEXT:\n${v.data.context.slice(0, 2000)}`
        : v.data.prompt;
      const hasImages = !!(v.data.cardImage || v.data.logoImage);
      const grounding =
        'The attached image(s) show the business card layout I am designing a background for. Use them as reference for text placement, colour harmony, and profession. Do NOT reproduce any text, QR code, logo, face, or UI element visible in the reference — generate only the abstract background. If a background is already visible in the reference image, treat it as the previous iteration to improve upon, not as a constraint to copy.';
      const finalPrompt = hasImages ? `${grounding}\n\n${basePrompt}` : basePrompt;
      const extractMime = (dataUrl: string, fallback: string) => {
        const match = dataUrl.match(/^data:([^;]+);base64,/);
        return match ? match[1] : fallback;
      };

      const input = buildGeminiMultimodalInput(finalPrompt, [
        v.data.cardImage ? { data: v.data.cardImage, mimeType: extractMime(v.data.cardImage, 'image/jpeg') } : null,
        v.data.logoImage ? { data: v.data.logoImage, mimeType: extractMime(v.data.logoImage, 'image/jpeg') } : null,
      ]);
      const interaction = await ai.interactions.create(
        {
          model: normalizeGeminiImageModel(v.data.imageModel),
          input,
          generation_config: {
            image_config: { image_size: '512', aspect_ratio: '1:1' },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > 500_000) {
        logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  if (path === '/ai/logo-background' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiLogoBg', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni background. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_logo_background', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Logo AI background non configurato (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        logoImage: z.string().max(600_000).optional(),
        previousBackground: z.string().max(300_000).optional(),
        userEmail: z.string().email().optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_logo_background', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const startedAt = Date.now();
    try {
      // Dynamic import of @google/genai (node_modules, always bundled).
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const hasImages = !!(v.data.logoImage || v.data.previousBackground);
      const grounding =
        'The first attached image shows the logo layout I am designing a background for (title, tagline, icon). Use it as reference for text placement and colour harmony. Do NOT reproduce any text, icon, or shape visible in the reference — generate only the abstract decorative background that sits behind it. The second attached image (if present) is the previous background iteration to improve upon, not a constraint to copy.';
      const finalPrompt = hasImages ? `${grounding}\n\n${v.data.prompt}` : v.data.prompt;
      const extractMime = (dataUrl: string, fallback: string) => {
        const match = dataUrl.match(/^data:([^;]+);base64,/);
        return match ? match[1] : fallback;
      };

      const input = buildGeminiMultimodalInput(finalPrompt, [
        v.data.logoImage ? { data: v.data.logoImage, mimeType: extractMime(v.data.logoImage, 'image/jpeg') } : null,
        v.data.previousBackground ? { data: v.data.previousBackground, mimeType: extractMime(v.data.previousBackground, 'image/jpeg') } : null,
      ]);
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-3.1-flash-image',
          input,
          generation_config: {
            image_config: { image_size: '512', aspect_ratio: '16:9' },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > 500_000) {
        logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  if (path === '/ai/flyer-hero' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiFlyerHero', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni hero. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_flyer_hero', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Hero AI non configurata (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1500),
        context: z.string().max(1500).optional(),
        flyerImage: z.string().max(600_000).optional(),
        aspectRatio: z.enum(['16:9', '1:1', '3:2', '2:3', '3:4']).optional(),
        userEmail: z.string().email().optional(),
        // TB-023: modello immagine Gemini selezionabile
        imageModel: z.enum(['gemini-3.1-flash-image', 'gemini-2.0-flash-preview-image-generation']).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_flyer_hero', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const startedAt = Date.now();
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const basePrompt = v.data.context
        ? `${v.data.prompt}\n\nFLYER CONTEXT:\n${v.data.context.slice(0, 1500)}`
        : v.data.prompt;
      const hasImages = !!v.data.flyerImage;
      const grounding =
        'The attached image shows the flyer layout I am designing a hero image for. Use it as reference for the hero box position, the copy placement, and the overall visual style. Generate only the hero image that fits the hero box area; do NOT reproduce any text, QR code, logo, or UI element visible in the reference.';
      const finalPrompt = hasImages ? `${grounding}\n\n${basePrompt}` : basePrompt;
      const input = buildGeminiMultimodalInput(finalPrompt, [
        v.data.flyerImage ? { data: v.data.flyerImage, mimeType: 'image/jpeg' } : null,
      ]);
      const interaction = await ai.interactions.create(
        {
          model: normalizeGeminiImageModel(v.data.imageModel),
          input,
          generation_config: {
            image_config: { image_size: '512', aspect_ratio: v.data.aspectRatio ?? '3:2' },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > 500_000) {
        logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // Profession-style photo for business card portrait slot (replaces photoUrl).
  // Same Gemini stack as card-cover / flyer-hero; all logic stays in this monolith.
  if (path === '/ai/card-photo' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiCardPhoto', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni foto. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_card_photo', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Foto AI non configurata (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        context: z.string().max(1500).optional(),
        userEmail: z.string().email().optional(),
        // TB-023: modello immagine Gemini selezionabile
        imageModel: z.enum(['gemini-3.1-flash-image', 'gemini-2.0-flash-preview-image-generation']).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_card_photo', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const startedAt = Date.now();
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const finalPrompt = v.data.context
        ? `${v.data.prompt}\n\nCARD PHOTO CONTEXT:\n${v.data.context.slice(0, 1500)}`
        : v.data.prompt;
      const interaction = await ai.interactions.create(
        {
          model: normalizeGeminiImageModel(v.data.imageModel),
          input: finalPrompt,
          generation_config: {
            image_config: { image_size: '512', aspect_ratio: '3:4' },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > 500_000) {
        logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // TB-023: Gemini 2.0 Flash image generation — icone stilizzate ed
  // hero illustrations per card+flyer. Modello economico (~$0.02/img)
  // alternativo a Nano Banana 3.1. Stesso pattern degli altri endpoint
  // Gemini (dynamic import, 500KB clamp, rate limit 10/min).
  if (path === '/ai/image-flash' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiImageFlash', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_image_flash', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Gemini Flash non configurato (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        aspectRatio: z.enum(['1:1', '16:9', '3:1']).optional(),
        size: z.enum(['512', '1K']).optional(),
        kind: z.enum(['icon', 'hero', 'custom']).optional(),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        style: z.string().max(50).optional(),
        imageModel: z.string().max(80).optional(),
        background: z.enum(['white', 'card', 'accent']).optional(),
        userEmail: z.string().email().optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_image_flash', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const startedAt = Date.now();
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const kind = v.data.kind || 'custom';
      const aspectRatio = v.data.aspectRatio || (kind === 'hero' ? '16:9' : '1:1');
      const size = v.data.size || '512';
      // TB-023: sfondo icona configurabile. Gemini non produce alpha reale,
      // quindi "white" è il default prevedibile (l'icona viene poi mostrata
      // su card chiare). 'card'/'accent' usano i colori brand come tinta piena.
      const bg = v.data.background || 'white';
      const bgPrompt =
        bg === 'card' && v.data.primaryColor
          ? `Solid flat background color ${v.data.primaryColor}, icon in ${v.data.secondaryColor || '#FFFFFF'}.`
          : bg === 'accent' && v.data.primaryColor
            ? `Solid flat background color ${v.data.primaryColor}.`
            : 'Isolated on a plain solid white background (#FFFFFF). DO NOT draw a checkerboard or transparency grid. MUST use a solid #FFFFFF white background.';
      // Build prompt based on kind
      let finalPrompt = v.data.prompt;
      if (kind === 'icon' && v.data.primaryColor && v.data.secondaryColor) {
        const styleHint = v.data.style || 'minimalist';
        finalPrompt = `Stylized flat vector icon of ${v.data.prompt}. Two colors only: ${v.data.primaryColor} and ${v.data.secondaryColor}. ${bgPrompt} No text, no border, no gradients, no shadows. Simple geometric shapes. Style: ${styleHint}.`;
      } else if (kind === 'hero' && v.data.primaryColor && v.data.secondaryColor) {
        const styleHint = v.data.style || 'minimalist';
        finalPrompt = `Stylized flat hero illustration of ${v.data.prompt}. Two colors only: ${v.data.primaryColor} and ${v.data.secondaryColor}. ${bgPrompt} No text, no border. Simple geometric shapes, editorial style. 16:9 composition. Style: ${styleHint}.`;
      }
      const modelId = normalizeGeminiImageModel(v.data.imageModel);
      const interaction = await ai.interactions.create(
        {
          model: modelId,
          input: finalPrompt,
          generation_config: {
            image_config: { image_size: size, aspect_ratio: aspectRatio },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini Flash non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > 500_000) {
        logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB, provider: 'gemini-flash' });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini Flash non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini Flash error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // TB-023: Design review endpoint — MiniMax M3 (Ollama) analizza uno
  // screenshot della preview card/flyer + JSON e suggerisce 3 miglioramenti.
  // Vision-grounded feedback (REQ-MM-004).
  if (path === '/ai/design-review' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiDesignReview', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste. Attendi un minuto.' }, requestId);
    }
    const ollamaKey = process.env.OLLAMA_API_KEY;
    if (!ollamaKey) {
      logAI({ tag: 'ai_design_review', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Design review non configurato (OLLAMA_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        docType: z.enum(['card', 'flyer']),
        docJson: z.string().max(50_000),
        screenshotBase64: z.string().max(600_000),
        userEmail: z.string().email().optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_design_review', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const startedAt = Date.now();
    try {
      // Strip data URL prefix if present
      const b64 = v.data.screenshotBase64.replace(/^data:[^;]+;base64,/, '');
      const systemPrompt = `Sei un graphic designer AI esperto. Analizza lo screenshot di un ${v.data.docType === 'card' ? 'biglietto da visita' : 'volantino'} e suggerisci 3 miglioramenti concreti. Restituisci SOLO un JSON array di 3 oggetti con shape: {"field": "string (es. style.bgColor, content.headline, decoration.id)", "value": "string (valore suggerito)", "reason": "string (motivazione 1 frase in italiano)"}. Focus su: palette colori, gerarchia visiva, leggibilità, decorazione, allineamento. Evita suggerimenti generici.`;
      const ollamaBody = {
        model: 'minimax-m3:cloud',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analizza questo ${v.data.docType}. JSON attuale:\n${v.data.docJson.slice(0, 8000)}`, images: [b64] },
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0.6 },
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      let apiRes: Response;
      try {
        apiRes = await fetch('https://ollama.com/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ollamaKey}`,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!apiRes.ok) {
        const errBody = await apiRes.text().catch(() => 'unknown');
        const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
        logAI({ tag: 'ai_design_review', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind, provider: 'ollama' });
        if (apiRes.status === 429) {
          return jsonWithRequestId(req, res, 429, { error: 'Quota Ollama Pro superato. Riprova tra qualche ora.' }, requestId);
        }
        return jsonWithRequestId(req, res, apiRes.status, { error: `Ollama (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
      }
      const raw = (await apiRes.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
      const content = raw.message?.content || '';
      const tokens = (raw.prompt_eval_count ?? 0) + (raw.eval_count ?? 0);
      logAI({ tag: 'ai_design_review', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', tokens: tokens || undefined, provider: 'ollama' });
      return json(req, res, 200, { data: { suggestions: content }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('abort') ? 'timeout' : 'upstream';
      logAI({ tag: 'ai_design_review', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind, provider: 'ollama' });
      if (errorKind === 'timeout') return jsonWithRequestId(req, res, 504, { error: 'Ollama non ha risposto entro 60s.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Design review error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // TB-028: Website builder scrape reference — Firecrawl fetch per stile sito esistente.
  if (path === '/ai/scrape' && method === 'GET') {
    const requestId = getRequestId(req);
    const url = typeof req.url === 'string' ? new URL(req.url, 'http://localhost').searchParams.get('url') : null;
    if (!url) return jsonWithRequestId(req, res, 400, { error: 'Parametro url mancante' }, requestId);
    const result = await fetchFirecrawlPage(url);
    if (result.status !== 'ok') return jsonWithRequestId(req, res, 200, { text: '' }, requestId);
    return jsonWithRequestId(req, res, 200, { text: result.markdown || '' }, requestId);
  }

  if (path === '/ai/logo-generate' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiLogo', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return json(req, res, 429, { error: 'Troppe generazioni logo AI. Attendi un minuto.' });
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return json(req, res, 503, { error: 'Logo AI non configurato (REPLICATE_API_TOKEN mancante)' });
    }
    const v = validate(
      z.object({
        brief: z.string().max(500),
        sector: z.string().optional(),
        model: z.string().optional(),
        userEmail: z.string().email().optional(),
      }),
      body,
    );
    if (v.error) return json(req, res, 400, { error: 'Invalid body', details: v.errors });
    if (v.data.userEmail) {
      console.info('[ai_logo_generate] user', { email: v.data.userEmail, ts: Date.now() });
    }
    // For now this proxy is a placeholder: when a Replicate-backed
    // generator lands in v2, the call below will be replaced with the
    // upstream invocation. The endpoint contract (Zod, rate-limit, token
    // guard, 503 fallback) is in place and tested.
    return json(req, res, 202, {
      data: { status: 'queued' },
      message: 'Logo AI v2 backend is staged; Replicate call lands in v2.',
    });
  }

  return json(req, res, 404, { error: 'Endpoint AI non trovato' });
};

// --- TB-027 CRM: customers ---
// Spec: spec-architecture-crm-auto-build.md. Admin-only CRUD + research +
// ai-fill + auto-build pipeline. Ponytail: best-effort research (Places fail
// non blocca), AI fill riusa DeepSeek copy, auto-build crea draft (no gen AI
// di default).

const VALID_CUSTOMER_STATUS = new Set(['new', 'researching', 'researched', 'building', 'done', 'rejected']);
const VALID_CUSTOMER_SOURCES = new Set(['manual', 'intake']);

const CreateCustomerSchema = z.object({
  adminEmail: z.string().email(),
  businessName: z.string().min(1).max(255),
  ownerName: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  activity: z.string().optional(),
  mood: z.string().max(1000).optional(),
  target: z.string().optional(),
  preferredColors: z.string().optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  package: z.string().max(50).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().max(255).optional(),
  googleMapsUrl: z.string().max(500).optional(),
});

const UpdateCustomerSchema = z.object({
  adminEmail: z.string().email(),
  businessName: z.string().min(1).max(255).optional(),
  ownerName: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  activity: z.string().optional(),
  mood: z.string().max(1000).optional(),
  target: z.string().optional(),
  preferredColors: z.string().optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  package: z.string().max(50).optional(),
  status: z.string().max(30).optional(),
  logoUrl: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().max(255).optional(),
  googleMapsUrl: z.string().max(500).optional(),
});

const AutoBuildSchema = z.object({
  adminEmail: z.string().email(),
  autoGenerate: z.boolean().optional(),
});

function isAdminEmail(value: unknown): boolean {
  return typeof value === 'string' && value === ADMIN_EMAIL;
}

function requireAdmin(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>, queryParam = false): boolean {
  const adminEmail = queryParam
    ? (new URL(req.url || '/', 'http://localhost').searchParams.get('adminEmail'))
    : (body.adminEmail as string);
  if (!isAdminEmail(adminEmail)) {
    json(req, res, 403, { error: 'Admin only' });
    return false;
  }
  return true;
}

// ponytail: clamp immagine data URL a 500KB. best-effort, no crash se >.
function clampDataUrl(dataUrl: string, maxBytes = 500 * 1024): string {
  if (dataUrl.length <= maxBytes) return dataUrl;
  return dataUrl.slice(0, maxBytes);
}

// TB-027: costruisce stringa brief contesto per AI dagli dati cliente.
// Passato ai draft come `briefContext` così gli orchestratori AI hanno il contesto.
function buildBriefContextApi(cust: Record<string, unknown>): string {
  const c = cust || {};
  const contacts = (c.contacts || {}) as Record<string, unknown>;
  const webData = (c.webData || {}) as Record<string, unknown>;
  const webJson = (webData.json || {}) as Record<string, unknown>;
  const brandingColors = webData.brandingColors || (webData.branding as Record<string, unknown>)?.colors;
  const parts: string[] = [];
  if (c.businessName) parts.push(`Attività: ${c.businessName}`);
  if (c.ownerName) parts.push(`Referente: ${c.ownerName}`);
  if (c.sector) parts.push(`Settore: ${c.sector}`);
  if (c.activity) parts.push(`Descrizione: ${c.activity}`);
  if (c.mood) parts.push(`Mood: ${c.mood}`);
  if (c.target) parts.push(`Target: ${c.target}`);
  if (brandingColors) parts.push(`Colori sito (USA QUESTI per logo/card/flyer): ${JSON.stringify(brandingColors)}`);
  if (c.preferredColors) parts.push(`Palette preferita cliente (secondaria): ${c.preferredColors}`);
  if (contacts.address) parts.push(`Indirizzo: ${contacts.address}`);
  if (contacts.website) parts.push(`Sito: ${contacts.website}`);
  if (contacts.phone) parts.push(`Telefono: ${contacts.phone}`);
  if (contacts.email) parts.push(`Email: ${contacts.email}`);
  // TB-027f: contesto Firecrawl (webData) per orchestratori AI.
  if (webData.title) parts.push(`Titolo sito: ${webData.title}`);
  if (webData.description) parts.push(`Descrizione sito: ${webData.description}`);
  if (webJson.company_description) parts.push(`Descrizione attività (AI): ${webJson.company_description}`);
  if (Array.isArray(webData.brandingFonts) && webData.brandingFonts.length) {
    parts.push(`Font sito: ${webData.brandingFonts.join(', ')}`);
  }
  if (Array.isArray(webData.links) && webData.links.length) {
    parts.push(`Link sito: ${webData.links.slice(0, 5).join(', ')}`);
  }
  if (typeof webData.markdownPreview === 'string' && webData.markdownPreview) {
    parts.push(`Contenuto sito: ${webData.markdownPreview.slice(0, 300)}`);
  }
  return parts.join('\n');
}

// Estrae il primo blocco {...} da una risposta AI e lo parsa. Null se non valido.
function extractJsonObjectApi(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0]);
    return p && typeof p === 'object' && !Array.isArray(p) ? p as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// TB-027 ai-fill: chiamata DeepSeek server-side (stesso pattern fetch di /ai/chat).
// Null su qualunque fallimento: il chiamante fa fallback alla tabella lookup.
async function callDeepSeekAiFill(prompt: string): Promise<{ fields: Record<string, unknown>; costUsd: number } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'Sei un consulente di branding. Rispondi SOLO con un oggetto JSON valido, senza testo extra.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    const fields = content ? extractJsonObjectApi(content) : null;
    if (!fields) return null;
    // Mirror providerPricing.ts deepseek-v4-flash ($0.14/$0.28 per 1M tok) — inline:
    // src/ non importabile da api/ (gotcha §1 cross-boundary).
    const costUsd = Math.round((((data.usage?.prompt_tokens || 0) * 0.14 + (data.usage?.completion_tokens || 0) * 0.28) / 1_000_000) * 1_000_000) / 1_000_000;
    return { fields, costUsd };
  } catch {
    return null;
  }
}

// TB-027 RAG: chunking semplice per customer knowledge.
function chunkMarkdown(markdown: string, maxLen = 1000): string[] {
  if (!markdown) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < markdown.length) {
    let end = Math.min(start + maxLen, markdown.length);
    if (end < markdown.length) {
      const breakAt = markdown.lastIndexOf('\n\n', end);
      if (breakAt > start) end = breakAt;
    }
    chunks.push(markdown.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

async function saveCustomerKnowledge(customerId: string, chunks: string[], source: string, metadata?: Record<string, unknown>): Promise<number> {
  if (!chunks.length) return 0;
  const db = await getDb();
  let inserted = 0;
  for (const chunk of chunks) {
    await db.insert(customerKnowledgeTable).values({
      customerId,
      chunk,
      source,
      metadata: metadata || {},
    });
    inserted++;
  }
  return inserted;
}

// TB-027 auto-research: Firecrawl website scrape. Best-effort, no crash.
// Requires env FIRECRAWL_API_KEY. SEC-002: key server-side only.
type FirecrawlResult = {
  markdown?: string;
  screenshot?: string | null;
  branding?: { logo?: string; colors?: Record<string, unknown>; fonts?: string[]; images?: string[] };
  images?: string[];
  links?: string[];
  json?: Record<string, unknown>;
  title?: string;
  description?: string;
  status: 'ok' | 'no_key' | 'fail' | 'no_website';
};

const FIRECRAWL_WEBDATA_SCHEMA = {
  type: 'object',
  required: [],
  properties: {
    company_name: { type: 'string' },
    company_description: { type: 'string' },
    emails: { type: 'array', items: { type: 'string' } },
    phones: { type: 'array', items: { type: 'string' } },
    addresses: { type: 'array', items: { type: 'string' } },
    colors: { type: 'array', items: { type: 'string' } },
    fonts: { type: 'array', items: { type: 'string' } },
    social_links: { type: 'array', items: { type: 'string' } },
  },
};

function extractFirecrawlScreenshot(scraped: Record<string, unknown>): string | null {
  const s = scraped.screenshot;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object') {
    const so = s as Record<string, unknown>;
    if (typeof so.url === 'string') return so.url;
    if (typeof so.base64 === 'string') return so.base64;
    if (typeof so.data === 'string') return so.data;
  }
  return null;
}

function extractFirecrawlLinks(scraped: Record<string, unknown>, max = 200): string[] {
  const links = scraped.links;
  if (!Array.isArray(links)) return [];
  return links
    .slice(0, max)
    .map((l): string => {
      if (typeof l === 'string') return l;
      const o = l as Record<string, unknown> | undefined;
      const v = o?.url || o?.href;
      return typeof v === 'string' ? v : String(l);
    })
    .filter(Boolean);
}

function extractFirecrawlJson(scraped: Record<string, unknown>): Record<string, unknown> | undefined {
  const j = scraped.json;
  if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>;
  if (typeof j === 'string') {
    try {
      return JSON.parse(j) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function fetchFirecrawlPage(url?: string): Promise<FirecrawlResult> {
  if (!url) return { status: 'no_website' };
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { status: 'no_key' };
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return { status: 'fail' };
    if (/^(127\.|10\.|192\.168\.|169\.254\.|localhost$)/.test(u.hostname)) return { status: 'fail' };

    const run = async (payload: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      const resp = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
      });
      if (!resp.ok) return null;
      const data = await resp.json() as Record<string, unknown>;
      return (data.data || data) as Record<string, unknown>;
    };

    let scraped = await run({
      url,
      onlyMainContent: true,
      parsers: ['pdf'],
      formats: ['markdown', 'screenshot', 'branding', 'images', { type: 'json', schema: FIRECRAWL_WEBDATA_SCHEMA }, 'links'],
    });
    if (!scraped) {
      scraped = await run({ url, onlyMainContent: true, formats: ['markdown', 'branding', 'screenshot', 'links'] });
    }
    if (!scraped) return { status: 'fail' };

    const metadata = (scraped.metadata || {}) as Record<string, unknown>;
    const markdown = typeof scraped.markdown === 'string' ? scraped.markdown : '';
    const branding = (scraped.branding || {}) as FirecrawlResult['branding'];
    const title = typeof metadata.title === 'string' ? metadata.title : '';
    const description = typeof metadata.description === 'string' ? metadata.description : '';
    const images = Array.isArray(scraped.images)
      ? scraped.images
          .map((i) => (typeof i === 'string' ? i : (i as Record<string, unknown>)?.url || (i as Record<string, unknown>)?.src))
          .filter((i): i is string => typeof i === 'string' && /^https?:\/\//.test(i))
      : [];
    const links = extractFirecrawlLinks(scraped, 200);
    const json = extractFirecrawlJson(scraped);
    const screenshot = extractFirecrawlScreenshot(scraped);
    return { markdown, branding, images, links, json, screenshot, title, description, status: 'ok' };
  } catch (err) {
    console.error('[research] Firecrawl error', (err as Error)?.message);
    return { status: 'fail' };
  }
}

// TB-027+ TB-019 auto: pipeline research condivisa (endpoint admin + intake auto).
// Best-effort: mai lanciare eccezioni — ritorna researchStatus per il caller.
async function runCustomerResearch(cust: any): Promise<{
  researchStatus: Record<string, string>;
  knowledgeCount: number;
  webData: Record<string, unknown>;
}> {
  const contacts = (cust.contacts || {}) as { address?: string; website?: string };
  const website = contacts.website || cust.googleMapsUrl;
  const researchStatus: Record<string, string> = {};
  let knowledgeCount = 0;
  let webData: Record<string, unknown> = {};
  let detectedLogoUrl: string | null = null;
  if (!website) {
    researchStatus.web = 'no_website';
  } else {
    const firecrawl = await fetchFirecrawlPage(website);
    researchStatus.web = firecrawl.status;
    if (firecrawl.status === 'ok') {
      const chunks = chunkMarkdown(firecrawl.markdown || '');
      knowledgeCount = await saveCustomerKnowledge(cust.id, chunks, 'firecrawl:homepage', {
        title: firecrawl.title,
        description: firecrawl.description,
        url: website,
      });
      webData = {
        title: firecrawl.title,
        description: firecrawl.description,
        markdownPreview: (firecrawl.markdown || '').slice(0, 500),
        markdownFull: firecrawl.markdown || '',
        screenshot: firecrawl.screenshot,
        links: firecrawl.links,
        json: firecrawl.json,
        branding: firecrawl.branding,
        brandingColors: firecrawl.branding?.colors,
        brandingFonts: firecrawl.branding?.fonts,
        brandingLogo: firecrawl.branding?.logo,
        images: firecrawl.images,
      };
      detectedLogoUrl = firecrawl.branding?.logo || (typeof firecrawl.json?.logo === 'string' ? firecrawl.json.logo : null) || null;
    }
  }
  if (!detectedLogoUrl) {
    detectedLogoUrl = await detectLogo(contacts.website);
  }
  // Logo manuale (upload admin) vince SEMPRE: status 'manual' e
  // detectedLogoUrl non viene sovrascritto.
  researchStatus.logo = cust.logoUrl ? 'manual' : detectedLogoUrl ? 'ok' : 'no_logo';
  const db = await getDb();
  await db.update(customersTable).set({
    detectedLogoUrl: cust.logoUrl ? cust.detectedLogoUrl : (detectedLogoUrl || cust.detectedLogoUrl),
    researchStatus,
    webData,
    status: 'researched',
    updatedAt: new Date(),
  }).where(eq(customersTable.id, cust.id));
  return { researchStatus, knowledgeCount, webData };
}

// TB-027 logo detection: fetch homepage, estrai favicon/img candidate.
// SEC-003: no SSRF verso IP interni. Best-effort: favicon prima, poi <img> con
// src contenente "logo"/classe "logo" (spec REQ-AR-004).
async function detectLogo(website?: string): Promise<string | null> {
  if (!website) return null;
  try {
    const url = new URL(website);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|localhost$)/.test(host)) return null;
    // Step 1: favicon.ico (semplice, spesso presente)
    const fav = await fetchFavicon(host);
    if (fav) return fav;
    // Step 2: parse homepage HTML, cerca <img> con src/class/id contenente "logo"
    const img = await detectLogoFromHomepage(host, url.pathname || '/');
    if (img) return img;
  } catch {
    return null;
  }
  return null;
}

async function fetchFavicon(host: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://${host}/favicon.ico`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > 0 && buf.byteLength < 200 * 1024) {
      const b64 = Buffer.from(buf).toString('base64');
      return clampDataUrl('data:image/x-icon;base64,' + b64, 200 * 1024);
    }
  } catch {
    return null;
  }
  return null;
}

async function detectLogoFromHomepage(host: string, path: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://${host}${path}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const html = await resp.text();
    // Cerca <img src="..." alt="..."> con src/alt/class/id che match "logo"
    const imgRegex = /<img[^>]+(?:src|alt|class|id)\s*=\s*["']([^"']*logo[^"']*)["'][^>]*>/gi;
    const srcRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i;
    let match = imgRegex.exec(html);
    if (!match) {
      const srcMatch = srcRegex.exec(html);
      if (!srcMatch) return null;
      const src = srcMatch[1];
      if (!/logo/i.test(src)) return null;
      return await fetchLogoImage(host, src);
    }
    // match[1] è il valore di src/alt/class/id contenente "logo". Estrai src reale.
    const fullTag = match[0];
    const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(fullTag);
    if (!srcMatch) return null;
    return await fetchLogoImage(host, srcMatch[1]);
  } catch {
    return null;
  }
}

async function fetchLogoImage(host: string, src: string): Promise<string | null> {
  let imgUrl: string;
  try {
    if (src.startsWith('http')) {
      const u = new URL(src);
      if (/^(127\.|10\.|192\.168\.|169\.254\.|localhost$)/.test(u.hostname)) return null;
      imgUrl = src;
    } else if (src.startsWith('//')) {
      imgUrl = 'https:' + src;
    } else if (src.startsWith('/')) {
      imgUrl = `https://${host}${src}`;
    } else {
      imgUrl = `https://${host}/${src}`;
    }
    const resp = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength >= 200 * 1024) return null;
    const mime = resp.headers.get('content-type') || 'image/png';
    const b64 = Buffer.from(buf).toString('base64');
    return clampDataUrl(`data:${mime};base64,${b64}`, 200 * 1024);
  } catch {
    return null;
  }
}

const handleCustomers: RouteHandler = async (path, method, req, res, body) => {
  // GET /customers?status=&adminEmail= → lista
  if (path === '/customers' && method === 'GET') {
    if (!requireAdmin(req, res, body, true)) return;
    const url = new URL(req.url || '/', 'http://localhost');
    const status = url.searchParams.get('status') || undefined;
    const db = await getDb();
    let q = db.select().from(customersTable);
    if (status && VALID_CUSTOMER_STATUS.has(status)) {
      q = q.where(eq(customersTable.status, status)) as typeof q;
    }
    const rows = await q.orderBy(customersTable.updatedAt);
    return json(req, res, 200, { data: rows });
  }

  // POST /customers → crea manuale
  if (path === '/customers' && method === 'POST') {
    if (!requireAdmin(req, res, body)) return;
    const v = validate(CreateCustomerSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const d = v.data;
    const id = 'cust_' + crypto.randomUUID();
    const [created] = await (await getDb()).insert(customersTable).values({
      id,
      businessName: d.businessName,
      ownerName: d.ownerName || null,
      sector: d.sector || null,
      activity: d.activity || null,
      mood: d.mood || null,
      target: d.target || null,
      preferredColors: d.preferredColors || null,
      contacts: d.contacts || null,
      package: d.package || 'apertura',
      source: 'manual',
      status: 'new',
      notes: d.notes || null,
      assignedTo: d.assignedTo || null,
    }).returning();
    return json(req, res, 201, { data: created });
  }

  // GET /customers/:id
  if (path.startsWith('/customers/') && method === 'GET') {
    if (!requireAdmin(req, res, body, true)) return;
    const id = path.split('/')[2];
    const db = await getDb();
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!cust) return json(req, res, 404, { error: 'Cliente non trovato' });
    const docs = await db.select().from(documentsTable).where(eq(documentsTable.customerId, id));
    return json(req, res, 200, { data: { ...cust, documents: docs } });
  }

  // PATCH /customers/:id
  if (path.startsWith('/customers/') && method === 'PATCH') {
    if (!requireAdmin(req, res, body)) return;
    const id = path.split('/')[2];
    const v = validate(UpdateCustomerSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const d = v.data;
    if (d.status && !VALID_CUSTOMER_STATUS.has(d.status)) {
      return json(req, res, 400, { error: 'Status non valido' });
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ['businessName', 'ownerName', 'sector', 'activity', 'mood', 'target', 'preferredColors', 'contacts', 'package', 'status', 'logoUrl', 'notes', 'assignedTo', 'googleMapsUrl'] as const) {
      if (d[k] !== undefined) patch[k] = d[k];
    }
    const [updated] = await (await getDb()).update(customersTable).set(patch).where(eq(customersTable.id, id)).returning();
    if (!updated) return json(req, res, 404, { error: 'Cliente non trovato' });
    return json(req, res, 200, { data: updated });
  }

  // DELETE /customers/:id → elimina cliente (admin). Scollega documenti
  // (customerId=null) per preservarli, poi delete customer.
  if (path.startsWith('/customers/') && method === 'DELETE') {
    if (!requireAdmin(req, res, body)) return;
    const id = path.split('/')[2];
    if (id.includes('/')) return json(req, res, 400, { error: 'ID non valido' });
    const db = await getDb();
    await db.update(documentsTable).set({ customerId: null }).where(eq(documentsTable.customerId, id));
    const [deleted] = await db.delete(customersTable).where(eq(customersTable.id, id)).returning();
    if (!deleted) return json(req, res, 404, { error: 'Cliente non trovato' });
    return json(req, res, 200, { data: { id, deleted: true } });
  }

  // POST /customers/:id/research → auto-research pipeline (Firecrawl + logo detection)
  if (path.endsWith('/research') && method === 'POST' && path.includes('/customers/')) {
    if (!requireAdmin(req, res, body)) return;
    const id = path.split('/')[2];
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip + ':' + id, 'research', 1, 60 * 60 * 1000);
    if (rl.blocked) return json(req, res, 429, { error: 'Research già lanciata nell\'ultima ora' });
    const db = await getDb();
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!cust) return json(req, res, 404, { error: 'Cliente non trovato' });
    await db.update(customersTable).set({ status: 'researching', updatedAt: new Date() }).where(eq(customersTable.id, id));
    const r = await runCustomerResearch(cust);
    return json(req, res, 200, { data: { id, researchStatus: r.researchStatus, knowledgeCount: r.knowledgeCount, webData: r.webData } });
  }

  // POST /customers/:id/ai-fill → AI riempie campi vuoti
  if (path.endsWith('/ai-fill') && method === 'POST' && path.includes('/customers/')) {
    if (!requireAdmin(req, res, body)) return;
    const id = path.split('/')[2];
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip + ':' + id, 'ai-fill', 5, 60 * 60 * 1000);
    if (rl.blocked) return json(req, res, 429, { error: 'Troppi ai-fill' });
    const db = await getDb();
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!cust) return json(req, res, 404, { error: 'Cliente non trovato' });
    const aiFields: Record<string, unknown> = {};
    const sector = cust.sector || 'generico';
    if (!cust.mood) {
      const moods: Record<string, string> = { ristorante: 'caldo tradizionale', bar: 'moderno vivace', 'b&b': 'minimal accogliente', negozio: 'pulito luminoso' };
      aiFields.mood = moods[sector] || 'moderno';
    }
    if (!cust.target) {
      aiFields.target = 'Clienti locali e turisti interessati al settore ' + sector;
    }
    if (!cust.preferredColors) {
      aiFields.preferredColors = 'palette coerente con settore ' + sector;
    }
    if (!cust.activity) {
      aiFields.activity = 'Attività commerciale nel settore ' + sector + ' a Cagliari.';
    }
    let costUsd = 0;
    const missing = Object.keys(aiFields);
    if (missing.length > 0) {
      // AI reale (DeepSeek) sopra il fallback lookup: i valori AI vincono
      // sui campi che ha effettivamente compilato.
      try {
        const chunks = await db.select().from(customerKnowledgeTable).where(eq(customerKnowledgeTable.customerId, id));
        const firstChunk = (chunks[0]?.chunk as string) || '';
        const prompt = `Compila il profilo brand. Rispondi SOLO con un oggetto JSON con queste chiavi: ${missing.join(', ')}.\n${buildBriefContextApi(cust)}${firstChunk ? `\nContenuto sito web:\n${firstChunk}` : ''}`;
        const aiResult = await callDeepSeekAiFill(prompt);
        if (!aiResult) throw new Error('DeepSeek non disponibile o output non valido');
        for (const k of missing) {
          const v = aiResult.fields[k];
          if (typeof v === 'string' && v.trim()) aiFields[k] = v.trim();
        }
        costUsd = aiResult.costUsd;
        await db.update(customersTable).set({
          mood: (aiFields.mood as string) || cust.mood,
          target: (aiFields.target as string) || cust.target,
          preferredColors: (aiFields.preferredColors as string) || cust.preferredColors,
          activity: (aiFields.activity as string) || cust.activity,
          aiSuggestedFields: aiFields,
          updatedAt: new Date(),
        }).where(eq(customersTable.id, id));
        return json(req, res, 200, { data: { id, aiSuggestedFields: aiFields, costUsd, fromAI: true } });
      } catch (err) {
        console.warn('[ai-fill] AI fallita, fallback tabella lookup:', (err as Error)?.message);
      }
    }
    await db.update(customersTable).set({
      mood: (aiFields.mood as string) || cust.mood,
      target: (aiFields.target as string) || cust.target,
      preferredColors: (aiFields.preferredColors as string) || cust.preferredColors,
      activity: (aiFields.activity as string) || cust.activity,
      aiSuggestedFields: aiFields,
      updatedAt: new Date(),
    }).where(eq(customersTable.id, id));
    return json(req, res, 200, { data: { id, aiSuggestedFields: aiFields, costUsd, fromAI: false } });
  }

  // POST /customers/:id/auto-build → crea draft documenti pre-compilati
  if (path.endsWith('/auto-build') && method === 'POST' && path.includes('/customers/')) {
    if (!requireAdmin(req, res, body)) return;
    const v = validate(AutoBuildSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const autoGenerate = v.data.autoGenerate === true;
    const id = path.split('/')[2];
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip + ':' + id, 'auto-build', 3, 60 * 60 * 1000);
    if (rl.blocked) return json(req, res, 429, { error: 'Troppi auto-build' });
    const db = await getDb();
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!cust) return json(req, res, 404, { error: 'Cliente non trovato' });
    await db.update(customersTable).set({ status: 'building', updatedAt: new Date() }).where(eq(customersTable.id, id));
    const contacts = (cust.contacts || {}) as Record<string, unknown>;
    const created: string[] = [];
    const now = new Date().toISOString();
    const baseFields = {
      customerId: id,
      userEmail: ADMIN_EMAIL,
      status: 'BOZZA',
      documentTheme: 'corporate',
    };
    const photos = Array.isArray(cust.customerPhotos) ? cust.customerPhotos as string[] : [];
    const firstPhoto = photos.length > 0 ? photos[0] : null;
    // Logo: se già caricato/detected → NON creare draft logo
    const detectedLogo = cust.detectedLogoUrl || cust.logoUrl || null;
    const hasManualLogo = !!detectedLogo;
    const autoGeneratePending = autoGenerate ? true : false;
    // Brief context stringa per AI
    const briefContext = buildBriefContextApi(cust);
    // Replace semantics: un rerun sostituisce le BOZZE esistenti degli stessi
    // tipi per questo cliente (i documenti non-BOZZA non vengono toccati).
    const typesToCreate = hasManualLogo ? ['businessCard', 'flyer'] : ['logo', 'businessCard', 'flyer'];
    await db.delete(documentsTable).where(and(
      eq(documentsTable.customerId, id),
      eq(documentsTable.status, 'BOZZA'),
      inArray(documentsTable.documentType, typesToCreate),
    ));
    // Shape allineate a createEmpty*() factories (documentSchemas.ts).
    // logo draft — skip se admin ha già un logo
    if (!hasManualLogo) {
      const logoId = 'logo_' + crypto.randomUUID();
      await db.insert(documentsTable).values({
        ...baseFields,
        id: logoId,
        documentType: 'logo',
        title: `Logo ${cust.businessName}`,
        data: {
          documentType: 'logo',
          id: logoId,
          title: `Logo ${cust.businessName}`,
          source: 'builder',
          builder: {
            primaryText: cust.businessName,
            tagline: cust.activity || '',
            iconType: 'lucide',
            iconGlyph: 'sparkles',
            iconShape: 'circle',
            primaryColor: '#01696F',
            secondaryColor: '#1a1a2e',
            fontFamily: 'Inter',
            layout: 'horizontal',
            icons: [],
            backgroundImage: detectedLogo,
            backgroundColor: null,
            gradientFill: false,
            decorativeElements: [],
            imagePrompt: null,
            textBackdrop: 'none',
            textColorMode: 'auto',
            textOffsetX: 0, textOffsetY: 0, textScale: 1,
            taglineOffsetX: 0, taglineOffsetY: 0,
            textPosition: 'overlay',
          },
          brief: cust.activity || '',
          concepts: [],
          selected: -1,
          edits: { primaryText: cust.businessName, primaryColor: '#01696F', secondaryColor: '#1a1a2e' },
          aiStats: { totalCostUsd: '0', calls: {} },
          autoGeneratePending,
          briefContext,
          createdAt: now, updatedAt: now,
        },
        createdAt: now, updatedAt: now,
      } as Record<string, unknown>);
      created.push(logoId);
    }
    // card draft — front/back/style/grid/decorations nested (createEmptyCard)
    const cardId = 'card_' + crypto.randomUUID();
    await db.insert(documentsTable).values({
      ...baseFields,
      id: cardId,
      documentType: 'businessCard',
      title: `Card ${cust.businessName}`,
      data: {
        documentType: 'businessCard',
        id: cardId,
        title: `Card ${cust.businessName}`,
        front: {
          name: cust.ownerName || '',
          title: cust.sector || '',
          company: cust.businessName,
          photoUrl: firstPhoto,
          logoUrl: detectedLogo,
          coverImageUrl: null,
          logoBackground: 'none',
          layout: 'left',
          useGrid: false,
        },
        back: {
          phone: String(contacts.phone || ''),
          email: String(contacts.email || ''),
          website: String(contacts.website || ''),
          address: String(contacts.address || ''),
          vatNumber: '',
          services: [],
          servicesLabel: 'Servizi',
          socials: [],
          qrPayload: String(contacts.website || ''),
          qrLabel: 'Scansiona per visitare il sito',
          qrSize: 'medium',
          coverImageUrl: null,
          useGrid: false,
        },
        style: {
          sizePreset: 'eu-85x55',
          bgColor: '#FFFFFF',
          textColor: '#1a1a2e',
          accentColor: '#01696F',
          fontFamily: 'Inter',
          borderStyle: 'accent-strip-left',
          fontScale: 1,
        },
        decorations: { pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false },
        grid: {},
        backGrid: {},
        aiStats: { totalCostUsd: '0', calls: {} },
        autoGeneratePending,
        briefContext,
        createdAt: now, updatedAt: now,
      },
      createdAt: now, updatedAt: now,
    } as Record<string, unknown>);
    created.push(cardId);
    // flyer draft — content/style/decorations nested (createEmptyFlyer)
    const flyerId = 'flyer_' + crypto.randomUUID();
    await db.insert(documentsTable).values({
      ...baseFields,
      id: flyerId,
      documentType: 'flyer',
      title: `Flyer ${cust.businessName}`,
      data: {
        documentType: 'flyer',
        id: flyerId,
        title: `Flyer ${cust.businessName}`,
        size: 'A5',
        orientation: 'portrait',
        content: {
          headline: cust.businessName,
          subheadline: cust.mood || '',
          body: cust.activity || '',
          cta: { label: 'Scopri di più', url: String(contacts.website || '') },
          heroImage: firstPhoto,
          qrPayload: '',
          qrLabel: '',
        },
        style: {
          bgColor: '#FFFFFF',
          textColor: '#1a1a2e',
          accentColor: '#01696F',
          layout: 'classic',
          fontFamily: 'Inter',
          fontScale: 1,
        },
        decorations: { pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false },
        sector: cust.sector || 'generico',
        aiStats: { totalCostUsd: '0', calls: {} },
        autoGeneratePending,
        briefContext,
        createdAt: now, updatedAt: now,
      },
      createdAt: now, updatedAt: now,
    } as Record<string, unknown>);
    created.push(flyerId);
    // autoGenerate deferred: AI generation è responsabilità editor (CON-001
    // quality check). Qui creiamo solo draft. ponytail: non lanciamo AI qui,
    // l'admin attiva generazione manualmente nell'editor.
    void autoGenerate;
    await db.update(customersTable).set({ status: 'done', updatedAt: new Date() }).where(eq(customersTable.id, id));
    return json(req, res, 201, { data: { customerId: id, createdDocuments: created } });
  }

  return json(req, res, 404, { error: 'Endpoint customers non trovato' });
};

// --- TB-019 intake: /api/intake (pubblico) + /api/intakes (admin) ---

const IntakeSchema = z.object({
  businessName: z.string().min(1).max(255),
  ownerName: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  activity: z.string().optional(),
  mood: z.string().max(1000).optional(),
  target: z.string().optional(),
  preferredColors: z.string().optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  webAnswers: z.record(z.string(), z.unknown()).optional(),
  package: z.string().max(50).optional(),
  sourceRef: z.string().max(100).optional(),
});

const VALID_INTAKE_STATUS = new Set(['new', 'in_progress', 'done', 'rejected']);

const handleIntakes: RouteHandler = async (path, method, req, res, body) => {
  // POST /intake (pubblico, rate-limitato)
  if (path === '/intake' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'intake', 5, 60 * 60 * 1000);
    if (rl.blocked) {
      console.warn('[intake] RATE-LIMITED (5/h per IP)');
      return json(req, res, 429, { error: 'Troppi brief, riprova tra un\'ora' });
    }
    const v = validate(IntakeSchema, body);
    if (v.error) {
      const schemaErrors = v.errors.map((e: any) => ({ path: e.path?.join('.') || '?', message: e.message })).slice(0, 5);
      console.warn('[intake] REJECTED schema', { errors: schemaErrors, sourceRef: (body as any)?.sourceRef });
      return json(req, res, 400, { error: 'Brief non valido', errors: schemaErrors });
    }
    const d = v.data;
    const sourceRef = d.sourceRef || 'auto_' + crypto.randomUUID();
    const db = await getDb();
    // upsert: se sourceRef esiste → UPDATE, altrimenti INSERT
    const existing = await db.select().from(intakesTable).where(eq(intakesTable.sourceRef, sourceRef));
    const isUpdate = existing.length > 0;
    const intakeId = isUpdate ? existing[0].id : 'intake_' + crypto.randomUUID();
    const intakeFields = {
      businessName: d.businessName,
      ownerName: d.ownerName || null,
      sector: d.sector || null,
      activity: d.activity || null,
      mood: d.mood || null,
      target: d.target || null,
      preferredColors: d.preferredColors || null,
      contacts: d.contacts || null,
      package: d.package || 'apertura',
      sourceRef,
      webAnswers: d.webAnswers || null,
    };
    if (isUpdate) {
      await db.update(intakesTable).set({ ...intakeFields, updatedAt: sql`now()` })
        .where(eq(intakesTable.id, intakeId));
    } else {
      await db.insert(intakesTable).values({
        id: intakeId,
        status: 'new',
        ...intakeFields,
      });
    }
    // TB-027: intake crea/aggiorna il customer — dedup per email (fallback:
    // stesso businessName) → UPDATE invece di duplicato se esiste già.
    const custContacts = (d.contacts || {}) as { email?: string };
    let matched = null;
    if (typeof custContacts.email === 'string' && custContacts.email.trim()) {
      const [byEmail] = await db.select().from(customersTable)
        .where(sql`lower(${customersTable.contacts}->>'email') = ${custContacts.email.trim().toLowerCase()}`);
      if (byEmail) matched = byEmail;
    }
    if (!matched) {
      const [byName] = await db.select().from(customersTable)
        .where(sql`lower(${customersTable.businessName}) = ${d.businessName.trim().toLowerCase()}`);
      if (byName) matched = byName;
    }
    const custFields = {
      businessName: d.businessName,
      ownerName: d.ownerName || null,
      sector: d.sector || null,
      activity: d.activity || null,
      mood: d.mood || null,
      target: d.target || null,
      preferredColors: d.preferredColors || null,
      contacts: d.contacts || null,
      package: d.package || 'apertura',
      webAnswers: d.webAnswers || null,
      intakeId,
      source: 'intake',
    };
    let custId: string;
    if (matched) {
      custId = matched.id;
      await db.update(customersTable).set({
        ...custFields,
        status: 'new',
        updatedAt: sql`now()`,
      }).where(eq(customersTable.id, custId));
    } else {
      custId = 'cust_' + crypto.randomUUID();
      await db.insert(customersTable).values({
        id: custId,
        ...custFields,
        status: 'new',
      });
    }
    // SEC-002: no PII in log
    console.log('[intake] ' + (isUpdate ? 'updated' : 'created'), { id: intakeId, sourceRef, customer: custId, businessName: d.businessName });
    // TB-019+ auto-research: se il cliente ha un sito valido, parte subito
    // (best-effort, non fa fallire il 201; FIRECRAWL_API_KEY opzionale).
    let researchStatus: Record<string, string> | null = null;
    const cts = (d.contacts || {}) as { website?: string };
    if (typeof cts.website === 'string' && /^https?:\/\//.test(cts.website.trim())) {
      try {
        const r = await runCustomerResearch({
          id: custId,
          contacts: d.contacts,
          logoUrl: null,
          detectedLogoUrl: null,
        });
        researchStatus = r.researchStatus;
        console.log('[intake] auto-research', { customer: custId, web: r.researchStatus.web, logo: r.researchStatus.logo });
      } catch (err) {
        console.warn('[intake] auto-research fallita (best-effort):', (err as Error)?.message);
      }
    }
    return json(req, res, isUpdate ? 200 : 201, {
      data: { id: intakeId, status: isUpdate ? existing[0].status : 'new', updated: isUpdate, researchStatus },
    });
  }

  // GET /intakes?status=&adminEmail= (admin)
  if (path === '/intakes' && method === 'GET') {
    if (!requireAdmin(req, res, body, true)) return;
    const url = new URL(req.url || '/', 'http://localhost');
    const status = url.searchParams.get('status') || undefined;
    const db = await getDb();
    let q = db.select().from(intakesTable);
    if (status && VALID_INTAKE_STATUS.has(status)) {
      q = q.where(eq(intakesTable.status, status)) as typeof q;
    }
    const rows = await q.orderBy(intakesTable.createdAt);
    return json(req, res, 200, { data: rows });
  }

  // GET /intakes/:id (admin)
  if (path.startsWith('/intakes/') && method === 'GET') {
    if (!requireAdmin(req, res, body, true)) return;
    const id = path.split('/')[2];
    const [intake] = await (await getDb()).select().from(intakesTable).where(eq(intakesTable.id, id));
    if (!intake) return json(req, res, 404, { error: 'Brief non trovato' });
    return json(req, res, 200, { data: intake });
  }

  // PATCH /intakes/:id (admin)
  if (path.startsWith('/intakes/') && method === 'PATCH') {
    if (!requireAdmin(req, res, body)) return;
    const id = path.split('/')[2];
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const { status, notes, assignedTo } = body as Record<string, unknown>;
    if (typeof status === 'string') {
      if (!VALID_INTAKE_STATUS.has(status)) return json(req, res, 400, { error: 'Status non valido' });
      patch.status = status;
    }
    if (typeof notes === 'string') patch.notes = notes;
    if (typeof assignedTo === 'string') patch.assignedTo = assignedTo;
    const [updated] = await (await getDb()).update(intakesTable).set(patch).where(eq(intakesTable.id, id)).returning();
    if (!updated) return json(req, res, 404, { error: 'Brief non trovato' });
    return json(req, res, 200, { data: updated });
  }

  return json(req, res, 404, { error: 'Endpoint intake non trovato' });
};

const routes: Array<{ prefix: string; handler: RouteHandler }> = [
  { prefix: '/ping', handler: handleHealth },
  { prefix: '/logs', handler: handleHealth },
  { prefix: '/config', handler: handleHealth },
  { prefix: '/users', handler: handleUsers },
  { prefix: '/quotes', handler: handleQuotes },
  { prefix: '/documents', handler: handleDocuments },
  { prefix: '/ai', handler: handleAI },
  { prefix: '/user-settings', handler: handleUserSettings },
  { prefix: '/admin', handler: handleAdmin },
  { prefix: '/customers', handler: handleCustomers },
  { prefix: '/intake', handler: handleIntakes },
  { prefix: '/intakes', handler: handleIntakes },
];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  addCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  const { pathname } = new URL(req.url || '/', 'http://localhost');
  const path = pathname.replace(/^\/api/, '');
  const method = req.method || 'GET';

  let body: Record<string, unknown> = {};
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body as Record<string, unknown>;
    } else if (req.body) {
      body = JSON.parse(req.body as string);
    }
  } catch {
    body = {};
  }

  try {
    for (const { prefix, handler } of routes) {
      if (path === prefix || path.startsWith(prefix + '/')) {
        return await handler(path, method, req, res, body);
      }
    }
    return json(req, res, 404, { error: 'Endpoint non trovato' });
  } catch (err) {
    return errorResponse(req, res, 500, err);
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
