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

describe('POST /api/users/redeem-code', () => {
  it('admin email → 200 short-circuit, no DB lookup', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'admin@gmail.com', code: 'PQ-XXXXXXXX-YYYYYYYY-ZZZZZZZZ' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.tier).toBe('unlocked');
    // selectResults is empty: admin didn't trigger any lookup
    expect(mockDbState.selectResults).toHaveLength(0);
  });

  it('invalid code (not in unlock_codes) → 404 "Codice non valido"', async () => {
    mockDbState.selectResults = [[]]; // not found
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', code: 'NOPE-1234' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Codice non valido');
  });

  it('already used code → 409 "Codice già utilizzato"', async () => {
    mockDbState.selectResults = [[{ code: 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC', usedBy: 'other@test.com', usedAt: '2026-01-01' }]];
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', code: 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Codice già utilizzato');
  });

  it('valid code, no race condition → 200 unlocked + updates user_settings', async () => {
    // First select: code found
    // Second select: user_settings existing
    mockDbState.selectResults = [
      [{ code: 'PQ-AAAAAAAA-BBBBBBBB-CCCCCCCC', usedBy: null, usedAt: null }],
      [{ userEmail: 'user@test.com', tier: 'free' }],
    ];
    // update().set().where().returning() → returns non-empty
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', code: 'pq-aaaaaaaa-bbbbbbbb-cccccccc' }, // lowercase input
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.tier).toBe('unlocked');
    // update was called to mark code used (1st) and to set user tier (2nd)
    expect(mockDbState.updated.length).toBeGreaterThanOrEqual(1);
    // unlock_code was saved in uppercase
    const tierUpdate = mockDbState.updated.find(u => u.tier === 'unlocked');
    expect(tierUpdate).toBeTruthy();
    expect(tierUpdate.unlockCode).toBe('PQ-AAAAAAAA-BBBBBBBB-CCCCCCCC');
  });

  it('race condition (UPDATE returns empty) → 409', async () => {
    mockDbState.selectResults = [
      [{ code: 'PQ-RACECOND-BBBBBBBB-CCCCCCCC', usedBy: null, usedAt: null }],
    ];
    // claim UPDATE returns 0 rows (race condition lost)
    mockDbState.nextReturning = [];
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', code: 'PQ-RACECOND-BBBBBBBB-CCCCCCCC' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Codice già utilizzato');
  });

  it('new user (no user_settings row) → creates row with tier=unlocked', async () => {
    mockDbState.selectResults = [
      [{ code: 'PQ-NEWUSER0-BBBBBBBB-CCCCCCCC', usedBy: null, usedAt: null }],
      [], // no user_settings
    ];
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'new@test.com', code: 'PQ-NEWUSER0-BBBBBBBB-CCCCCCCC' },
    });
    expect(res.statusCode).toBe(200);
    // user_settings insert was called
    const insert = mockDbState.inserted.find(i => i.userEmail === 'new@test.com');
    expect(insert).toBeTruthy();
    expect(insert.tier).toBe('unlocked');
  });

  it('invalid email → 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'not-an-email', code: 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('missing code → 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rate limit: 6th attempt from same IP → 429', async () => {
    // 5 failed attempts first (all invalid codes)
    for (let i = 0; i < 5; i++) {
      mockDbState.selectResults = [[]];
      const r = await callHandler({
        method: 'POST',
        url: '/api/users/redeem-code',
        headers: { origin: 'http://localhost', 'x-forwarded-for': '1.2.3.4' },
        body: { email: 'user@test.com', code: `NOPE-${i}` },
      });
      expect(r.statusCode).toBe(404);
    }
    // 6th attempt → 429
    const r = await callHandler({
      method: 'POST',
      url: '/api/users/redeem-code',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.2.3.4' },
      body: { email: 'user@test.com', code: 'NOPE-AGAIN' },
    });
    expect(r.statusCode).toBe(429);
  });
});
