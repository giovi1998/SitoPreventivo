import type { RouteHandler } from '../_lib/types';
import { json } from '../_lib/response';
import { db, usersTable } from '../_lib/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { safeCompare, getClientIp } from '../_lib/auth';
import { checkRateLimit, recordRateAttempt } from '../_lib/rateLimit';
import { ADMIN_EMAIL } from '../_lib/response';
import { log } from '../_lib/logger';

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

function validate<T>(schema: z.ZodType<T>, data: unknown): { error: true; errors: string[] } | { error: false; data: T } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error?.issues;
    const messages = issues ? issues.map((e: z.ZodIssue) => e.message) : ['Errore di validazione dati'];
    return { error: true, errors: messages };
  }
  return { error: false, data: result.data };
}

export const handleUsers: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/users/register' && method === 'POST') {
    const v = validate(RegisterSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, password, username, gender, tokenLimit } = v.data;
    if (email === ADMIN_EMAIL) return json(req, res, 403, { error: 'Email non disponibile' });

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) return json(req, res, 409, { error: 'Email gi├á registrata' });

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
    const adminEmail = body.adminEmail;
    if (adminEmail !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: 'Accesso riservato all\'amministratore' });
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
      return json(req, res, 403, { error: 'Accesso riservato all\'amministratore' });
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
