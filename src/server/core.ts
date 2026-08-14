// Supporto condiviso: CORS/JSON, rate limit, validate, admin guard, helper immagini.
import crypto from 'node:crypto';
import { z } from 'zod';
import type { VercelRequest, VercelResponse, AILogPayload, GeminiInputPart } from './types.ts';
export const ADMIN_EMAIL = 'admin@gmail.com';
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
export const IS_PROD = process.env.VERCEL_ENV === 'production';

export function getAllowedOrigin(req: VercelRequest): string {
  if (!IS_PROD) return '*';
  if (ALLOWED_ORIGIN) return ALLOWED_ORIGIN;
  const origin = (req.headers['origin'] || req.headers['referer'] || '') as string;
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.vercel.app')) return url.origin;
  } catch {}
  return 'https://precisionquote.vercel.app';
}

export function addCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function json(req: VercelRequest, res: VercelResponse, status: number, data: unknown): void {
  addCorsHeaders(req, res);
  res.status(status).json(data);
}

// Modello immagine Gemini corrente. `gemini-2.0-flash-preview-image-generation`
// è stato ritirato da Google (404 upstream → 502, bug prod 2026-07-30):
// normalizza i pref client stale verso il modello corrente.
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const RETIRED_GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';
export function normalizeGeminiImageModel(id?: string): string {
  return !id || id === RETIRED_GEMINI_IMAGE_MODEL ? GEMINI_IMAGE_MODEL : id;
}
// Nano Banana 2 Lite: solo risoluzione 1K (docs Google). Veloce/economico.
export const GEMINI_LITE_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
export function resolveGeminiImageSize(model: string, requestedSize: string): string {
  return model === GEMINI_LITE_IMAGE_MODEL ? '1K' : requestedSize;
}
// NOTA (probe live 2026-08-07): le interactions API NON accettano nessun
// output control (`image_output_options`/`output_mime_type` → 400 Unknown
// parameter). JPEG è già l'output default di gemini-3.1-flash-image.
// 1K JPEG: ~550-880KB tipici, ma 16:9 (logo-background, flyer-hero 16:9)
// arriva a ~1.05MB per varianza → clamp uniforme 1.2MB (verifica live
// 2026-08-13: 1MB → 413 intermittenti). 2K (2752×1536, ~3.2MB →
// 4.4MB base64) supera il limite risposta Vercel 4.5MB: mai usarlo.
export const GEMINI_IMG_CLAMP_BYTES = 1_200_000;
export function getRequestId(req: VercelRequest): string {
  const header = req.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  if (value) return value;
  return crypto.randomUUID();
}

export function logAI(payload: AILogPayload): void {
  console.info(JSON.stringify({ ...payload, ts: Date.now() }));
}

export function jsonWithRequestId(
  req: VercelRequest,
  res: VercelResponse,
  status: number,
  data: Record<string, unknown>,
  requestId: string
): void {
  json(req, res, status, { ...data, requestId });
}

export function errorResponse(req: VercelRequest, res: VercelResponse, status: number, err: unknown): void {
  const errMsg = (err as Error)?.message || String(err);
  const errStack = (err as Error)?.stack;
  console.error(`[API] error`, { status, msg: errMsg, stack: errStack });
  const msg = process.env.VERCEL_ENV === 'development' ? errMsg : 'Errore interno del server';
  json(req, res, status, { error: msg });
}

export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(bBuf, bBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const xff = req.headers['x-forwarded-for'];
  const ip = (typeof xff === 'string' ? xff : xff?.[0]) || '';
  return ip.split(',')[0]?.trim() || 'unknown';
}
export function buildGeminiMultimodalInput(
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
export const rateLimitStore = new Map<string, { count: number; firstAttempt: number }>();

export function checkRateLimit(
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

export function recordRateAttempt(ip: string, success: boolean, scope: string = 'login'): void {
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
export function consumeRateLimit(
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

export function validate<T>(schema: z.ZodType<T>, data: unknown): { error: true; errors: string[] } | { error: false; data: T } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error?.issues;
    const messages = issues ? issues.map((e: z.ZodIssue) => e.message) : ['Errore di validazione dati'];
    return { error: true, errors: messages };
  }
  return { error: false, data: result.data };
}

export function randomHex(n: number): string {
  const chars = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

export function generateUnlockCode(): string {
  return `PQ-${randomHex(8)}-${randomHex(8)}-${randomHex(8)}`;
}
export function isAdminEmail(value: unknown): boolean {
  return typeof value === 'string' && value === ADMIN_EMAIL;
}

export function requireAdmin(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>, queryParam = false): boolean {
  const adminEmail = queryParam
    ? (new URL(req.url || '/', 'http://localhost').searchParams.get('adminEmail'))
    : (body.adminEmail as string);
  if (!isAdminEmail(adminEmail)) {
    json(req, res, 403, { error: 'Admin only' });
    return false;
  }
  return true;
}

// lean-code: clamp immagine data URL a 500KB. best-effort, no crash se >.
export function clampDataUrl(dataUrl: string, maxBytes = 500 * 1024): string {
  if (dataUrl.length <= maxBytes) return dataUrl;
  return dataUrl.slice(0, maxBytes);
}

// TB-027: costruisce stringa brief contesto per AI dagli dati cliente.
// Passato ai draft come `briefContext` così gli orchestratori AI hanno il contesto.
