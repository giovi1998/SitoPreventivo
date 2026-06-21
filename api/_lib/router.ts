import type { RouteHandler, VercelRequest, VercelResponse } from './types';
import { json } from './response';
import { handleHealth } from '../_routes/health';
import { handleUsers } from '../_routes/users';
import { handleQuotes } from '../_routes/quotes';
import { handleAI } from '../_routes/ai';
import { handleUserSettings } from '../_routes/userSettings';

export const routes: Array<{ prefix: string; handler: RouteHandler }> = [
  { prefix: '/ping', handler: handleHealth },
  { prefix: '/logs', handler: handleHealth },
  { prefix: '/users', handler: handleUsers },
  { prefix: '/quotes', handler: handleQuotes },
  { prefix: '/ai', handler: handleAI },
  { prefix: '/user-settings', handler: handleUserSettings },
  { prefix: '/admin', handler: handleAI },
];

export async function dispatch(
  path: string,
  method: string,
  req: VercelRequest,
  res: VercelResponse,
  body: Record<string, unknown>
): Promise<void> {
  for (const { prefix, handler } of routes) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      return handler(path, method, req, res, body);
    }
  }
  return json(req, res, 404, { error: 'Endpoint non trovato' });
}
