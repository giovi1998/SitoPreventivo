import { eq, and, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  getDb, usersTable, documentsTable, customersTable, intakesTable,
  userSettingsTable, customerKnowledgeTable, unlockCodesTable,
  VALID_PACKAGES, FREE_DOCUMENT_LIMIT, OLLAMA_PRO_FLAT_MONTHLY,
} from './db.ts';
import {
  json, errorResponse, getRequestId, logAI, jsonWithRequestId,
  safeCompare, getClientIp, checkRateLimit, recordRateAttempt,
  consumeRateLimit, validate, randomHex, generateUnlockCode,
  addCorsHeaders, buildGeminiMultimodalInput, normalizeGeminiImageModel,
  requireAdmin, clampDataUrl, ADMIN_EMAIL,
} from './core.ts';
import {
  passwordSchema, RegisterSchema, LoginSchema, ChangePasswordSchema,
  TokenLimitSchema, TrackTokensSchema, RedeemCodeSchema, DocumentCountSchema,
  GenerateCodeSchema, UnlockUserSchema, QuoteBodySchema, qrPayloadDataSchema,
  qrStyleDataSchema, qrDocumentSchema, DocumentBodySchema, UserSettingsSchema,
  CreateCustomerSchema, UpdateCustomerSchema, AutoBuildSchema, IntakeSchema,
  VALID_CUSTOMER_STATUS, VALID_CUSTOMER_SOURCES, VALID_INTAKE_STATUS,
} from './schemas.ts';
import { buildBriefContextApi, callDeepSeekAiFill, runCustomerResearch } from './crm.ts';
import { handleAI } from './ai.ts';
import type { VercelRequest, VercelResponse, RouteHandler } from './types.ts';

export const MAX_LOG_MSG = 2000;
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

export const handleUsers: RouteHandler = async (path, method, req, res, body) => {
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

export const handleAdmin: RouteHandler = async (path, method, req, res, body) => {
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

export const handleQuotes: RouteHandler = async (path, method, req, res, body) => {
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

export const handleDocuments: RouteHandler = async (path, method, req, res, body) => {
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

export const handleUserSettings: RouteHandler = async (path, method, req, res, body) => {
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

export const handleCustomers: RouteHandler = async (path, method, req, res, body) => {
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
    for (const k of ['businessName', 'ownerName', 'sector', 'activity', 'mood', 'target', 'preferredColors', 'contacts', 'package', 'status', 'logoUrl', 'notes', 'assignedTo', 'googleMapsUrl', 'promptLabels'] as const) {
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
    const typesToCreate = hasManualLogo ? ['businessCard', 'flyer', 'website'] : ['logo', 'businessCard', 'flyer', 'website'];
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
    // website draft — brief precompilato dai dati cliente (createEmptyWebsite)
    const websiteId = 'website_' + crypto.randomUUID();
    await db.insert(documentsTable).values({
      ...baseFields,
      id: websiteId,
      documentType: 'website',
      title: `Sito ${cust.businessName}`,
      data: {
        documentType: 'website',
        id: websiteId,
        title: `Sito ${cust.businessName}`,
        brief: {
          businessName: cust.businessName || '',
          sector: String(cust.sector || ''),
          description: String(cust.activity || ''),
          tone: String(cust.mood || ''),
          target: String(cust.target || ''),
          pages: 'index',
          preferredColors: String(cust.preferredColors || ''),
          font: '',
          cta: '',
          sections: 'hero, chi_siamo, contatti',
          features: '',
          contacts: [contacts.address, contacts.phone, contacts.email].filter(Boolean).join(', '),
          socials: [],
          mapsUrl: '',
          notes: '',
        },
        briefContext,
        html: '', css: '', js: '',
        framework: 'vanilla', style: 'modern', pages: ['index'],
        source: 'ai',
        aiStats: { totalCostUsd: '0', calls: {} },
        autoGeneratePending,
        createdAt: now, updatedAt: now,
      },
      createdAt: now, updatedAt: now,
    } as Record<string, unknown>);
    created.push(websiteId);
    // autoGenerate deferred: AI generation è responsabilità editor (CON-001
    // quality check). Qui creiamo solo draft. lean-code: non lanciamo AI qui,
    // l'admin attiva generazione manualmente nell'editor.
    void autoGenerate;
    await db.update(customersTable).set({ status: 'done', updatedAt: new Date() }).where(eq(customersTable.id, id));
    return json(req, res, 201, { data: { customerId: id, createdDocuments: created } });
  }

  return json(req, res, 404, { error: 'Endpoint customers non trovato' });
};

// --- TB-019 intake: /api/intake (pubblico) + /api/intakes (admin) ---

export const handleIntakes: RouteHandler = async (path, method, req, res, body) => {
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

export const routes: Array<{ prefix: string; handler: RouteHandler }> = [
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
