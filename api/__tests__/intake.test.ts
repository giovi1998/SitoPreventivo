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
  };
}

function makeSelectChain() {
  const chain: any = {
    from: vi.fn(function (this: any) { return this; }),
    where: vi.fn(function (this: any) {
      const result = mockDbState.selectResults.shift() ?? [];
      result.orderBy = function () { return result; };
      return result;
    }),
    orderBy: vi.fn(function (this: any) {
      return mockDbState.selectResults.shift() ?? [];
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
      return [this._vals || mockDbState.inserted[mockDbState.inserted.length - 1]];
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
      return mockDbState.nextReturning || [{ id: 'intake_test' }];
    }),
  };
  return chain;
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  process.env.GEMINI_API_KEY = 'test';
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
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
  await handler({ ...req, headers } as any, res as any);
  return { statusCode: res.statusCode, body: res.body };
}

describe('TB-019 /api/intake', () => {
  it('POST /intake valido → 201', async () => {
    mockDbState.selectResults.push([]); // no existing sourceRef
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: { businessName: 'Bar Da Mario', sector: 'bar', sourceRef: 'row_1' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('new');
    // TB-027: crea anche customer
    expect(mockDbState.inserted.length).toBe(2);
  });

  it('POST /intake con sourceRef duplicato → 409', async () => {
    mockDbState.selectResults.push([{ id: 'intake_old', sourceRef: 'row_1' }]);
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: { businessName: 'Bar', sourceRef: 'row_1' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Brief già ricevuto');
  });

  it('POST /intake body invalido → 400', async () => {
    const res = await callHandler({
      method: 'POST', url: '/api/intake', body: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /intakes non-admin → 403', async () => {
    const res = await callHandler({ method: 'GET', url: '/api/intakes?adminEmail=other@test.com', body: {} });
    expect(res.statusCode).toBe(403);
  });

  it('GET /intakes admin → 200', async () => {
    mockDbState.selectResults.push([{ id: 'intake_1', businessName: 'Bar' }]);
    const res = await callHandler({ method: 'GET', url: '/api/intakes?adminEmail=admin@gmail.com', body: {} });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PATCH /intakes/:id admin valido → 200', async () => {
    const res = await callHandler({
      method: 'PATCH', url: '/api/intakes/intake_1',
      body: { adminEmail: 'admin@gmail.com', status: 'in_progress' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /intakes/:id status invalido → 400', async () => {
    const res = await callHandler({
      method: 'PATCH', url: '/api/intakes/intake_1',
      body: { adminEmail: 'admin@gmail.com', status: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
  });
});