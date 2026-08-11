import { vi } from 'vitest';

/**
 * Shared test harness for endpoint tests that hit the monolithic
 * `api/index.ts` handler. Mocks Drizzle + GoogleGenAI and exposes a
 * single `callApiHandler` helper.
 */

export const mockDbState = {
  selectResults: [] as any[],
  inserted: [] as any[],
  updated: [] as any[],
};

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
      return mockDbState.selectResults.shift() ?? [];
    }),
    // Drizzle è thenable: await (await db.select()...where()) risolve l'array.
    then: (resolve: (v: any) => void) => {
      resolve(mockDbState.selectResults.shift() ?? []);
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
    set: vi.fn(function (this: any) { return this; }),
    where: vi.fn(function (this: any) { return this; }),
    returning: vi.fn(function (this: any) { return [{ id: 'x' }]; }),
  };
  return chain;
}

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => makeDb()),
}));

export const createInteraction = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    interactions = { create: createInteraction };
    constructor() {}
  },
}));

export function resetApiTests(): void {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.ADMIN_PASSWORD = 'test-admin-pass';
  process.env.GEMINI_API_KEY = 'test-gemini';
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
  createInteraction.mockReset();
  vi.resetModules();
}

export async function callApiHandler(req: any) {
  const handler = (await import('../../handler')).default;
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
