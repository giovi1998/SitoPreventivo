// Vercel server entrypoint (docs/functions/runtimes/node-js).
// Unica Vercel Function: riceve TUTTE le richieste (API + statici + SPA).
// Sostituisce il monolite api/index.ts (gotcha §1): la root della funzione
// è la root del progetto, quindi gli import da src/ risolvono.
// In locale: `npm run build && node server.ts` → http://localhost:3000.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './src/server/handler.ts';

const DIST_DIR = fileURLToPath(new URL('./dist', import.meta.url));
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB — limite body Vercel Hobby 4.5MB

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

async function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error('Body troppo grande (max 4MB)') as Error & { statusCode?: number };
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function sendFile(res: import('node:http').ServerResponse, filePath: string, status = 200): void {
  readFile(filePath)
    .then((data) => {
      res.statusCode = status;
      res.setHeader('Content-Type', MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Content-Length', data.length);
      res.end(data);
    })
    .catch(() => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not Found');
    });
}

function serveStaticOrSpa(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  const filePath = normalize(join(DIST_DIR, pathname));
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (existsSync(filePath)) {
    sendFile(res, filePath);
    return;
  }

  // SPA fallback: /app/* e route client → index.html (solo GET)
  if (req.method === 'GET' || req.method === 'HEAD') {
    sendFile(res, join(DIST_DIR, 'index.html'));
    return;
  }
  res.statusCode = 405;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Method Not Allowed');
}

function wrapRes(res: import('node:http').ServerResponse) {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(body: unknown) {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
      return this;
    },
    setHeader: res.setHeader.bind(res),
    write: res.write.bind(res),
    end: res.end.bind(res),
    get writableEnded() {
      return res.writableEnded;
    },
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
    try {
      const body = await readBody(req);
      (req as unknown as { body: unknown }).body = body;
    } catch (err) {
      const status = (err as Error & { statusCode?: number }).statusCode || 500;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: (err as Error).message }));
      return;
    }
    try {
      await handler(req as never, wrapRes(res) as never);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }
  serveStaticOrSpa(req, res);
});

server.listen(Number(process.env.PORT ?? 3000));
