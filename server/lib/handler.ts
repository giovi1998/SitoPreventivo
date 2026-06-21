import type { RouteHandler, VercelRequest, VercelResponse } from './types';
import { addCorsHeaders, errorResponse } from './response';

export function withApiHandler(fn: RouteHandler) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    addCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }
    const { pathname } = new URL(req.url || '/', 'http://localhost');
    const path = pathname.replace(/^\/api/, '');
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
      await fn(path, req.method || 'GET', req, res, body);
    } catch (err) {
      errorResponse(req, res, 500, err);
    }
  };
}
