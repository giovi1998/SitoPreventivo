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
    delete: vi.fn(() => makeDeleteChain()),
  };
}

function makeDeleteChain() {
  const chain: any = {
    where: vi.fn(function (this: any) { return this; }),
    returning: vi.fn(function (this: any) {
      return mockDbState.nextReturning || [{ id: 'cust_test' }];
    }),
  };
  return chain;
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
      return mockDbState.nextReturning || [{ id: 'cust_test' }];
    }),
  };
  return chain;
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  process.env.GEMINI_API_KEY = 'test';
  process.env.FIRECRAWL_API_KEY = '';
  process.env.REGISTRATION_ENABLED = 'false';
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
  mockDbState.nextReturning = null;
  vi.restoreAllMocks();
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

describe('TB-027 /api/customers', () => {
  it('GET /customers non-admin → 403', async () => {
    const res = await callHandler({ method: 'GET', url: '/api/customers?adminEmail=other@test.com', body: {} });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Admin only');
  });

  it('GET /customers admin → 200 con lista', async () => {
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar XYZ' }]);
    const res = await callHandler({ method: 'GET', url: '/api/customers?adminEmail=admin@gmail.com', body: {} });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].businessName).toBe('Bar XYZ');
  });

  it('POST /customers admin valido → 201', async () => {
    const res = await callHandler({
      method: 'POST', url: '/api/customers', body: { adminEmail: 'admin@gmail.com', businessName: 'Bar Da Mario', sector: 'bar' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.businessName).toBe('Bar Da Mario');
    expect(mockDbState.inserted.length).toBe(1);
  });

  it('POST /customers non-admin → 403', async () => {
    const res = await callHandler({
      method: 'POST', url: '/api/customers', body: { adminEmail: 'x@test.com', businessName: 'X' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /customers body invalido → 400', async () => {
    const res = await callHandler({
      method: 'POST', url: '/api/customers', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /customers/:id/research senza sito → no_website', async () => {
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar', contacts: {}, googleMapsUrl: null }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/research', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.researchStatus.web).toBe('no_website');
  });

  it('POST /customers/:id/research senza FIRECRAWL_API_KEY → web no_key', async () => {
    delete process.env.FIRECRAWL_API_KEY;
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar', contacts: { website: 'https://bar.example.com' } }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/research', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.researchStatus.web).toBe('no_key');
  });

  it('POST /customers/:id/research con sito valido → scrapes with Firecrawl', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc_test';
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar', contacts: { website: 'https://bar.example.com' } }]);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('api.firecrawl.dev/v1/scrape')) {
        return new Response(JSON.stringify({
          data: {
            markdown: 'Bar Da Mario\n\nIl miglior bar di Cagliari. Aperto tutti i giorni.',
            branding: { logo: 'https://bar.example.com/logo.png', colors: { primary: '#01696F' }, fonts: ['Inter'] },
            metadata: { title: 'Bar Da Mario', description: 'Il miglior bar' },
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      // logo detection fallback: favicon.ico not found
      return new Response('not found', { status: 404 });
    });
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/research', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.researchStatus.web).toBe('ok');
    expect(res.body.data.knowledgeCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.webData.markdownPreview).toContain('Bar Da Mario');
    expect(globalThis.fetch).toHaveBeenCalled();
    const firecrawlCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => String(url).includes('api.firecrawl.dev'));
    expect(firecrawlCall?.[0]).toBe('https://api.firecrawl.dev/v1/scrape');
  });

  it('POST /customers/:id/ai-fill popola campi vuoti', async () => {
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar', sector: 'bar', mood: null, target: null, preferredColors: null, activity: null }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/ai-fill', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.aiSuggestedFields.mood).toBe('moderno vivace');
  });

  it('POST /customers/:id/auto-build crea 3 draft (no social v1)', async () => {
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar', sector: 'bar', contacts: {}, customerPhotos: [] }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/auto-build', body: { adminEmail: 'admin@gmail.com', autoGenerate: false },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.createdDocuments.length).toBe(3);
    expect(mockDbState.inserted.length).toBe(3);
  });

  it('POST /customers/:id/auto-build skip logo se detectedLogoUrl presente', async () => {
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar', sector: 'bar', contacts: {}, detectedLogoUrl: 'data:image/x-icon;base64,x' }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/auto-build', body: { adminEmail: 'admin@gmail.com', autoGenerate: false },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.createdDocuments.length).toBe(2);
    expect(mockDbState.inserted.length).toBe(2);
    expect(mockDbState.inserted.find((d: any) => d.documentType === 'logo')).toBeUndefined();
  });

  it('DELETE /customers/:id admin → 200', async () => {
    const res = await callHandler({
      method: 'DELETE', url: '/api/customers/cust_1', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  it('DELETE /customers/:id non-admin → 403', async () => {
    const res = await callHandler({
      method: 'DELETE', url: '/api/customers/cust_1', body: { adminEmail: 'other@test.com' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('TB-027 REGISTRATION_ENABLED flag', () => {
  it('flag false → POST /users/register 403', async () => {
    process.env.REGISTRATION_ENABLED = 'false';
    const res = await callHandler({
      method: 'POST', url: '/api/users/register',
      body: { email: 'new@test.com', password: 'Valid123!Pass!', username: 'New' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Registrazione non disponibile');
  });

  it('flag true → POST /users/register passa validazione (non 403)', async () => {
    process.env.REGISTRATION_ENABLED = 'true';
    mockDbState.selectResults.push([]); // no existing user
    const res = await callHandler({
      method: 'POST', url: '/api/users/register',
      body: { email: 'new@test.com', password: 'Valid123!Pass!', username: 'New' },
    });
    expect(res.statusCode).not.toBe(403);
  });

  it('GET /config restituisce registrationEnabled false', async () => {
    process.env.REGISTRATION_ENABLED = 'false';
    const res = await callHandler({ method: 'GET', url: '/api/config', body: {} });
    expect(res.statusCode).toBe(200);
    expect(res.body.registrationEnabled).toBe(false);
  });

  it('GET /config con REGISTRATION_ENABLED=true → registrationEnabled true', async () => {
    process.env.REGISTRATION_ENABLED = 'true';
    const res = await callHandler({ method: 'GET', url: '/api/config', body: {} });
    expect(res.body.registrationEnabled).toBe(true);
  });
});