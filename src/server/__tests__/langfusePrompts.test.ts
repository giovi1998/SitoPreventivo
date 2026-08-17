import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compilePrompt } from '../langfusePrompts';
import { resetApiTests, callApiHandler } from './helpers/apiTest';

const globalAny = global as any;

describe('compilePrompt ({{var}} substitution)', () => {
  it('substitutes {{vars}} with values', () => {
    expect(compilePrompt('Ciao {{name}}, settore {{sector}}', { name: 'Mario', sector: 'food' })).toBe('Ciao Mario, settore food');
  });

  it('leaves unknown {{vars}} as-is', () => {
    expect(compilePrompt('Ciao {{name}}', {})).toBe('Ciao {{name}}');
  });

  it('handles missing variable values as empty string', () => {
    expect(compilePrompt('a{{x}}b', { x: undefined })).toBe('ab');
  });

  it('escapes regex-special chars in variable names', () => {
    expect(compilePrompt('{{a.b}}', { 'a.b': 'v' })).toBe('v');
  });

  it('TB-029 migrazione: fallback locale copre tutti i 5 nuovi system prompt', async () => {
    const { localPromptFallback } = await import('../langfusePrompts');
    const expected = ['logo-system', 'social-system', 'onboarding-system', 'website-system', 'palette-system'];
    for (const id of expected) {
      const fb = localPromptFallback(id);
      expect(fb, id).not.toBeNull();
      expect(fb![0].role).toBe('system');
      expect(fb![0].content.length).toBeGreaterThan(50);
    }
  });
});

describe('GET /api/ai/prompt (Prompt Management)', () => {
  beforeEach(() => {
    resetApiTests();
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_BASE_URL = 'https://cloud.langfuse.com';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubPromptFetch(remoteBody: unknown) {
    const calls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) {
        return { ok: true, status: 200 };
      }
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => remoteBody,
      };
    });
    return calls;
  }

  it('fetches prompt by name + label from Langfuse public API', async () => {
    const calls = stubPromptFetch({ name: 'card-system', version: 3, prompt: [{ role: 'system', content: 'Sei un assistente card {{stile}}' }] });
    const req = { method: 'GET', url: '/api/ai/prompt?name=card-system&label=production', headers: { 'x-forwarded-for': '1.1.1.1' }, body: {} };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('https://cloud.langfuse.com/api/public/v2/prompts/card-system?label=production');
    expect(calls[0].init.headers.Authorization).toBe(`Basic ${Buffer.from('pk-test:sk-test').toString('base64')}`);
    expect(res.body.data.prompt[0].content).toContain('{{stile}}');
    expect(res.body.data.version).toBe(3);
  });

  it('defaults label to production and falls back to local template when fetch fails', async () => {
    globalAny.fetch = vi.fn(async () => {
      return { ok: false, status: 500 };
    });
    const req = { method: 'GET', url: '/api/ai/prompt?name=card-system', headers: { 'x-forwarded-for': '1.1.1.1' }, body: {} };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.fallback).toBe(true);
    expect(res.body.data.prompt[0].content).toContain('bigliettini da visita');
  });

  it('returns 404 for unknown prompt names', async () => {
    globalAny.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ name: 'x' }) }));
    const req = { method: 'GET', url: '/api/ai/prompt?name=inesistente', headers: { 'x-forwarded-for': '1.1.1.1' }, body: {} };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(404);
  });

  it('TB-029 fase 3: customerId override label da promptLabels (A/B per cliente)', async () => {
    const calls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      calls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ name: 'card-system', version: 9, prompt: [{ role: 'system', content: 'EXPERIMENT' }] }) };
    });
    const req = {
      method: 'GET',
      url: '/api/ai/prompt?name=card-system&label=production&customerId=cust_42',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      body: {},
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    // con promptLabels non settati → label richiesta resta production
    expect(calls[0]).toContain('label=production');
    expect(res.body.data.version).toBe(9);
  });

  it('TB-029 fase 3: promptLabels del cliente fa override label → label=experiment', async () => {
    const { mockDbState } = await import('./helpers/apiTest');
    mockDbState.selectResults.push([{ id: 'cust_42', promptLabels: { 'card-system': 'experiment' } }]);
    const calls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      calls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ name: 'card-system', version: 10, prompt: [{ role: 'system', content: 'EXPERIMENT VERSION' }] }) };
    });
    const req = {
      method: 'GET',
      url: '/api/ai/prompt?name=card-system&label=production&customerId=cust_42',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      body: {},
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(calls[0]).toContain('label=experiment');
    expect(res.body.data.version).toBe(10);
  });
});

