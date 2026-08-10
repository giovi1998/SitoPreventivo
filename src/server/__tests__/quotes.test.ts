import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDbState = {
  selectResults: [] as any[],
  inserted: [] as any[],
  updated: [] as any[],
  deletedIds: [] as string[],
  nextReturning: null as any,
};

const dbChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  set: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
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
    where: vi.fn(function (this: any) {
      return this;
    }),
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
  const handler = (await import('../handler')).default;
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

describe('quotes API regression', () => {
  it('GET /quotes returns only quote documents for the user', async () => {
    mockDbState.selectResults = [[
      { id: 'q1', userEmail: 'a@b.com', documentType: 'quote', title: 'Preventivo' },
      { id: 'bc1', userEmail: 'a@b.com', documentType: 'businessCard', title: 'Card' },
      { id: 'qr1', userEmail: 'a@b.com', documentType: 'qrCode', title: 'QR' },
    ]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/quotes?email=a@b.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('q1');
    expect(res.body[0].documentType).toBe('quote');
  });

  it('GET /quotes/all returns only quote documents for admin', async () => {
    mockDbState.selectResults = [[
      { id: 'q1', userEmail: 'a@b.com', documentType: 'quote', title: 'Preventivo' },
      { id: 'logo1', userEmail: 'a@b.com', documentType: 'logo', title: 'Logo' },
    ]];
    const res = await callHandler({
      method: 'GET',
      url: `/api/quotes/all?adminEmail=${encodeURIComponent('admin@gmail.com')}`,
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].documentType).toBe('quote');
  });

  it('GET /quotes without email returns 400', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/quotes',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /quotes/all without admin email returns 403', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/quotes/all',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(403);
  });
});
