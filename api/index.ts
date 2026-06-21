import type { VercelRequest, VercelResponse } from './lib/types';
import { addCorsHeaders, errorResponse } from './lib/response';
import { dispatch } from './lib/router';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { pathname } = new URL(req.url, 'http://localhost');
  const path = pathname.replace(/^\/api/, '');
  const method = req.method;

  if (method === 'OPTIONS') {
    addCorsHeaders(req, res);
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body as Record<string, unknown>;
    } else if (req.body) {
      body = JSON.parse(req.body as string);
    }
  } catch {}

  try {
    await dispatch(path, method, req, res, body);
  } catch (err) {
    errorResponse(req, res, 500, err);
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
