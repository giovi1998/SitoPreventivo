import { eq, and, sql } from 'drizzle-orm';
import { pgTable, serial, varchar, text, integer, jsonb, timestamp, bigint, boolean } from 'drizzle-orm/pg-core';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/neon-http';

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

const connectionString = process.env.DATABASE_URL!;
const db = drizzle(connectionString, { schema: {} as never });

const usersTable = pgTable('users', {
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

const documentsTable = pgTable('documents', {
  id: varchar({ length: 50 }).primaryKey(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
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
});

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

function validate<T>(schema: z.ZodType<T>, data: unknown): { error: true; errors: string[] } | { error: false; data: T } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error?.issues;
    const messages = issues ? issues.map((e: z.ZodIssue) => e.message) : ['Errore di validazione dati'];
    return { error: true, errors: messages };
  }
  return { error: false, data: result.data };
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

const DocumentBodySchema = z.object({
  email: z.string().email('Email non valida'),
  document: z.discriminatedUnion('documentType', [
    qrDocumentSchema,
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
});

const MAX_LOG_MSG = 2000;
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

const handleHealth: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/ping' && method === 'GET') {
    return json(req, res, 200, { ok: true });
  }

  if (path === '/logs' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, 'logs', 200, 60 * 1000);
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
    const v = validate(RegisterSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, password, username, gender, tokenLimit } = v.data;
    if (email === ADMIN_EMAIL) return json(req, res, 403, { error: 'Email non disponibile' });

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) return json(req, res, 409, { error: 'Email già registrata' });

    const hashed = await bcrypt.hash(password, 12);
    const [created] = await db.insert(usersTable).values({
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

    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, email));
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
    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!found) return json(req, res, 404, { error: 'Utente non trovato' });
    if (!(await bcrypt.compare(oldPassword, found.password))) {
      return json(req, res, 401, { error: 'Password attuale errata' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.email, email));
    return json(req, res, 200, { success: true });
  }

  if (path === '/users' && method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const adminEmail = url.searchParams.get('adminEmail');
    if (adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const list = await db.select({
      email: usersTable.email, username: usersTable.username, gender: usersTable.gender,
      role: usersTable.role, createdAt: usersTable.createdAt,
      tokensUsed: usersTable.tokensUsed, tokenLimit: usersTable.tokenLimit,
    }).from(usersTable).orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  if (path.startsWith('/users/') && path.endsWith('/profile') && method === 'GET') {
    const email = decodeURIComponent(path.replace('/users/', '').replace('/profile', ''));
    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, email));
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
    await db.update(usersTable).set({ tokenLimit }).where(eq(usersTable.email, email));
    return json(req, res, 200, { success: true });
  }

  if (path === '/users/tokens' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, 'tokens', 30, 60 * 1000);
    if (rl.blocked) {
      return json(req, res, 429, { error: 'Troppi aggiornamenti token. Attendi un minuto.' });
    }
    const v = validate(TrackTokensSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, tokens } = v.data;
    if (tokens > 100000) {
      return json(req, res, 400, { error: 'Token count anomalo. Max 100k per richiesta.' });
    }
    await db.update(usersTable).set({
      tokensUsed: sql`tokens_used + ${tokens}`,
    }).where(eq(usersTable.email, email));
    return json(req, res, 200, { success: true });
  }

  return json(req, res, 404, { error: 'Endpoint users non trovato' });
};