describe('PATCH /customers/:id promptLabels (A/B testing per cliente)', () => {
  beforeEach(() => {
    resetApiTests();
    process.env.ADMIN_PASSWORD = 'test-admin-pass';
  });

  it('accetta promptLabels nel body (persistenza via PATCH customers)', async () => {
    const req = {
      method: 'PATCH',
      url: '/api/customers/cust_42',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: { adminEmail: 'admin@gmail.com', promptLabels: { 'card-system': 'experiment' } },
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
  });
});

describe('Admin prompt CRUD (carica / cancella / lista)', () => {
  beforeEach(() => {
    resetApiTests();
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_BASE_URL = 'https://cloud.langfuse.com';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLangfuseApi(responder: (url: string, init: any) => { ok: boolean; status: number; json?: () => Promise<any> }) {
    const calls: Array<{ url: string; init: any }> = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      calls.push({ url: String(url), init });
      return responder(String(url), init);
    });
    return calls;
  }

  it('POST /ai/prompts carica un prompt (nuova versione) su Langfuse', async () => {
    const calls = stubLangfuseApi((url, init) => {
      if (url.endsWith('/api/public/v2/prompts') && init.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ name: 'card-system', version: 4 }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const req = {
      method: 'POST',
      url: '/api/ai/prompts',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: {
        adminEmail: 'admin@gmail.com',
        name: 'card-system',
        prompt: [{ role: 'system', content: 'Nuovo template card' }],
        label: 'staging',
      },
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.version).toBe(4);
    const call = calls.find((c) => c.url.endsWith('/api/public/v2/prompts'));
    expect(call).toBeDefined();
    const body = JSON.parse(call!.init.body);
    expect(body.name).toBe('card-system');
    expect(body.type).toBe('chat');
    expect(body.prompt[0].content).toContain('Nuovo template card');
    expect(body.labels).toContain('staging');
  });

  it('DELETE /ai/prompts/:name cancella il prompt da Langfuse', async () => {
    const calls = stubLangfuseApi((url, init) => {
      if (url.includes('/api/public/v2/prompts/card-system') && init.method === 'DELETE') {
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const req = {
      method: 'DELETE',
      url: '/api/ai/prompts/card-system',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: { adminEmail: 'admin@gmail.com' },
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(calls.some((c) => c.url.includes('/api/public/v2/prompts/card-system'))).toBe(true);
  });

  it('GET /ai/prompts lista i prompt caricati su Langfuse', async () => {
    const calls = stubLangfuseApi((url) => {
      if (url.endsWith('/api/public/v2/prompts')) {
        return {
          ok: true, status: 200,
          json: async () => ({
            data: [
              { name: 'card-system', versions: [{ version: 4, labels: ['production'] }] },
              { name: 'quote-system', versions: [{ version: 2, labels: ['staging'] }] },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const req = {
      method: 'GET',
      url: '/api/ai/prompts?adminEmail=admin@gmail.com',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      body: {},
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].name).toBe('card-system');
  });

  it('richieste admin senza adminEmail → 403', async () => {
    const req = {
      method: 'DELETE',
      url: '/api/ai/prompts/card-system',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      body: {},
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(403);
  });

  it('roundtrip: prompt caricato è quello servito da GET /ai/prompt (stessa label)', async () => {
    // Stato simulato: Langfuse con un prompt custom "stampa" su label staging.
    const uploaded: Record<string, any> = {
      'card-system:staging': {
        name: 'card-system', version: 5,
        prompt: [{ role: 'system', content: 'Template STAMPA: usa placement.scale per la leggibilità' }],
      },
    };
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      const u = String(url);
      if (u.endsWith('/api/public/v2/prompts') && init?.method === 'POST') {
        const body = JSON.parse(init.body);
        const key = `${body.name}:${body.labels?.[0] ?? 'production'}`;
        uploaded[key] = { name: body.name, version: 1, prompt: body.prompt };
        return { ok: true, status: 200, json: async () => uploaded[key] };
      }
      const m = u.match(/\/api\/public\/v2\/prompts\/([^?]+)\?label=([^&]+)/);
      if (m) {
        const found = uploaded[`${m[1]}:${m[2]}`];
        if (found) return { ok: true, status: 200, json: async () => found };
        return { ok: false, status: 404 };
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    });

    // 1. Carica il prompt custom
    const postReq = {
      method: 'POST',
      url: '/api/ai/prompts',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: {
        adminEmail: 'admin@gmail.com',
        name: 'card-system',
        prompt: [{ role: 'system', content: 'Template STAMPA: usa placement.scale per la leggibilità' }],
        label: 'staging',
      },
    };
    const postRes: any = await callApiHandler(postReq);
    expect(postRes.statusCode).toBe(200);

    // 2. Verifica che /ai/prompt con la stessa label serva il contenuto caricato
    const getReq = {
      method: 'GET',
      url: '/api/ai/prompt?name=card-system&label=staging',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      body: {},
    };
    const getRes: any = await callApiHandler(getReq);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.data.prompt[0].content).toContain('Template STAMPA');
    expect(getRes.body.data.fallback).toBe(false);
    expect(getRes.body.data.version).toBe(1);

    // 3. Cancella → /ai/prompt torna al fallback locale
    const delReq = {
      method: 'DELETE',
      url: '/api/ai/prompts/card-system',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: { adminEmail: 'admin@gmail.com' },
    };
    const delRes: any = await callApiHandler(delReq);
    expect(delRes.statusCode).toBe(200);
  });
});

describe('TB-032 versioni prompt (test prompt×modello)', () => {
  beforeEach(() => {
    resetApiTests();
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_BASE_URL = 'https://cloud.langfuse.com';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('version param → fetch versione esatta, labels+commitMessage nel data', async () => {
    const calls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      calls.push(String(url));
      return {
        ok: true, status: 200,
        json: async () => ({
          name: 'card-system', version: 2,
          labels: ['staging'],
          commitMessage: 'Fix grid collisioni',
          prompt: [{ role: 'system', content: 'V2' }],
        }),
      };
    });
    const req = { method: 'GET', url: '/api/ai/prompt?name=card-system&label=production&version=2', headers: { 'x-forwarded-for': '1.1.1.1' }, body: {} };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(calls[0]).toContain('label=production');
    expect(calls[0]).toContain('version=2');
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.commitMessage).toBe('Fix grid collisioni');
    expect(res.body.data.labels).toContain('staging');
  });

  it('promptVersions del cliente fa override versione → version=3 + label experiment', async () => {
    const { mockDbState } = await import('./helpers/apiTest');
    mockDbState.selectResults.push([{ id: 'cust_42', promptLabels: { 'card-system': 'experiment' }, promptVersions: { 'card-system': 3 } }]);
    const calls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      calls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ name: 'card-system', version: 3, prompt: [{ role: 'system', content: 'V3' }] }) };
    });
    const req = {
      method: 'GET',
      url: '/api/ai/prompt?name=card-system&label=production&customerId=cust_42',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      body: {},
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(calls[0]).toContain('label=experiment');
    expect(calls[0]).toContain('version=3');
    expect(res.body.data.version).toBe(3);
  });

  it('commitMessage propagato al body Langfuse nel POST', async () => {
    const calls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/api/public/v2/prompts') && init.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ name: 'card-system', version: 5 }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const req = {
      method: 'POST',
      url: '/api/ai/prompts',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: {
        adminEmail: 'admin@gmail.com',
        name: 'card-system',
        prompt: [{ role: 'system', content: 'Nuovo template' }],
        label: 'staging',
        commitMessage: 'Test A/B: più rigido sui servizi',
      },
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    const call = calls.find((c) => c.url.endsWith('/api/public/v2/prompts'));
    const body = JSON.parse(call!.init.body);
    expect(body.commitMessage).toBe('Test A/B: più rigido sui servizi');
  });

  it('promptVersions accettato in PATCH customers', async () => {
    const { mockDbState } = await import('./helpers/apiTest');
    mockDbState.selectResults.push([{ id: 'cust_42' }]);
    const req = {
      method: 'PATCH',
      url: '/api/customers/cust_42',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: { adminEmail: 'admin@gmail.com', promptVersions: { 'card-system': 3 } },
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
  });

  it('GET /ai/prompts/versions: lista versioni + dettaglio (commitMessage, anteprima)', async () => {
    const calls: string[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) return { ok: true, status: 200 };
      const u = String(url);
      calls.push(u);
      if (u.endsWith('/api/public/v2/prompts')) {
        return { ok: true, status: 200, json: async () => ({ data: [{ name: 'card-system', versions: [2, 3, 4], labels: ['production'] }] }) };
      }
      const m = u.match(/\/prompts\/card-system\?version=(\d+)$/);
      if (m) {
        return {
          ok: true, status: 200,
          json: async () => ({
            name: 'card-system', version: Number(m[1]),
            labels: m[1] === '4' ? ['experiment', 'latest'] : ['production'],
            commitMessage: m[1] === '4' ? 'A/B: più rigido sui servizi' : null,
            prompt: [{ role: 'system', content: `CONTENUTO V${m[1]}` }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    });
    const req = {
      method: 'GET',
      url: '/api/ai/prompts/versions?name=card-system&adminEmail=admin@gmail.com',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      body: {},
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe('card-system');
    expect(res.body.data.versions.map((v: any) => v.version)).toEqual([2, 3, 4]);
    const v4 = res.body.data.versions.find((v: any) => v.version === 4);
    expect(v4.labels).toContain('experiment');
    expect(v4.commitMessage).toBe('A/B: più rigido sui servizi');
    expect(v4.content).toBe('CONTENUTO V4');
    expect(v4.length).toBeGreaterThan(0);
    // 1 list + 3 detail
    expect(calls.length).toBe(4);
  });
});
