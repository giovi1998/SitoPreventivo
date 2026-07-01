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
  try {
    await handler(req, res as any);
  } catch (err: any) {
    throw new Error(`Handler threw: ${err?.message || err}\n${err?.stack}`);
  }
  return res as any;
}

describe('GET /api/users/tier', () => {
  it('admin email → unlocked implicit, documentLimit null', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/users/tier?email=admin%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.tier).toBe('unlocked');
    expect(res.body.data.documentLimit).toBeNull();
  });

  it('free user with no settings → free, count 0, limit 10', async () => {
    mockDbState.selectResults = [[]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/users/tier?email=user%40test.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.tier).toBe('free');
    expect(res.body.data.documentCount).toBe(0);
    expect(res.body.data.documentLimit).toBe(10);
  });

  it('unlocked user → unlocked, limit null', async () => {
    mockDbState.selectResults = [[{ tier: 'unlocked', documentCount: 5 }]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/users/tier?email=user%40test.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.tier).toBe('unlocked');
    expect(res.body.data.documentCount).toBe(5);
    expect(res.body.data.documentLimit).toBeNull();
  });

  it('missing email query param → 400', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/users/tier',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /api/users/document-count', () => {
  it('admin → 200 with no DB call (short-circuit)', async () => {
    const res = await callHandler({
      method: 'PATCH',
      url: '/api/users/document-count',
      headers: { origin: 'http://localhost' },
      body: { email: 'admin@gmail.com', delta: 1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.documentCount).toBe(0);
  });

  it('new user (no settings row) → creates row with count=delta', async () => {
    mockDbState.selectResults = [[]]; // no existing
    const res = await callHandler({
      method: 'PATCH',
      url: '/api/users/document-count',
      headers: { origin: 'http://localhost' },
      body: { email: 'new@test.com', delta: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.documentCount).toBe(3);
    expect(mockDbState.inserted).toHaveLength(1);
    expect(mockDbState.inserted[0].userEmail).toBe('new@test.com');
  });

  it('existing user → increments by delta', async () => {
    mockDbState.selectResults = [[{ documentCount: 2 }]];
    const res = await callHandler({
      method: 'PATCH',
      url: '/api/users/document-count',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', delta: 1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.documentCount).toBe(3);
  });

  it('delta defaults to 1 if omitted', async () => {
    mockDbState.selectResults = [[{ documentCount: 5 }]];
    const res = await callHandler({
      method: 'PATCH',
      url: '/api/users/document-count',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.documentCount).toBe(6);
  });

  it('clamps to 0 if delta is negative (no negative count)', async () => {
    mockDbState.selectResults = [[{ documentCount: 2 }]];
    const res = await callHandler({
      method: 'PATCH',
      url: '/api/users/document-count',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', delta: -10 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.documentCount).toBe(0);
  });

  it('invalid email → 400', async () => {
    const res = await callHandler({
      method: 'PATCH',
      url: '/api/users/document-count',
      headers: { origin: 'http://localhost' },
      body: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });
});
