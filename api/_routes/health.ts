import type { RouteHandler } from '../_lib/types';
import { json } from '../_lib/response';
import { log } from '../_lib/logger';
import { checkRateLimit } from '../_lib/rateLimit';
import { getClientIp } from '../_lib/auth';

const MAX_LOG_MSG = 2000;
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

export const handleHealth: RouteHandler = async (path, method, req, res) => {
  if (path === '/ping' && method === 'GET') {
    return json(req, res, 200, { ok: true });
  }

  if (path === '/logs' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, 'logs', 200, 60 * 1000);
    if (rl.blocked) {
      return json(req, res, 429, { error: 'Troppi log' });
    }
    const { level, msg, meta, url, t } = (req.body as Record<string, unknown>) || {};
    if (typeof msg !== 'string' || msg.length > MAX_LOG_MSG) {
      return json(req, res, 400, { error: 'Invalid log payload' });
    }
    const safeLevel = VALID_LEVELS.has(level as string) ? (level as 'info') : 'info';
    log[safeLevel](`[client] ${msg.slice(0, 500)}`, { ...(meta as object), url, clientTs: t });
    return json(req, res, 204, {});
  }

  return json(req, res, 404, { error: 'Endpoint non trovato' });
};
