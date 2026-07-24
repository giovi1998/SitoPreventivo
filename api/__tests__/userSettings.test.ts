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
    // Make the chain awaitable: `await db.select().from().where()` resolves
    // to the first queued result. Production Drizzle does the same.
    then(resolve: any) {
      const result = mockDbState.selectResults.shift() ?? [];
      return Promise.resolve(result).then(resolve);
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

describe('GET /api/user-settings (onboarding)', () => {
  it('returns 400 when email query param is missing', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with onboardingDone=true for admin without DB hit', async () => {
    const res = await callHandler({
      method: 'GET',
      url: '/api/user-settings?email=admin%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ userEmail: 'admin@gmail.com', onboardingDone: true });
  });

  it('returns 200 with existing user settings (onboarding complete)', async () => {
    mockDbState.selectResults = [[
      { userEmail: 'user@test.com', onboardingDone: true, displayName: 'Test', documentTheme: 'corporate' },
    ]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/user-settings?email=user%40test.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.onboardingDone).toBe(true);
  });

  it('returns 200 with empty defaults when user has no settings row', async () => {
    mockDbState.selectResults = [[]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/user-settings?email=newuser%40test.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ userEmail: 'newuser@test.com', onboardingDone: false });
  });
});

describe('POST /api/user-settings (onboarding save)', () => {
  it('returns 400 when body is missing email', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: { displayName: 'Test' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when email is not valid', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: { email: 'not-an-email', displayName: 'Test' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 for admin without DB hit (save is a no-op for admin)', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: { email: 'admin@gmail.com', displayName: 'Admin' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 201 + inserted row when user has no settings yet (onboarding first run)', async () => {
    mockDbState.selectResults = [[]]; // no existing settings
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        displayName: 'Test User',
        companyName: 'Test Co',
        profession: 'web',
        defaultColor: '#0B57D0',
        defaultVat: 22,
        onboardingDone: true,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.userEmail).toBe('user@test.com');
    expect(res.body.onboardingDone).toBe(true);
  });

  it('returns 200 + updated row when user already has settings (re-onboarding)', async () => {
    mockDbState.selectResults = [[
      { userEmail: 'user@test.com', onboardingDone: false, displayName: 'Old Name' },
    ]];
    mockDbState.nextReturning = [{
      userEmail: 'user@test.com',
      onboardingDone: true,
      displayName: 'New Name',
    }];
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        displayName: 'New Name',
        onboardingDone: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.displayName).toBe('New Name');
  });
});

describe('Routing (regression: /user-settings must NOT be captured by /users prefix)', () => {
  it('GET /api/user-settings is routed to handleUserSettings, not handleUsers', async () => {
    mockDbState.selectResults = [[{ userEmail: 'user@test.com', onboardingDone: false }]];
    const res = await callHandler({
      method: 'GET',
      url: '/api/user-settings?email=user%40test.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    // handleUsers GET /users requires adminEmail query param
    // handleUsers /users/profile requires path ending with /profile
    // So if it gets here, routing is correct (it didn't fall into handleUsers)
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('userEmail');
    expect(res.body).toHaveProperty('onboardingDone');
  });
});

describe('Phase 7, preferredDocumentType in user-settings', () => {
  it('POST /user-settings accepts a valid preferredDocumentType and persists it', async () => {
    mockDbState.selectResults = [[]]; // no existing row → insert path
    mockDbState.nextReturning = [{
      userEmail: 'user@test.com',
      onboardingDone: true,
      preferredDocumentType: 'qr',
    }];
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        displayName: 'Test',
        onboardingDone: true,
        preferredDocumentType: 'qr',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.preferredDocumentType).toBe('qr');
  });

  it('POST /user-settings rejects an invalid preferredDocumentType with 400', async () => {
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: {
        // Anything outside (editor|qr|card|flyer|logo) is rejected.
        // Phase 3 added 'flyer' to the allowlist.
        email: 'user@test.com',
        preferredDocumentType: 'spreadsheet',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('POST /user-settings accepts "card" (bigliettino), "flyer" (volantino) and "logo"', async () => {
    mockDbState.selectResults = [[]];
    mockDbState.nextReturning = [{
      userEmail: 'user@test.com',
      preferredDocumentType: 'card',
    }];
    const res1 = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', preferredDocumentType: 'card' },
    });
    expect(res1.statusCode).toBe(201);
    expect(res1.body.preferredDocumentType).toBe('card');

    mockDbState.nextReturning = [{
      userEmail: 'user@test.com',
      preferredDocumentType: 'flyer',
    }];
    const res2 = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', preferredDocumentType: 'flyer' },
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.body.preferredDocumentType).toBe('flyer');

    mockDbState.nextReturning = [{
      userEmail: 'user@test.com',
      preferredDocumentType: 'logo',
    }];
    const res3 = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: { email: 'user@test.com', preferredDocumentType: 'logo' },
    });
    expect(res3.statusCode).toBe(201);
    expect(res3.body.preferredDocumentType).toBe('logo');
  });

  it('POST /user-settings updates preferredDocumentType on existing row (re-onboarding)', async () => {
    mockDbState.selectResults = [[
      { userEmail: 'user@test.com', onboardingDone: false, preferredDocumentType: null },
    ]];
    mockDbState.nextReturning = [{
      userEmail: 'user@test.com',
      onboardingDone: true,
      preferredDocumentType: 'logo',
    }];
    const res = await callHandler({
      method: 'POST',
      url: '/api/user-settings',
      headers: { origin: 'http://localhost' },
      body: {
        email: 'user@test.com',
        onboardingDone: true,
        preferredDocumentType: 'logo',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.preferredDocumentType).toBe('logo');
  });
});
