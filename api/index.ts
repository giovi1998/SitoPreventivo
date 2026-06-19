// @ts-nocheck
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, serial, varchar, text, integer, jsonb, timestamp, bigint, boolean } from "drizzle-orm/pg-core";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// ─── DB SCHEMA (inlined for Vercel compatibility) ───
const usersTable = pgTable("users", {
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

const quotesTable = pgTable("quotes", {
  id: varchar({ length: 50 }).primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const userSettingsTable = pgTable("user_settings", {
  userEmail: varchar("user_email", { length: 255 }).primaryKey().references(() => usersTable.email),
  displayName: varchar("display_name", { length: 255 }),
  companyName: varchar("company_name", { length: 255 }),
  defaultColor: varchar("default_color", { length: 50 }),
  defaultVat: integer("default_vat").default(22),
  logoUrl: text("logo_url"),
  onboardingDone: boolean("onboarding_done").default(false),
});

// ─── DB CONNECTION ───────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}
const db = drizzle(connectionString, { schema: { users: usersTable, quotes: quotesTable, userSettings: userSettingsTable } });

// ─── ZOD SCHEMAS ──────────────────────────────
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
    shareToken: z.string().optional(),
    isShared: z.boolean().optional(),
  }),
});

const UserSettingsSchema = z.object({
  email: z.string().email('Email non valida'),
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  defaultColor: z.string().optional(),
  defaultVat: z.number().optional(),
  logoUrl: z.string().optional(),
  onboardingDone: z.boolean().optional(),
});

const TokenLimitSchema = z.object({
  email: z.string().email('Email non valida'),
  tokenLimit: z.number().positive('tokenLimit deve essere positivo'),
});

const TrackTokensSchema = z.object({
  email: z.string().email('Email non valida'),
  tokens: z.number().positive('tokens deve essere positivo'),
});

// ─── HELPERS ───────────────────────────────────
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, status, data) {
  addCorsHeaders(res);
  res.status(status).json(data);
}

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: true, errors: result.error.errors.map(e => e.message) };
  }
  return { error: false, data: result.data };
}

// ─── RATE LIMITING (in-memory) ─────────────────
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const key = `login:${ip}`;
  const record = rateLimitStore.get(key);
  const now = Date.now();
  if (record) {
    if (now - record.firstAttempt < 15 * 60 * 1000) {
      if (record.count >= 5) return { blocked: true };
      return { blocked: false };
    }
    rateLimitStore.delete(key);
  }
  return { blocked: false };
}

function recordLoginAttempt(ip, success) {
  const key = `login:${ip}`;
  if (success) {
    rateLimitStore.delete(key);
  } else {
    const record = rateLimitStore.get(key);
    const now = Date.now();
    if (record && (now - record.firstAttempt < 15 * 60 * 1000)) {
      record.count++;
      rateLimitStore.set(key, record);
    } else {
      rateLimitStore.set(key, { count: 1, firstAttempt: now });
    }
  }
}

