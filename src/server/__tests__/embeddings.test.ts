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
      return mockDbState.nextReturning || [{ id: 'x' }];
    }),
  };
  return chain;
}

function makeDeleteChain() {
  const chain: any = {
    where: vi.fn(function (this: any) { return this; }),
    returning: vi.fn(function (this: any) {
      return mockDbState.nextReturning || [{ id: 'x' }];
    }),
  };
  return chain;
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  process.env.GEMINI_API_KEY = '';
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
  mockDbState.nextReturning = null;
  vi.restoreAllMocks();
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
  await handler({ ...req, headers } as any, res as any);
  return { statusCode: res.statusCode, body: res.body };
}

vi.mock('@google/genai', () => {
const embedContent = vi.fn().mockResolvedValue({
  embeddings: [{ values: [0.1, 0.2, 0.3, 0.4] }],
});
  class GoogleGenAI {
    models = { embedContent };
  }
  return { GoogleGenAI, __testEmbedContent: embedContent };
});

describe('POST /api/ai/embeddings', () => {
  it('missing GEMINI_API_KEY → 503', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/embeddings',
      body: { input: 'hello world' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('Gemini non configurato');
  });

  it('valid input → returns embedding array', async () => {
    process.env.GEMINI_API_KEY = 'gemini_test';
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/embeddings',
      body: { input: 'hello world', model: 'gemini-embedding-2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(res.body.data.model).toBe('gemini-embedding-2');
  });

  it('input too long → 400', async () => {
    process.env.GEMINI_API_KEY = 'gemini_test';
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/embeddings',
      body: { input: 'a'.repeat(9000) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});
