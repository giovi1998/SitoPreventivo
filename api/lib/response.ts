import type { VercelRequest, VercelResponse } from './types';
import { log } from './logger';

const ADMIN_EMAIL = 'admin@gmail.com';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const IS_PROD = process.env.VERCEL_ENV === 'production';

export { ADMIN_EMAIL };

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

export function errorResponse(req: VercelRequest, res: VercelResponse, status: number, err: unknown): void {
  const errMsg = (err as Error)?.message || String(err);
  const errStack = (err as Error)?.stack;
  log.error(`[API] error`, { status, msg: errMsg, stack: errStack });
  const msg = process.env.VERCEL_ENV === 'development' ? errMsg : 'Errore interno del server';
  json(req, res, status, { error: msg });
}
