import { describe, it, expect, beforeEach, vi } from 'vitest';

const deployState = {
  responses: [] as Array<{ status: number; body: string }>,
  calls: [] as Array<{ path: string; options: any; body: string }>,
  reset() {
    this.responses = [];
    this.calls = [];
  },
};

vi.mock('node:https', () => ({
  default: {
    request: vi.fn((options: any, cb: any) => {
      const next = deployState.responses.shift() ?? { status: 200, body: '' };
      const res = {
        statusCode: next.status,
        on: (ev: string, handler: any) => {
          if (ev === 'data') handler(Buffer.from(next.body));
          if (ev === 'end') handler();
          return res;
        },
      };
      cb(res);
      return {
        on: vi.fn(),
        write: vi.fn((data: any) => {
          deployState.calls.push({ path: options.path, options, body: data });
          return true;
        }),
        end: vi.fn(),
      };
    }),
  },
}));

const mockDbState = {
  selectResults: [] as any[],
  inserted: [] as any[],
  nextReturning: null as any,
};

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(function (this: any) { return this; }),
      where: vi.fn(function (this: any) {
        const result = mockDbState.selectResults.shift() ?? [];
        result.orderBy = function () { return result; };
        return result;
      }),
      orderBy: vi.fn(() => mockDbState.selectResults.shift() ?? []),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(function (this: any, v: any) {
        mockDbState.inserted.push(v);
        this._vals = v;
        return this;
      }),
      returning: vi.fn(function (this: any) {
        return [this._vals || mockDbState.inserted[mockDbState.inserted.length - 1]];
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(function (this: any, s: any) { this._set = s; return this; }),
      where: vi.fn(function (this: any) { return this; }),
      returning: vi.fn(() => mockDbState.nextReturning || [{ id: 'cust_test' }]),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(function (this: any) { return this; }),
      returning: vi.fn(() => [{ id: 'cust_test' }]),
    })),
  })),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { embedContent: vi.fn(async () => ({ embedding: { values: [0, 1] } })) };
  },
}));

const ingestSpy = vi.fn();
vi.mock('../langfuse', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../langfuse')>();
  return { ...mod, ingestLangfuse: ingestSpy };
});

const CUSTOMER = { id: 'cust_1', businessName: 'Panetteria Rossi' };

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  process.env.GEMINI_API_KEY = 'test';
  process.env.FIRECRAWL_API_KEY = '';
  process.env.REGISTRATION_ENABLED = 'false';
  deployState.reset();
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.nextReturning = null;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.NETLIFY_AUTH_TOKEN;
  vi.restoreAllMocks();
  ingestSpy.mockReset();
  vi.resetModules();
});

async function callHandler(req: any) {
  const handler = (await import('../handler')).default;
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
  await handler({ ...req, headers: {} } as any, res as any);
  return { statusCode: res.statusCode, body: res.body };
}

const DEPLOY_OK = { state: 'ready', deploy_url: 'https://preview.quickbrand-demo.netlify.app', url: 'https://quickbrand-demo.netlify.app' };

describe('POST /api/customers/:id/landing-deploy', () => {
  it('non-admin → 403', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/customers/cust_1/landing-deploy',
      body: { adminEmail: 'evil@gmail.com', html: '<h1>x</h1>', fileName: 'sito-test.html' },
    });
    expect(res.statusCode).toBe(403);
    expect(deployState.calls.length).toBe(0);
  });

  it('senza NETLIFY_AUTH_TOKEN → 503, nessuna chiamata API', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/customers/cust_1/landing-deploy',
      body: { adminEmail: 'admin@gmail.com', html: '<h1>x</h1>', fileName: 'sito-test.html' },
    });
    expect(res.statusCode).toBe(503);
    expect(String(res.body.error)).toContain('Netlify');
    expect(deployState.calls.length).toBe(0);
  });

  it('body mancante (html vuoto) → 400', async () => {
    process.env.NETLIFY_AUTH_TOKEN = 'nt-123';
    const res = await callHandler({
      method: 'POST',
      url: '/api/customers/cust_1/landing-deploy',
      body: { adminEmail: 'admin@gmail.com', html: '', fileName: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('cliente non trovato → 404', async () => {
    process.env.NETLIFY_AUTH_TOKEN = 'nt-123';
    mockDbState.selectResults = [[]];
    const res = await callHandler({
      method: 'POST',
      url: '/api/customers/cust_1/landing-deploy',
      body: { adminEmail: 'admin@gmail.com', html: '<h1>x</h1>', fileName: 'sito-test.html' },
    });
    expect(res.statusCode).toBe(404);
    expect(deployState.calls.length).toBe(0);
  });

  it('site non trovato → crea site (POST /sites) → deploy; ritorna deployUrl', async () => {
    process.env.NETLIFY_AUTH_TOKEN = 'nt-123';
    mockDbState.selectResults = [[CUSTOMER]];
    deployState.responses = [
      { status: 404, body: 'not found' },
      { status: 201, body: JSON.stringify({ id: 'site_abc', ssl_url: 'https://quickbrand-demo.netlify.app' }) },
      { status: 200, body: JSON.stringify(DEPLOY_OK) },
    ];
    const res = await callHandler({
      method: 'POST',
      url: '/api/customers/cust_1/landing-deploy',
      body: { adminEmail: 'admin@gmail.com', html: '<h1>Ciao</h1>', fileName: 'sito-test.html' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.deployUrl).toBe('https://preview.quickbrand-demo.netlify.app');
    expect(res.body.data.siteUrl).toBe('https://quickbrand-demo.netlify.app');
    expect(res.body.data.fileName).toBe('sito-test.html');
    expect(deployState.calls.length).toBe(2);
    expect(deployState.calls[0].path).toBe('/api/v1/sites');
    expect(String(deployState.calls[0].body)).toContain('quickbrand-panetteria-rossi');
    const deployCall = deployState.calls[1];
    expect(deployCall.path).toBe('/api/v1/sites/site_abc/deploys');
    const body = JSON.parse(String(deployCall.body));
    expect(body.files['/index.html']).toBeTruthy();
    expect(typeof body.files['/index.html']).toBe('string');
  });

  it('site esistente → nessun create, deploy diretto', async () => {
    process.env.NETLIFY_AUTH_TOKEN = 'nt-123';
    mockDbState.selectResults = [[CUSTOMER]];
    deployState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-panetteria-rossi' }]) },
      { status: 200, body: JSON.stringify(DEPLOY_OK) },
    ];
    const res = await callHandler({
      method: 'POST',
      url: '/api/customers/cust_1/landing-deploy',
      body: { adminEmail: 'admin@gmail.com', html: '<h1>Ciao</h1>', fileName: 'sito-test.html' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.deployUrl).toBe('https://preview.quickbrand-demo.netlify.app');
    expect(deployState.calls.length).toBe(1);
    expect(deployState.calls[0].path).toBe('/api/v1/sites/site_ex/deploys');
  });

  it('deploy fallisce → 502 con errore Netlify', async () => {
    process.env.NETLIFY_AUTH_TOKEN = 'nt-123';
    mockDbState.selectResults = [[CUSTOMER]];
    deployState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-panetteria-rossi' }]) },
      { status: 422, body: '{"msg":"bad request"}' },
    ];
    const res = await callHandler({
      method: 'POST',
      url: '/api/customers/cust_1/landing-deploy',
      body: { adminEmail: 'admin@gmail.com', html: '<h1>Ciao</h1>', fileName: 'sito-test.html' },
    });
    expect(res.statusCode).toBe(502);
    expect(String(res.body.error)).toContain('422');
  });
});
