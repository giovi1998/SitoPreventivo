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

describe('documents API', () => {
  it('GET /documents without email returns 400', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /documents with email returns array', async () => {
    mockDbState.selectResults = [[{ id: 'q1', documentType: 'quote' }, { id: 'qr1', documentType: 'qrCode' }]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/documents?email=a@b.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /documents?type=qrCode filters to qrCode only', async () => {
    mockDbState.selectResults = [[
      { id: 'q1', documentType: 'quote' },
      { id: 'qr1', documentType: 'qrCode' },
    ]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/documents?email=a@b.com&type=qrCode',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].documentType).toBe('qrCode');
  });

  it('POST /documents with valid QR returns 201', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: {
          documentType: 'qrCode',
          id: 'qr-new-1',
          title: 'Test QR',
          data: { type: 'url', payload: 'https://example.com' },
        },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.documentType).toBe('qrCode');
    expect(res.body.id).toBe('qr-new-1');
  });

  it('POST /documents with missing email returns 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        document: { documentType: 'qrCode', id: 'qr-x', title: '', data: { type: 'url', payload: 'x' } },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /documents with invalid email returns 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'not-an-email',
        document: { documentType: 'qrCode', id: 'qr-x', title: '', data: { type: 'url', payload: 'x' } },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /documents with unsupported document type returns 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: { documentType: 'businessCard' as any, id: 'bc-1', title: '', data: {} as any },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /documents/:id without email returns 400', async () => {
    const res = await callHandler({
      method: 'DELETE',
      url: '/api/documents/qr-1',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