export default async function handler(req, res) {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  const path = pathname.replace(/^\/api/, "");
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    addCorsHeaders(res);
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  let body = {};
  try {
    if (req.body && typeof req.body === 'object') body = req.body;
    else if (req.body) body = JSON.parse(req.body);
  } catch {}

  try {
    // ─── HEALTH CHECK ───────────────────────────────
    if (path === "/ping" && method === "GET") {
      return json(res, 200, { ok: true });
    }

    // ─── USERS ─────────────────────────────────────
    if (path === "/users/register" && method === "POST") {
      const v = validate(RegisterSchema, body);
      if (v.error) return json(res, 400, { errors: v.errors });
      const { email, password, username, gender, tokenLimit } = v.data;

      if (email === 'admin@gmail.com') {
        return json(res, 403, { error: "Email non disponibile" });
      }

      const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (existing.length > 0) {
        return json(res, 409, { error: "Email già registrata" });
      }

      const hashed = await bcrypt.hash(password, 12);
      const [created] = await db.insert(usersTable).values({
        email, password: hashed, username, gender,
        role: "user",
        tokenLimit: tokenLimit || 1000000,
      }).returning();
      return json(res, 201, {
        success: true,
        user: {
          email: created.email, username: created.username, gender: created.gender,
          role: created.role, createdAt: created.createdAt,
          tokensUsed: created.tokensUsed, tokenLimit: created.tokenLimit,
        }
      });
    }

    if (path === "/users/login" && method === "POST") {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() || req.headers['client-ip'] || 'unknown';
      const rate = checkRateLimit(ip);
      if (rate.blocked) {
        return json(res, 429, { error: "Troppi tentativi. Riprova tra 15 minuti." });
      }

      const v = validate(LoginSchema, body);
      if (v.error) return json(res, 400, { errors: v.errors });
      const { email, password } = v.data;

      // Admin: validated against env var, not DB
      if (email === 'admin@gmail.com') {
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
          return json(res, 503, { error: "Admin password non configurata. L'amministratore deve impostare ADMIN_PASSWORD su Vercel." });
        }
        if (password !== adminPassword) {
          recordLoginAttempt(ip, false);
          return json(res, 401, { error: "Email o password errati" });
        }
        recordLoginAttempt(ip, true);
        return json(res, 200, {
          success: true,
          user: {
            email: 'admin@gmail.com', username: 'admin', gender: 'male',
            role: 'admin', createdAt: new Date().toISOString(),
            tokensUsed: 0, tokenLimit: 999999999,
          }
        });
      }

      const [found] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (!found || !(await bcrypt.compare(password, found.password))) {
        recordLoginAttempt(ip, false);
        return json(res, 401, { error: "Email o password errati" });
      }

      recordLoginAttempt(ip, true);
      return json(res, 200, {
        success: true,
        user: {
          email: found.email, username: found.username, gender: found.gender,
          role: found.role || 'user',
          createdAt: found.createdAt,
          tokensUsed: found.tokensUsed, tokenLimit: found.tokenLimit,
        }
      });
    }

    if (path === "/users/change-password" && method === "POST") {
      const v = validate(ChangePasswordSchema, body);
      if (v.error) return json(res, 400, { errors: v.errors });
      const { email, oldPassword, newPassword } = v.data;

      const [found] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (!found) return json(res, 404, { error: "Utente non trovato" });
      if (!(await bcrypt.compare(oldPassword, found.password))) {
        return json(res, 401, { error: "Password attuale errata" });
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.email, email));
      return json(res, 200, { success: true });
    }

    if (path === "/users" && method === "GET") {
      const list = await db.select({
        email: usersTable.email, username: usersTable.username, gender: usersTable.gender,
        role: usersTable.role, createdAt: usersTable.createdAt,
        tokensUsed: usersTable.tokensUsed, tokenLimit: usersTable.tokenLimit,
      }).from(usersTable).orderBy(sql`created_at DESC`);
      return json(res, 200, list);
    }

    if (path.startsWith("/users/") && path.endsWith("/profile") && method === "GET") {
      const email = decodeURIComponent(path.replace("/users/", "").replace("/profile", ""));
      const [found] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (!found) return json(res, 404, { error: "Utente non trovato" });
      return json(res, 200, {
        email: found.email, username: found.username, gender: found.gender,
        role: found.role, tokensUsed: found.tokensUsed, tokenLimit: found.tokenLimit,
      });
    }

    if (path === "/users/limits" && method === "PATCH") {
      const v = validate(TokenLimitSchema, body);
      if (v.error) return json(res, 400, { errors: v.errors });
      const { email, tokenLimit } = v.data;
      await db.update(usersTable).set({ tokenLimit }).where(eq(usersTable.email, email));
      return json(res, 200, { success: true });
    }

    if (path === "/users/tokens" && method === "POST") {
      const v = validate(TrackTokensSchema, body);
      if (v.error) return json(res, 400, { errors: v.errors });
      const { email, tokens } = v.data;
      await db.update(usersTable).set({
        tokensUsed: sql`tokens_used + ${tokens}`
      }).where(eq(usersTable.email, email));
      return json(res, 200, { success: true });
    }

    // ─── QUOTES ─────────────────────────────────────
    if (path === "/quotes" && method === "GET") {
      const userEmail = searchParams.get("email");
      if (!userEmail) return json(res, 400, { error: "Email richiesta" });
      const list = await db.select().from(quotesTable).where(eq(quotesTable.userEmail, userEmail)).orderBy(sql`created_at DESC`);
      return json(res, 200, list);
    }

    if (path === "/quotes/all" && method === "GET") {
      const list = await db.select().from(quotesTable).orderBy(sql`created_at DESC`);
      return json(res, 200, list);
    }

    if (path === "/quotes" && method === "POST") {
      const v = validate(QuoteBodySchema, body);
      if (v.error) return json(res, 400, { errors: v.errors });
      const { email, quote } = v.data;

      const existing = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
      if (existing.length > 0) {
        if (existing[0].userEmail !== email) {
          return json(res, 403, { error: "Non autorizzato" });
        }
        const [updated] = await db.update(quotesTable).set({
          title: quote.title, client: quote.client, date: quote.date,
          intro: quote.intro, color: quote.color, vat: quote.vat,
          status: quote.status || "BOZZA", owner: quote.owner,
          options: JSON.stringify(quote.options || []),
          clauses: JSON.stringify(quote.clauses || []),
          isTemplate: quote.isTemplate ?? existing[0].isTemplate ?? false,
          shareToken: quote.shareToken ?? existing[0].shareToken,
          isShared: quote.isShared ?? existing[0].isShared ?? false,
          updatedAt: sql`now()`,
        }).where(eq(quotesTable.id, quote.id)).returning();
        return json(res, 200, updated);
      }

      const [saved] = await db.insert(quotesTable).values({
        id: quote.id, userEmail: email, title: quote.title, client: quote.client,
        date: quote.date, intro: quote.intro, color: quote.color, vat: quote.vat,
        status: quote.status || "BOZZA", owner: quote.owner,
        options: JSON.stringify(quote.options || []),
        clauses: JSON.stringify(quote.clauses || []),
        isTemplate: quote.isTemplate ?? false,
        shareToken: quote.shareToken || null,
        isShared: quote.isShared ?? false,
      }).returning();
      return json(res, 201, saved);
    }

    if (path.startsWith("/quotes/") && method === "DELETE") {
      const quoteId = path.replace("/quotes/", "");
      const email = body.email || searchParams.get("email");
      if (!email) return json(res, 400, { error: "Email richiesta" });

      const [existing] = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
      if (!existing) return json(res, 404, { error: "Preventivo non trovato" });
      if (existing.userEmail !== email) {
        return json(res, 403, { error: "Non autorizzato" });
      }

      await db.delete(quotesTable).where(eq(quotesTable.id, quoteId));
      return json(res, 200, { success: true });
    }

    // ─── DEEPSEEK STATUS CHECK ──────────────────────
    if (path === "/admin/deepseek-status" && method === "GET") {
      const hasKey = !!process.env.DEEPSEEK_API_KEY;
      return json(res, 200, { configured: hasKey });
    }

    // ─── AI CHAT PROXY ──────────────────────────────
    if (path === "/ai/chat" && method === "POST") {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        console.error('[DeepSeek] DEEPSEEK_API_KEY env var not set');
        return json(res, 503, { error: "DeepSeek non configurato. L'amministratore deve impostare DEEPSEEK_API_KEY nelle variabili d'ambiente su Vercel (scope: Production, Preview)." });
      }
      const { model, messages, response_format, temperature } = body;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      let apiRes;
      try {
        apiRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: model || "deepseek-chat",
            messages,
            response_format: response_format || { type: "json_object" },
            temperature: temperature ?? 0.7,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err.name === "AbortError") {
          return json(res, 504, { error: "DeepSeek non ha risposto entro 25 secondi. Riprova." });
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
      if (!apiRes.ok) {
        const errBody = await apiRes.text().catch(() => "Unknown error");
        if (apiRes.status === 402) return json(res, 402, { error: "Credito DeepSeek esaurito. Ricarica su platform.deepseek.com" });
        if (apiRes.status === 401) return json(res, 401, { error: "Chiave API DeepSeek non valida" });
        if (apiRes.status === 429) return json(res, 429, { error: "Troppe richieste a DeepSeek. Attendi qualche secondo e riprova." });
        return json(res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` });
      }
      const data = await apiRes.json();
      return json(res, 200, data);
    }

    // ─── TEMPLATES ──────────────────────────────────
    if (path === "/quotes/templates" && method === "GET") {
      const userEmail = searchParams.get("email");
      if (!userEmail) return json(res, 400, { error: "Email richiesta" });
      const list = await db.select().from(quotesTable)
        .where(and(eq(quotesTable.userEmail, userEmail), eq(quotesTable.isTemplate, true)))
        .orderBy(sql`created_at DESC`);
      return json(res, 200, list);
    }

    // ─── PUBLIC QUOTE (no auth) ─────────────────────
    if (path.startsWith("/quotes/public/") && method === "GET") {
      const token = path.replace("/quotes/public/", "");
      const [found] = await db.select().from(quotesTable).where(eq(quotesTable.shareToken, token));
      if (!found || !found.isShared) {
        return json(res, 404, { error: "Preventivo non trovato o non condiviso" });
      }
      return json(res, 200, {
        id: found.id, title: found.title, client: found.client, date: found.date,
        intro: found.intro, color: found.color, vat: found.vat, status: found.status,
        owner: found.owner, options: found.options, clauses: found.clauses,
      });
    }

    // ─── USER SETTINGS ──────────────────────────────
    if (path === "/user-settings" && method === "GET") {
      const email = searchParams.get("email");
      if (!email) return json(res, 400, { error: "Email richiesta" });
      const [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
      return json(res, 200, settings || { userEmail: email, onboardingDone: false });
    }

    if (path === "/user-settings" && method === "POST") {
      const v = validate(UserSettingsSchema, body);
      if (v.error) return json(res, 400, { errors: v.errors });
      const { email, ...settings } = v.data;
      const existing = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
      if (existing.length > 0) {
        const [updated] = await db.update(userSettingsTable).set({
          ...(settings.displayName !== undefined && { displayName: settings.displayName }),
          ...(settings.companyName !== undefined && { companyName: settings.companyName }),
          ...(settings.defaultColor !== undefined && { defaultColor: settings.defaultColor }),
          ...(settings.defaultVat !== undefined && { defaultVat: settings.defaultVat }),
          ...(settings.logoUrl !== undefined && { logoUrl: settings.logoUrl }),
          ...(settings.onboardingDone !== undefined && { onboardingDone: settings.onboardingDone }),
        }).where(eq(userSettingsTable.userEmail, email)).returning();
        return json(res, 200, updated);
      }
      const [created] = await db.insert(userSettingsTable).values({
        userEmail: email,
        displayName: settings.displayName,
        companyName: settings.companyName,
        defaultColor: settings.defaultColor,
        defaultVat: settings.defaultVat,
        logoUrl: settings.logoUrl,
        onboardingDone: settings.onboardingDone ?? false,
      }).returning();
      return json(res, 201, created);
    }

    return json(res, 404, { error: "Endpoint non trovato" });
  } catch (err) {
    console.error("API error:", err);
    return json(res, 500, { error: err.message });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
