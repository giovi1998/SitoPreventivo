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

  it('POST /documents with valid businessCard returns 201', async () => {
    // Regression: businessCard was rejected with 400 ("Tipo documento non
    // supportato") because the API only supported qrCode. LogoEditor and
    // CardEditor both rely on this path to persist in production.
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: {
          documentType: 'businessCard',
          id: 'bc-new-1',
          title: 'Mio bigliettino',
          data: { front: { name: 'Mario' }, back: { qrPayload: '' } },
        },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.documentType).toBe('businessCard');
    expect(res.body.id).toBe('bc-new-1');
    expect(res.body.data.front.name).toBe('Mario');
  });

  it('POST /documents with valid logo returns 201', async () => {
    // Regression: logo save failed in production with 400 ("Tipo documento
    // non supportato"). The LogoEditor's "Salva" button called the same
    // /documents endpoint and got a hard error, so logos never persisted.
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: {
          documentType: 'logo',
          id: 'logo-new-1',
          title: 'Logo Acme',
          data: { primaryText: 'Acme', iconName: 'stethoscope' },
        },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.documentType).toBe('logo');
    expect(res.body.id).toBe('logo-new-1');
  });

  it('POST /documents with flyer returns 201 (phase 3)', async () => {
    // Phase 3: flyer is now a first-class document type. Same opaque
    // jsonb storage path as businessCard / logo. Regression guard: the
    // handler no longer rejects 'flyer' (it used to until phase 3
    // landed; see AGENTS.md "Skip fase 3" history).
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: {
          documentType: 'flyer',
          id: 'fl-1',
          title: 'Sagra del paese',
          data: { headline: 'Sagra', layout: 'classic' },
        },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.documentType).toBe('flyer');
    expect(res.body.id).toBe('fl-1');
  });

  it('POST /documents with unknown documentType returns 400 (discriminator guard)', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: { documentType: 'rubbish' as any, id: 'x-1', title: '', data: {} },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /documents for businessCard UPDATE returns 200 with new data', async () => {
    // First save: 201
    mockDbState.selectResults = [[]]; // no existing
    const create = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: { documentType: 'businessCard', id: 'bc-up', title: 'v1', data: { front: { name: 'Mario' } } },
      },
    });
    expect(create.statusCode).toBe(201);
    // Second save (update): the existing row belongs to the same user, so 200
    mockDbState.selectResults = [[{ id: 'bc-up', userEmail: 'user@test.com' }]];
    // Mock the .returning() chain to surface the updated row with new title
    mockDbState.nextReturning = [{ id: 'bc-up', userEmail: 'user@test.com', documentType: 'businessCard', title: 'v2', data: { front: { name: 'Luigi' } } }];
    const update = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        document: { documentType: 'businessCard', id: 'bc-up', title: 'v2', data: { front: { name: 'Luigi' } } },
      },
    });
    expect(update.statusCode).toBe(200);
    expect(update.body.title).toBe('v2');
  });

  it('POST /documents for businessCard with ownership mismatch returns 403', async () => {
    mockDbState.selectResults = [[{ id: 'bc-other', userEmail: 'other@user.com' }]];
    const res = await callHandler({
      method: 'POST',
      url: '/api/documents',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'me@user.com',
        document: { documentType: 'businessCard', id: 'bc-other', title: 'x', data: {} },
      },
    });
    expect(res.statusCode).toBe(403);
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
