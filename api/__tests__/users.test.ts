import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDbState = {
  selectResults: [] as any[],
  inserted: [] as any[],
  updated: [] as any[],
  deletedIds: [] as string[],
  nextReturning: null as any,
};

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => makeDb()),
}));

function makeDb() {
  return {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => makeInsertChain()),
    update: vi.fn(() => makeUpdateChain()),
    delete: vi.fn(() => makeDeleteChain()),
  };
}

function makeSelectChain() {
  const chain: any = {
    from: vi.fn(function (this: any) { return this; }),
    where: vi.fn(function (this: any) { return this; }),
    orderBy: vi.fn(function (this: any) {
      const result = mockDbState.selectResults.shift() ?? [];
      return result;
    }),
  };
  return chain;
}

function makeInsertChain() {
  const chain: any = {
    values: vi.fn(function (this: any, v: any) {
      mockDbState.inserted.push(v);
      this._vals = v;
      return this;
    }),
    returning: vi.fn(function (this: any) {
      const v = this._vals || mockDbState.inserted[mockDbState.inserted.length - 1];
      return [v];
    }),
  };
  return chain;
}

function makeUpdateChain() {
  const chain: any = {
    set: vi.fn(function (this: any, s: any) {
      mockDbState.updated.push(s);
      this._set = s;
      return this;
    }),
    where: vi.fn(function (this: any) { return this; }),
    returning: vi.fn(function (this: any) {
      const result = mockDbState.nextReturning || [{ id: 'x' }];
      mockDbState.nextReturning = null;
      return result;
    }),
  };
  return chain;
}

function makeDeleteChain() {
  const chain: any = {
    where: vi.fn(function (this: any) { return this; }),
  };
  return chain;
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
  mockDbState.deletedIds = [];
  mockDbState.nextReturning = null;
  vi.resetModules();
});

async function callHandler(req: any) {
  const handler = (await import('../index')).default;
  const headers: Record<string, string | string[] | undefined> = { ...(req.headers || {}) };
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string | number>,
    body: null as any,
    writableEnded: false,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; this.writableEnded = true; return this; },
    setHeader(name: string, value: string | number) { this.headers[name] = value; return this; },
    write() { return true; },
    end() { this.writableEnded = true; return this; },
  };
  await handler(req, res as any);
  return res as any;
}

describe('GET /api/users (admin list users)', () => {
  it('returns 403 when adminEmail query param is missing (regression: API must use query string, not body)', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/users',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when adminEmail query param is not admin@gmail.com', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/users?adminEmail=evil%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 200 + user list when adminEmail=admin@gmail.com is passed as query string (regression for production bug)', async () => {
    mockDbState.selectResults = [[
      { email: 'admin@gmail.com', username: 'admin', role: 'admin', createdAt: new Date('2025-01-01'), tokensUsed: 0, tokenLimit: 999999999 },
      { email: 'test2@gmail.com', username: 'test2', role: 'user', createdAt: new Date('2025-02-01'), tokensUsed: 100, tokenLimit: 1000000 },
    ]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/users?adminEmail=admin%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[1].email).toBe('test2@gmail.com');
  });

  it('returns 403 when adminEmail is only in body (the broken behavior), guards against regression to body-based auth', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/users',
      headers: { origin: 'http://localhost' },
      body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(403);
  });
});
