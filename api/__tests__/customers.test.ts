import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDbState = {
  selectResults: [] as any[],
  inserted: [] as any[],
  updated: [] as any[],
  deleteCalls: 0,
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
    where: vi.fn(function (this: any) {
      mockDbState.deleteCalls++;
      return this;
    }),
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
  mockDbState.deleteCalls = 0;
  mockDbState.nextReturning = null;
  delete process.env.DEEPSEEK_API_KEY;
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

  it('POST /customers/:id/research con logoUrl manuale → logo manual, detectedLogoUrl non toccato', async () => {
    mockDbState.selectResults.push([{ id: 'cust_1', businessName: 'Bar', contacts: {}, googleMapsUrl: null, logoUrl: 'data:image/png;base64,manual', detectedLogoUrl: 'https://old.example/logo.png' }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/research', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.researchStatus.logo).toBe('manual');
    const lastUpdate = mockDbState.updated[mockDbState.updated.length - 1];
    expect(lastUpdate.detectedLogoUrl).toBe('https://old.example/logo.png');
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
      if (u.includes('api.firecrawl.dev/v2/scrape')) {
        return new Response(JSON.stringify({
          data: {
            markdown: 'Bar Da Mario\n\nIl miglior bar di Cagliari. Aperto tutti i giorni.',
            screenshot: 'https://bar.example.com/screenshot.png',
            branding: { logo: 'https://bar.example.com/logo.png', colors: { primary: '#01696F' }, fonts: ['Inter'] },
            images: ['https://bar.example.com/hero.jpg'],
            links: ['https://bar.example.com/menu', 'https://bar.example.com/contatti'],
            json: { company_name: 'Bar Da Mario', company_description: 'Il miglior bar di Cagliari' },
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
    expect(res.body.data.webData.markdownFull).toContain('Cagliari');
    expect(res.body.data.webData.screenshot).toContain('screenshot.png');
    expect(res.body.data.webData.links).toHaveLength(2);
    expect(res.body.data.webData.json.company_name).toBe('Bar Da Mario');
    expect(res.body.data.webData.images).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalled();
    const firecrawlCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => String(url).includes('api.firecrawl.dev'));
    expect(firecrawlCall?.[0]).toBe('https://api.firecrawl.dev/v2/scrape');
    // Regression: webData deve essere PERSISTITO (altrimenti il pannello
    // "Dati del sito" sparisce al reload — bug prod 2026-07-30).
    const lastUpdate = mockDbState.updated[mockDbState.updated.length - 1];
    expect(lastUpdate.webData).toBeDefined();
    expect(lastUpdate.webData.markdownFull).toContain('Cagliari');
    expect(lastUpdate.webData.json.company_name).toBe('Bar Da Mario');
    expect(lastUpdate.webData.images).toHaveLength(1);
  });

  it('POST /customers/:id/ai-fill senza DeepSeek key → fallback lookup, costUsd 0', async () => {
    mockDbState.selectResults.push(
      [{ id: 'cust_1', businessName: 'Bar', sector: 'bar', mood: null, target: null, preferredColors: null, activity: null }],
      [], // customer_knowledge: nessun chunk
    );
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/ai-fill', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.aiSuggestedFields.mood).toBe('moderno vivace');
    expect(res.body.data.costUsd).toBe(0);
  });

  it('POST /customers/:id/ai-fill con DeepSeek ok → valori AI + costUsd > 0', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds_test';
    mockDbState.selectResults.push(
      [{ id: 'cust_1', businessName: 'Bar', sector: 'bar', mood: null, target: null, preferredColors: null, activity: null }],
      [{ chunk: 'Cocktail bar in centro a Cagliari.' }],
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"mood":"elegante notturno","target":"giovani professionisti","preferredColors":"blu notte e oro","activity":"Cocktail bar premium"}' } }],
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/ai-fill', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.aiSuggestedFields).toEqual({
      mood: 'elegante notturno',
      target: 'giovani professionisti',
      preferredColors: 'blu notte e oro',
      activity: 'Cocktail bar premium',
    });
    // (1000 * 0.14 + 500 * 0.28) / 1e6 = 0.00028 (mirror providerPricing deepseek-chat)
    expect(res.body.data.costUsd).toBe(0.00028);
    const dsCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => String(url).includes('api.deepseek.com'));
    expect(dsCall).toBeTruthy();
    expect(String(dsCall?.[1]?.body)).toContain('Cocktail bar in centro a Cagliari');
    // update customer con i valori AI
    const lastUpdate = mockDbState.updated[mockDbState.updated.length - 1];
    expect(lastUpdate.mood).toBe('elegante notturno');
  });

  it('POST /customers/:id/ai-fill DeepSeek fallisce → fallback lookup', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds_test';
    mockDbState.selectResults.push(
      [{ id: 'cust_1', businessName: 'Bar', sector: 'bar', mood: null, target: null, preferredColors: null, activity: null }],
      [],
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('quota', { status: 402 }));
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/ai-fill', body: { adminEmail: 'admin@gmail.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.aiSuggestedFields.mood).toBe('moderno vivace');
    expect(res.body.data.costUsd).toBe(0);
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

  it('POST /customers/:id/auto-build rerun → delete BOZZE esistenti prima di inserire (no duplicati)', async () => {
    const cust = { id: 'cust_1', businessName: 'Bar', sector: 'bar', contacts: {}, customerPhotos: [] };
    mockDbState.selectResults.push([cust]);
    await callHandler({
      method: 'POST', url: '/api/customers/cust_1/auto-build', body: { adminEmail: 'admin@gmail.com', autoGenerate: false },
    });
    expect(mockDbState.deleteCalls).toBe(1);
    expect(mockDbState.inserted.length).toBe(3);
    mockDbState.selectResults.push([cust]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/auto-build', body: { adminEmail: 'admin@gmail.com', autoGenerate: false },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.createdDocuments.length).toBe(3);
    // replace semantics: una delete BOZZE per giro, insert restano 3 per giro
    expect(mockDbState.deleteCalls).toBe(2);
    expect(mockDbState.inserted.length).toBe(6);
  });

  it('POST /customers/:id/auto-build draft completi: QR card da website, subheadline flyer da mood', async () => {
    mockDbState.selectResults.push([{
      id: 'cust_1', businessName: 'Bar', sector: 'bar', mood: 'moderno vivace',
      activity: 'Cocktail bar in centro.', contacts: { website: 'https://bar.example' }, customerPhotos: [],
    }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/auto-build', body: { adminEmail: 'admin@gmail.com', autoGenerate: false },
    });
    expect(res.statusCode).toBe(201);
    const card = mockDbState.inserted.find((d: any) => d.documentType === 'businessCard');
    expect(card?.data?.back?.qrPayload).toBe('https://bar.example');
    const flyer = mockDbState.inserted.find((d: any) => d.documentType === 'flyer');
    expect(flyer?.data?.content?.subheadline).toBe('moderno vivace');
    expect(flyer?.data?.content?.body).toBe('Cocktail bar in centro.');
  });

  it('POST /customers/:id/auto-build briefContext include webData Firecrawl', async () => {
    mockDbState.selectResults.push([{
      id: 'cust_1', businessName: 'Pad Thai', sector: 'ristorante', contacts: {},
      preferredColors: '#112233, #445566',
      webData: {
        title: 'PadThai – Osteria Thailandese',
        description: 'Cucina thai a Cagliari',
        json: { company_description: 'Un angolo di Thailandia nel cuore della Sardegna.' },
        brandingColors: { primary: '#C39E53', secondary: '#CC3366' },
        brandingFonts: ['Inter'],
        links: ['https://padthaicagliari.it/#content'],
        markdownPreview: 'Un angolo di Thailandia nel cuore della Sardegna.',
      },
    }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/auto-build', body: { adminEmail: 'admin@gmail.com', autoGenerate: false },
    });
    expect(res.statusCode).toBe(201);
    const brief = mockDbState.inserted[0]?.data?.briefContext || '';
    expect(brief).toContain('Titolo sito: PadThai');
    expect(brief).toContain('Colori sito (USA QUESTI');
    expect(brief).toContain('#C39E53');
    expect(brief).toContain('Palette preferita cliente (secondaria): #112233, #445566');
    // colori sito prima della palette cliente (priorità nel prompt)
    expect(brief.indexOf('Colori sito (USA QUESTI')).toBeLessThan(brief.indexOf('Palette preferita cliente (secondaria):'));
  });

  it('POST /customers/:id/auto-build briefContext senza brandingColors: niente "Colori sito (USA QUESTI", solo palette cliente', async () => {
    mockDbState.selectResults.push([{
      id: 'cust_1', businessName: 'Bar', sector: 'bar', contacts: {},
      preferredColors: '#112233',
      webData: { title: 'Bar Centrale' },
    }]);
    const res = await callHandler({
      method: 'POST', url: '/api/customers/cust_1/auto-build', body: { adminEmail: 'admin@gmail.com', autoGenerate: false },
    });
    expect(res.statusCode).toBe(201);
    const brief = mockDbState.inserted[0]?.data?.briefContext || '';
    expect(brief).not.toContain('Colori sito (USA QUESTI');
    expect(brief).toContain('Palette preferita cliente (secondaria): #112233');
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