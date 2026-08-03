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
  delete process.env.FIRECRAWL_API_KEY;
  mockDbState.selectResults = [];
  mockDbState.inserted = [];
  mockDbState.updated = [];
  mockDbState.nextReturning = null;
  vi.unstubAllGlobals();
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

  it('POST /intake con sourceRef duplicato → 200 upsert (non più 409)', async () => {
    mockDbState.selectResults.push([{ id: 'intake_old', status: 'new', sourceRef: 'row_1' }]);
    // customer dedup: nessun match → crea nuovo customer
    mockDbState.selectResults.push([]);
    mockDbState.selectResults.push([]);
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: { businessName: 'Bar Modificato', sector: 'ristorante', sourceRef: 'row_1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.updated).toBe(true);
    expect(res.body.data.id).toBe('intake_old');
    // intake aggiornato (non nuovo insert)
    const intakeUpdate = mockDbState.updated.find((s: any) => s.businessName === 'Bar Modificato');
    expect(intakeUpdate).toBeDefined();
    expect(intakeUpdate.sector).toBe('ristorante');
    // nessun nuovo intake insertato
    expect(mockDbState.inserted.filter((i: any) => i.id?.startsWith('intake_'))).toHaveLength(0);
  });

  it('POST /intake upsert: modifica campi → customer aggiornato', async () => {
    mockDbState.selectResults.push([{ id: 'intake_old', status: 'new', sourceRef: 'row_ups' }]);
    // customer dedup: match by email
    mockDbState.selectResults.push([{ id: 'cust_esistente', businessName: 'Bar Originale' }]);
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: {
        businessName: 'Bar Nuovo Nome', sourceRef: 'row_ups',
        contacts: { email: 'bar@test.it' },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.updated).toBe(true);
    // customer aggiornato: trova l'update con intakeId (non l'update intake)
    const custUpdate = mockDbState.updated.find((s: any) => s.intakeId);
    expect(custUpdate).toBeDefined();
    expect(custUpdate.businessName).toBe('Bar Nuovo Nome');
    expect(custUpdate.intakeId).toBe('intake_old');
  });

  it('POST /intake body invalido → 400', async () => {
    const res = await callHandler({
      method: 'POST', url: '/api/intake', body: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /intake con email customer esistente → UPDATE (no duplicato)', async () => {
    mockDbState.selectResults.push([]); // sourceRef idempotency → nessun intake esistente
    mockDbState.selectResults.push([{ id: 'cust_esistente', businessName: 'Al cuore della culla' }]); // dedup by email
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: { businessName: 'Al cuore della culla', sourceRef: 'row_dedup', contacts: { email: 'mrtntuveri@gmail.com' } },
    });
    expect(res.statusCode).toBe(201);
    const update = mockDbState.updated.find((s: any) => s.intakeId);
    expect(update).toBeDefined();
    expect(update.businessName).toBe('Al cuore della culla');
    expect(update.source).toBe('intake');
    // niente INSERT customer duplicato: inserted contiene solo l'intake
    expect(mockDbState.inserted).toHaveLength(1);
  });

  it('POST /intake con mood lungo (>100 char, testo libero form) → 201 (regression: era max(100))', async () => {
    mockDbState.selectResults.push([]);
    const longMood = 'Che richiami la primavera, dia la sensazione di serenità, con colori chiari/pastello, immagini stilizzate (mamma che tiene in braccio un bimbo o una culla)';
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: { businessName: 'Al cuore della culla', sourceRef: 'row_mood', mood: longMood },
    });
    expect(res.statusCode).toBe(201);
    const [intake] = mockDbState.inserted;
    expect(intake.mood).toBe(longMood);
  });

  it('POST /intake con webAnswers → salvati su intake e customer', async () => {
    mockDbState.selectResults.push([]);
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: {
        businessName: 'Bar Da Mario', sourceRef: 'row_web',
        webAnswers: { wantsPage: 'Sì', headline: 'Slogan', cta: 'Prenota' },
      },
    });
    expect(res.statusCode).toBe(201);
    const [intake, customer] = mockDbState.inserted;
    expect(intake.webAnswers).toEqual({ wantsPage: 'Sì', headline: 'Slogan', cta: 'Prenota' });
    expect(customer.webAnswers).toEqual({ wantsPage: 'Sì', headline: 'Slogan', cta: 'Prenota' });
  });

  it('POST /intake con website → auto-research parte (update customer)', async () => {
    process.env.FIRECRAWL_API_KEY = 'test-fc';
    mockDbState.selectResults.push([]);
    mockDbState.updated.push({}); // placeholder reset
    mockDbState.updated.length = 0;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          markdown: '# Bar Da Mario\nOttimo bar a Cagliari.',
          metadata: { title: 'Bar Da Mario', description: 'Ottimo bar' },
          links: [], images: [], branding: {},
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: { businessName: 'Bar Da Mario', sourceRef: 'row_site', contacts: { website: 'https://barmario.it' } },
    });
    expect(res.statusCode).toBe(201);
    const custUpdate = mockDbState.updated.find((s: any) => s.researchStatus);
    expect(custUpdate).toBeDefined();
    expect(custUpdate.researchStatus.web).toBe('ok');
  });

  it('POST /intake con website ma senza FIRECRAWL_API_KEY → 201, no crash', async () => {
    mockDbState.selectResults.push([]);
    // no-key → niente Firecrawl; detectLogo farebbe fetch reale → stub network down
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const res = await callHandler({
      method: 'POST', url: '/api/intake',
      body: { businessName: 'Bar', sourceRef: 'row_nokey', contacts: { website: 'https://barmario.it' } },
    });
    expect(res.statusCode).toBe(201);
    // research best-effort: no_key senza key, nessuna eccezione
    const custUpdate = mockDbState.updated.find((s: any) => s.researchStatus);
    expect(custUpdate?.researchStatus?.web).toBe('no_key');
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