import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDbState = {
  selectResults: [] as any[],
  inserted: [] as any[],
  updated: [] as any[],
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
    set: vi.fn(function (this: any) { return this; }),
    where: vi.fn(function (this: any) { return this; }),
    returning: vi.fn(function (this: any) { return [{ id: 'x' }]; }),
  };
  return chain;
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
  vi.resetModules();
  // Mock global fetch for the DeepSeek upstream
  global.fetch = vi.fn() as any;
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

function mockDeepSeekOk(content: string) {
  // mockResolvedValue (not Once) so multiple calls in the same test
  // all get the same mocked response.
  (global.fetch as any).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  });
}

function mockDeepSeekStatus(status: number, body = 'error') {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
  });
}

describe('POST /ai/copy-flyer (phase 3)', () => {
  it('returns 200 with parsed JSON when DeepSeek responds OK', async () => {
    mockDeepSeekOk(JSON.stringify({
      headline: 'Sagra',
      subheadline: '15 ago',
      body: 'Ingresso gratis',
      cta: { label: 'Prenota' },
    }));
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: { brief: 'Sagra del paese, 15 agosto, ingresso gratis', tone: 'formale', size: 'A5', layout: 'classic' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.headline).toBe('Sagra');
    expect(res.body.data.cta.label).toBe('Prenota');
    expect(res.body.raw).toContain('Sagra');
  });

  it('returns 400 when brief is missing', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.2' },
      body: { brief: '', tone: 'formale' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when tone is invalid', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.3' },
      body: { brief: 'x', tone: 'silly' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('sanitizes HTML from brief before calling DeepSeek', async () => {
    mockDeepSeekOk(JSON.stringify({ headline: 'X', subheadline: 'S', body: 'B', cta: { label: 'C' } }));
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.4' },
      body: { brief: '<script>alert(1)</script>Sagra della birra', tone: 'giovanile' },
    });
    expect(res.statusCode).toBe(200);
    // Verify the fetch call sanitized the brief
    const fetchArgs = (global.fetch as any).mock.calls[0];
    const sentBody = JSON.parse(fetchArgs[1].body);
    const userMsg = sentBody.messages[1].content;
    expect(userMsg).not.toContain('<script>');
    expect(userMsg).toContain('Sagra della birra');
  });

  it('returns 502 when DeepSeek returns invalid JSON', async () => {
    mockDeepSeekOk('{ headline: "x", subheadline: "y" }'); // single quotes = invalid JSON
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.5' },
      body: { brief: 'x', tone: 'formale' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/JSON/i);
  });

  it('returns 401 when DeepSeek rejects the key', async () => {
    mockDeepSeekStatus(401, 'invalid key');
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.6' },
      body: { brief: 'x', tone: 'formale' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 402 when DeepSeek has no credit', async () => {
    mockDeepSeekStatus(402, 'no credit');
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.7' },
      body: { brief: 'x', tone: 'formale' },
    });
    expect(res.statusCode).toBe(402);
  });

  it('returns 429 after 10 calls in a minute from the same IP (rate limit)', async () => {
    mockDeepSeekOk(JSON.stringify({ headline: 'T', subheadline: 'S', body: 'B', cta: { label: 'C' } }));
    for (let i = 0; i < 10; i++) {
      const r = await callHandler({
        method: 'POST',
        url: '/api/ai/copy-flyer',
        headers: { origin: 'http://localhost', 'x-forwarded-for': '9.9.9.9' },
        body: { brief: 'x', tone: 'formale' },
      });
      expect(r.statusCode).toBe(200);
    }
    const blocked = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '9.9.9.9' },
      body: { brief: 'x', tone: 'formale' },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBeDefined();
  });

  it('rate limit is per-IP (different IP gets full quota)', async () => {
    mockDeepSeekOk(JSON.stringify({ headline: 'T', subheadline: 'S', body: 'B', cta: { label: 'C' } }));
    // Burn the quota for IP A
    for (let i = 0; i < 10; i++) {
      await callHandler({
        method: 'POST',
        url: '/api/ai/copy-flyer',
        headers: { origin: 'http://localhost', 'x-forwarded-for': '9.9.9.10' },
        body: { brief: 'x', tone: 'formale' },
      });
    }
    // IP B can still call
    const r = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '9.9.9.11' },
      body: { brief: 'x', tone: 'formale' },
    });
    expect(r.statusCode).toBe(200);
  });

  it('returns 503 when DEEPSEEK_API_KEY is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const res = await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.10' },
      body: { brief: 'x', tone: 'formale' },
    });
    expect(res.statusCode).toBe(503);
  });

  it('uses response_format: json_object', async () => {
    mockDeepSeekOk(JSON.stringify({ headline: 'T', subheadline: 'S', body: 'B', cta: { label: 'C' } }));
    await callHandler({
      method: 'POST',
      url: '/api/ai/copy-flyer',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.11' },
      body: { brief: 'x', tone: 'formale' },
    });
    const fetchArgs = (global.fetch as any).mock.calls[0];
    const sentBody = JSON.parse(fetchArgs[1].body);
    expect(sentBody.response_format).toEqual({ type: 'json_object' });
  });
});
