import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/routes/users', () => ({
  handleUsers: vi.fn(async (_p, _m, _req, res) => {
    res.statusCode = 200;
    res.end(JSON.stringify({ source: 'users-handler' }));
  }),
}));
vi.mock('../../server/routes/quotes', () => ({
  handleQuotes: vi.fn(async (_p, _m, _req, res) => {
    res.statusCode = 200;
    res.end(JSON.stringify({ source: 'quotes-handler' }));
  }),
}));
vi.mock('../../server/routes/ai', () => ({
  handleAI: vi.fn(async (_p, _m, _req, res) => {
    res.statusCode = 200;
    res.end(JSON.stringify({ source: 'ai-handler' }));
  }),
}));
vi.mock('../../server/routes/userSettings', () => ({
  handleUserSettings: vi.fn(async (_p, _m, _req, res) => {
    res.statusCode = 200;
    res.end(JSON.stringify({ source: 'user-settings-handler' }));
  }),
}));
vi.mock('../../server/routes/health', () => ({
  handleHealth: vi.fn(async (_p, _m, _req, res) => {
    res.statusCode = 200;
    res.end(JSON.stringify({ source: 'health-handler' }));
  }),
}));

import usersHandler from '../users';
import quotesHandler from '../quotes';
import aiHandler from '../ai';
import userSettingsHandler from '../user-settings';
import healthHandler from '../health';
import indexHandler from '../index';
import { handleUsers } from '../../server/routes/users';
import { handleQuotes } from '../../server/routes/quotes';
import { handleAI } from '../../server/routes/ai';
import { handleUserSettings } from '../../server/routes/userSettings';
import { handleHealth } from '../../server/routes/health';

function createMockReqRes(url: string, method: string = 'GET', body?: unknown) {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    setHeader: vi.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    getHeader: vi.fn((k: string) => headers[k]),
    end: vi.fn(),
    json: vi.fn(),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
  };
  const req: any = {
    url,
    method,
    body,
    headers: {},
  };
  return { req, res };
}

describe('Vercel function handlers (withApiHandler wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('api/users delegates to handleUsers with stripped /api prefix', async () => {
    const { req, res } = createMockReqRes('/api/users/123', 'GET');
    await usersHandler(req, res);
    expect(handleUsers).toHaveBeenCalled();
    const call = (handleUsers as any).mock.calls[0];
    expect(call[0]).toBe('/users/123');
    expect(call[1]).toBe('GET');
  });

  it('api/quotes delegates to handleQuotes', async () => {
    const { req, res } = createMockReqRes('/api/quotes', 'POST', { foo: 'bar' });
    await quotesHandler(req, res);
    expect(handleQuotes).toHaveBeenCalled();
    const call = (handleQuotes as any).mock.calls[0];
    expect(call[0]).toBe('/quotes');
    expect(call[1]).toBe('POST');
    expect(call[4]).toEqual({ foo: 'bar' });
  });

  it('api/ai delegates to handleAI', async () => {
    const { req, res } = createMockReqRes('/api/ai/chat/stream', 'POST');
    await aiHandler(req, res);
    expect(handleAI).toHaveBeenCalled();
    const call = (handleAI as any).mock.calls[0];
    expect(call[0]).toBe('/ai/chat/stream');
  });

  it('api/user-settings delegates to handleUserSettings', async () => {
    const { req, res } = createMockReqRes('/api/user-settings/abc', 'PATCH', { theme: 'dark' });
    await userSettingsHandler(req, res);
    expect(handleUserSettings).toHaveBeenCalled();
    const call = (handleUserSettings as any).mock.calls[0];
    expect(call[0]).toBe('/user-settings/abc');
    expect(call[1]).toBe('PATCH');
  });

  it('api/health delegates to handleHealth (handles /ping and /logs)', async () => {
    const { req: r1, res: s1 } = createMockReqRes('/api/ping', 'GET');
    await healthHandler(r1, s1);
    expect(handleHealth).toHaveBeenCalled();
    expect((handleHealth as any).mock.calls[0][0]).toBe('/ping');

    const { req: r2, res: s2 } = createMockReqRes('/api/logs', 'POST');
    await healthHandler(r2, s2);
    expect((handleHealth as any).mock.calls[1][0]).toBe('/logs');
  });

  it('withApiHandler sets CORS headers on every request', async () => {
    const { req, res } = createMockReqRes('/api/users/1', 'GET');
    await usersHandler(req, res);
    expect(res.setHeader).toHaveBeenCalled();
    const setHeaderCalls = (res.setHeader as any).mock.calls.map((c: any[]) => c[0]);
    expect(setHeaderCalls).toContain('Access-Control-Allow-Origin');
  });

  it('withApiHandler short-circuits OPTIONS preflight with 204', async () => {
    const { req, res } = createMockReqRes('/api/users/1', 'OPTIONS');
    await usersHandler(req, res);
    expect(res.statusCode).toBe(204);
    expect(handleUsers).not.toHaveBeenCalled();
  });

  it('withApiHandler catches thrown errors and returns 500', async () => {
    (handleUsers as any).mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    const { req, res } = createMockReqRes('/api/users', 'GET');
    await usersHandler(req, res);
    expect(res.statusCode).toBe(500);
  });

  it('api/index (catch-all) returns 404 for unmatched paths', async () => {
    const { req, res } = createMockReqRes('/api/nonexistent', 'GET');
    await indexHandler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('api/index returns 204 for OPTIONS preflight', async () => {
    const { req, res } = createMockReqRes('/api/nonexistent', 'OPTIONS');
    await indexHandler(req, res);
    expect(res.statusCode).toBe(204);
  });
});
