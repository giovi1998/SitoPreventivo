import type { VercelRequest, VercelResponse } from '../server/lib/types';
import { addCorsHeaders, errorResponse } from '../server/lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  addCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  errorResponse(req, res, 404, 'Endpoint non trovato');
}
