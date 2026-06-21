import type { VercelRequest, VercelResponse } from './_lib/types';
import { addCorsHeaders, errorResponse } from './_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  addCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  errorResponse(req, res, 404, 'Endpoint non trovato');
}