const handleQuotes: RouteHandler = async (path, method, req, res, body) => {
  const url = new URL(req.url, 'http://localhost');
  const searchParams = url.searchParams;

  if (path === '/quotes' && method === 'GET') {
    const userEmail = searchParams.get('email');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    const list = await db.select().from(documentsTable).where(eq(documentsTable.userEmail, userEmail)).orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  if (path === '/quotes/all' && method === 'GET') {
    if (searchParams.get('adminEmail') !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const list = await db.select().from(documentsTable).orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  if (path === '/quotes' && method === 'POST') {
    const v = validate(QuoteBodySchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, quote } = v.data;

    const existing = await db.select().from(documentsTable).where(eq(documentsTable.id, quote.id));
    if (existing.length > 0) {
      if (existing[0].userEmail !== email) {
        return json(req, res, 403, { error: 'Non autorizzato' });
      }
      const [updated] = await db.update(documentsTable).set({
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

    const [saved] = await db.insert(documentsTable).values({
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

    const [existing] = await db.select().from(documentsTable).where(eq(documentsTable.id, quoteId));
    if (!existing) return json(req, res, 404, { error: 'Preventivo non trovato' });
    if (existing.userEmail !== email) {
      return json(req, res, 403, { error: 'Non autorizzato' });
    }
    await db.delete(documentsTable).where(eq(documentsTable.id, quoteId));
    return json(req, res, 200, { success: true });
  }

  if (path === '/quotes/templates' && method === 'GET') {
    const userEmail = searchParams.get('email');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    const list = await db.select().from(documentsTable)
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
    const all = await db.select().from(documentsTable)
      .where(eq(documentsTable.userEmail, userEmail))
      .orderBy(sql`updated_at DESC`);
    const filtered = type ? all.filter((d) => d.documentType === type) : all;
    return json(req, res, 200, filtered);
  }

  if (path === '/documents' && method === 'POST') {
    const v = validate(DocumentBodySchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, document } = v.data;

    if (document.documentType === 'qrCode') {
      const qr = document;
      const existing = await db.select().from(documentsTable).where(eq(documentsTable.id, qr.id));
      if (existing.length > 0) {
        if (existing[0].userEmail !== email) {
          return json(req, res, 403, { error: 'Non autorizzato' });
        }
        const [updated] = await db.update(documentsTable).set({
          documentType: 'qrCode',
          title: qr.title,
          data: qr.data as never,
          updatedAt: sql`now()`,
        }).where(eq(documentsTable.id, qr.id)).returning();
        return json(req, res, 200, updated);
      }
      const [saved] = await db.insert(documentsTable).values({
        id: qr.id,
        userEmail: email,
        documentType: 'qrCode',
        title: qr.title,
        data: qr.data as never,
        isTemplate: false,
      }).returning();
      return json(req, res, 201, saved);
    }

    return json(req, res, 400, { error: 'Tipo documento non supportato' });
  }

  if (path.startsWith('/documents/') && method === 'DELETE') {
    const documentId = path.replace('/documents/', '');
    const email = body.email || searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });

    const [existing] = await db.select().from(documentsTable).where(eq(documentsTable.id, documentId));
    if (!existing) return json(req, res, 404, { error: 'Documento non trovato' });
    if (existing.userEmail !== email) {
      return json(req, res, 403, { error: 'Non autorizzato' });
    }
    await db.delete(documentsTable).where(eq(documentsTable.id, documentId));
    return json(req, res, 200, { success: true });
  }

  return json(req, res, 404, { error: 'Endpoint documents non trovato' });
};

const handleUserSettings: RouteHandler = async (path, method, req, res, body) => {
  const url = new URL(req.url, 'http://localhost');
  const searchParams = url.searchParams;

  if (path === '/user-settings' && method === 'GET') {
    const email = searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });
    if (email === ADMIN_EMAIL) {
      return json(req, res, 200, { userEmail: ADMIN_EMAIL, onboardingDone: true });
    }
    const [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    return json(req, res, 200, settings || { userEmail: email, onboardingDone: false });
  }

  if (path === '/user-settings' && method === 'POST') {
    const v = validate(UserSettingsSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, ...settings } = v.data;
    if (email === ADMIN_EMAIL) {
      return json(req, res, 200, { success: true, userEmail: ADMIN_EMAIL, ...settings });
    }
    const existing = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    if (existing.length > 0) {
      const [updated] = await db.update(userSettingsTable).set({
        ...(settings.displayName !== undefined && { displayName: settings.displayName }),
        ...(settings.companyName !== undefined && { companyName: settings.companyName }),
        ...(settings.profession !== undefined && { profession: settings.profession }),
        ...(settings.defaultColor !== undefined && { defaultColor: settings.defaultColor }),
        ...(settings.defaultVat !== undefined && { defaultVat: settings.defaultVat }),
        ...(settings.logoUrl !== undefined && { logoUrl: settings.logoUrl }),
        ...(settings.onboardingDone !== undefined && { onboardingDone: settings.onboardingDone }),
        ...(settings.documentTheme !== undefined && { documentTheme: settings.documentTheme }),
      }).where(eq(userSettingsTable.userEmail, email)).returning();
      return json(req, res, 200, updated);
    }
    const [created] = await db.insert(userSettingsTable).values({
      userEmail: email,
      displayName: settings.displayName,
      companyName: settings.companyName,
      profession: settings.profession,
      defaultColor: settings.defaultColor,
      defaultVat: settings.defaultVat,
      logoUrl: settings.logoUrl,
      documentTheme: settings.documentTheme ?? 'corporate',
      onboardingDone: settings.onboardingDone ?? false,
    }).returning();
    return json(req, res, 201, created);
  }

  return json(req, res, 404, { error: 'Endpoint user-settings non trovato' });
};

const handleAI: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/admin/deepseek-status' && method === 'GET') {
    return json(req, res, 200, { configured: !!process.env.DEEPSEEK_API_KEY });
  }

  if (path === '/ai/chat' && method === 'POST') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('[DeepSeek] DEEPSEEK_API_KEY env var not set', { path });
      return json(req, res, 503, { error: 'DeepSeek non configurato.' });
    }
    const { model, messages, response_format, temperature } = body;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let apiRes: Response;
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages,
          response_format: response_format || { type: 'json_object' },
          temperature: temperature ?? 0.7,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return json(req, res, 504, { error: 'DeepSeek non ha risposto entro 25 secondi. Riprova.' });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => 'Unknown error');
      if (apiRes.status === 402) return json(req, res, 402, { error: 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com' });
      if (apiRes.status === 401) return json(req, res, 401, { error: 'Chiave API DeepSeek non valida' });
      if (apiRes.status === 429) return json(req, res, 429, { error: 'Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.' });
      return json(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` });
    }
    const data = await apiRes.json();
    return json(req, res, 200, data);
  }

  if (path === '/ai/chat/stream' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, 'aistream', 30, 60 * 1000);
    if (rl.blocked) {
      return json(req, res, 429, { error: 'Troppe richieste AI. Attendi un minuto.' });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('[DeepSeek] DEEPSEEK_API_KEY env var not set', { path });
      return json(req, res, 503, { error: 'DeepSeek non configurato.' });
    }
    const { model, messages, tools, temperature, max_tokens } = body as {
      model?: string; messages?: unknown; tools?: unknown; temperature?: number; max_tokens?: number;
    };
    const upBody = {
      model: model || 'deepseek-chat',
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
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return json(req, res, 504, { error: 'DeepSeek non ha risposto entro 60 secondi. Riprova.' });
      }
      console.error('[Stream] Errore di connessione', { msg: (err as Error)?.message });
      return json(req, res, 502, { error: `Connessione fallita: ${(err as Error)?.message || 'unknown'}` });
    }
    if (!apiRes.ok) {
      clearTimeout(timeout);
      const errBody = await apiRes.text().catch(() => 'Unknown');
      if (apiRes.status === 402) return json(req, res, 402, { error: 'Credito DeepSeek esaurito' });
      if (apiRes.status === 401) return json(req, res, 401, { error: 'Chiave API DeepSeek non valida' });
      if (apiRes.status === 429) return json(req, res, 429, { error: 'Troppe richieste. Attendi e riprova.' });
      return json(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` });
    }
    const contentType = apiRes.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      clearTimeout(timeout);
      const data = await apiRes.json();
      return json(req, res, 200, data);
    }
    addCorsHeaders(req, res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const reader = apiRes.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      return res.end();
    }
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } catch (err) {
      console.error('[Stream] Errore durante lo streaming', { msg: (err as Error)?.message });
      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      clearTimeout(timeout);
    }
    return res.end();
  }

  return json(req, res, 404, { error: 'Endpoint AI non trovato' });
};

const routes: Array<{ prefix: string; handler: RouteHandler }> = [
  { prefix: '/ping', handler: handleHealth },
  { prefix: '/logs', handler: handleHealth },
  { prefix: '/users', handler: handleUsers },
  { prefix: '/quotes', handler: handleQuotes },
  { prefix: '/documents', handler: handleDocuments },
  { prefix: '/ai', handler: handleAI },
  { prefix: '/user-settings', handler: handleUserSettings },
  { prefix: '/admin', handler: handleAI },
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
