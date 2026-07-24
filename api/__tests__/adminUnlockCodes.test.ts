import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDbState = {
  selectResults: [] as any[],
  inserted: [] as any[],
  updated: [] as any[],
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
    delete: vi.fn(() => ({ where: vi.fn() })),
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
    then(resolve: any) {
      const result = mockDbState.selectResults.shift() ?? [];
      resolve(result);
    },
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
      const result = mockDbState.nextReturning !== null ? mockDbState.nextReturning : [{ id: 'x' }];
      mockDbState.nextReturning = null;
      return result;
    }),
  };
  return chain;
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
  mockDbState.nextReturning = null;
  vi.resetModules();
});

async function callHandler(req: any) {
  const handler = (await import('../index')).default;
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

describe('POST /api/admin/generate-unlock-code', () => {
  it('non-admin email → 403', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/admin/generate-unlock-code',
      headers: { origin: 'http://localhost' },
      body: { adminEmail: 'evil@gmail.com', package: 'starter' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin + valid package → 201 + code matching PQ-XXXX-XXXX-XXXX format', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/admin/generate-unlock-code',
      headers: { origin: 'http://localhost' },
      body: { adminEmail: 'admin@gmail.com', package: 'starter' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.code).toMatch(/^PQ-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
    // INSERT was called with admin's email
    expect(mockDbState.inserted[0].createdBy).toBe('admin@gmail.com');
    expect(mockDbState.inserted[0].package).toBe('starter');
  });

  it('invalid package → 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/admin/generate-unlock-code',
      headers: { origin: 'http://localhost' },
      body: { adminEmail: 'admin@gmail.com', package: 'platinum-fake' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('missing adminEmail → 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/admin/generate-unlock-code',
      headers: { origin: 'http://localhost' },
      body: { package: 'starter' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('two consecutive calls generate distinct codes (sanity)', async () => {
    const r1 = await callHandler({
      method: 'POST',
      url: '/api/admin/generate-unlock-code',
      headers: { origin: 'http://localhost' },
      body: { adminEmail: 'admin@gmail.com', package: 'apertura' },
    });
    const r2 = await callHandler({
      method: 'POST',
      url: '/api/admin/generate-unlock-code',
      headers: { origin: 'http://localhost' },
      body: { adminEmail: 'admin@gmail.com', package: 'presenza' },
    });
    expect(r1.body.data.code).not.toBe(r2.body.data.code);
  });
});

describe('GET /api/admin/unlock-codes', () => {
  it('non-admin → 403', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/admin/unlock-codes?adminEmail=evil%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin → 200 + array of codes', async () => {
    mockDbState.selectResults = [[
      { code: 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC', package: 'starter', usedBy: null, usedAt: null, createdAt: new Date() },
      { code: 'PQ-AAAAAAA2-BBBBBBBB-CCCCCCCC', package: 'apertura', usedBy: 'user@test.com', usedAt: new Date(), createdAt: new Date() },
    ]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/admin/unlock-codes?adminEmail=admin%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].code).toBe('PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC');
    expect(res.body.data[1].usedBy).toBe('user@test.com');
  });

  it('adminEmail query missing → 403 (regression: must use query string, not body)', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/admin/unlock-codes',
      headers: { origin: 'http://localhost' },
      body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(403);
  });
});
