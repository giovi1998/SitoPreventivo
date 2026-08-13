// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = {
      embedContent: vi.fn(async () => ({ embedding: { values: [0.5, 0.5] } })),
    };
  }
  return { GoogleGenAI };
});

// Smoke test del dev API proxy inline in vite.config.js.
// Regression: il fallback Ollama usava `json()` fuori scope → il client
// riceveva "AI error: json is not defined" (502). Inoltre /api/logs non
// era gestito in dev → 404 continui dal logger client.

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  ended: boolean;
  setHeader: (k: string, v: string) => void;
  write: (s: string) => void;
  end: (s?: string) => void;
}

function mockReq(method: string, url: string, payload?: unknown) {
  const chunks = payload !== undefined ? [Buffer.from(JSON.stringify(payload))] : [];
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

function mockRes(): MockRes {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    ended: false,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    write(s) {
      this.body += s;
    },
    end(s) {
      if (s) this.body += s;
      this.ended = true;
    },
  };
}

type Middleware = (req: unknown, res: MockRes, next: () => void) => Promise<void>;

async function loadApiMiddleware(ssrLoadModule: (id: string) => Promise<unknown>): Promise<Middleware> {
  const cfgFactory = (await import('../../vite.config.js')).default as (
    env: { mode: string; command: string }
  ) => Promise<{ plugins: unknown[] }> | { plugins: unknown[] };
  const config = await cfgFactory({ mode: 'development', command: 'serve' });
  const plugins = (config.plugins as unknown[]).flat() as { name?: string }[];
  const plugin = plugins.find((p) => p && p.name === 'spa-fallback') as {
    configureServer: (server: unknown) => void;
  };
  expect(plugin, 'plugin spa-fallback non trovato in vite.config.js').toBeDefined();
  const middlewares: Middleware[] = [];
  plugin.configureServer({
    middlewares: { use: (fn: Middleware) => middlewares.push(fn) },
    ssrLoadModule,
  });
  // middlewares[0] = SPA fallback, middlewares[1] = dev API proxy
  return middlewares[1];
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.OLLAMA_API_KEY;
});

describe('vite dev API proxy (vite.config.js)', () => {
  it('POST /api/logs risponde 200 { data: { ok: true } } e stampa in console', async () => {
    const api = await loadApiMiddleware(async () => null);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = mockRes();
    await api(
      mockReq('POST', '/api/logs', { level: 'warn', msg: 'boom', meta: { route: '/app/card' }, url: '/app/card', t: 123 }),
      res,
      () => {
        throw new Error('next() non deve essere chiamato per /api/logs');
      },
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ data: { ok: true } });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('fallback Ollama senza OLLAMA_API_KEY → 503 strutturato (non "json is not defined")', async () => {
    const api = await loadApiMiddleware(async () => null); // registry non caricabile → fallback Ollama
    // delete DOPO il load: loadEnv() nella config factory ripopola
    // process.env da .env (che in questo repo ha una key reale)
    delete process.env.OLLAMA_API_KEY;
    const res = mockRes();
    await api(
      mockReq('POST', '/api/ai/chat', { provider: 'ollama-minimax-m3', messages: [{ role: 'user', content: 'hi' }] }),
      res,
      () => {
        throw new Error('next() non deve essere chiamato per /api/ai/chat');
      },
    );
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('OLLAMA_API_KEY');
    expect(body.error).not.toContain('json is not defined');
  });

  it('fallback Ollama con fetch in errore → 502 JSON strutturato', async () => {
    process.env.OLLAMA_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));
    const api = await loadApiMiddleware(async () => null);
    const res = mockRes();
    await api(
      mockReq('POST', '/api/ai/chat', { provider: 'ollama-minimax-m3', messages: [{ role: 'user', content: 'hi' }] }),
      res,
      () => {
        throw new Error('next() non deve essere chiamato per /api/ai/chat');
      },
    );
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/^Ollama error: /);
    expect(body.error).toContain('ECONNREFUSED');
    expect(body.error).not.toContain('json is not defined');
  });

  it('fallback Ollama con risposta upstream non-ok → passthrough status + errore Ollama', async () => {
    process.env.OLLAMA_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'upstream down' }),
    );
    const api = await loadApiMiddleware(async () => null);
    const res = mockRes();
    await api(
      mockReq('POST', '/api/ai/chat', { provider: 'ollama-minimax-m3', messages: [] }),
      res,
      () => {},
    );
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Ollama (500): upstream down');
  });

  it('fallback Ollama PROPAGA i tools dichiarati (verify analyze_site) — regressione 400', async () => {
    // Il verify precompila tool_calls nel body: senza tools dichiarati
    // Ollama risponde 400 "Value looks like object, but can't find
    // closing '}' symbol" (bug 2026-08-05, §26.18).
    process.env.OLLAMA_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('data: {"message":{"content":"ok"}}\ndata: {"done":true}\n', {
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = await loadApiMiddleware(async () => null);
    const res = mockRes();
    const messages = [
      { role: 'user', content: 'verifica' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'analyze_site', arguments: '{"part":"html"}' } }],
      },
      { role: 'tool', content: '{"ok":true,"issues":[]}', name: 'analyze_site', tool_call_id: 'analyze-html' },
    ];
    await api(
      mockReq('POST', '/api/ai/chat', {
        provider: 'ollama-minimax-m3',
        model: 'minimax-m3:cloud',
        messages,
        tools: [{ type: 'function', function: { name: 'analyze_site', description: 'd', parameters: {} } }],
        stream: true,
      }),
      res,
      () => {},
    );
    expect(res.statusCode).toBe(200);
    const upstreamCall = fetchMock.mock.calls[0];
    const upstreamBody = JSON.parse((upstreamCall[1] as RequestInit).body as string);
    // Il body upstream DEVE contenere i tools e i tool_calls precompilati
    expect(upstreamBody.tools).toBeDefined();
    expect(upstreamBody.tools[0].function.name).toBe('analyze_site');
    const withToolCalls = upstreamBody.messages.filter((m: any) => m.tool_calls);
    expect(withToolCalls).toHaveLength(1);
    expect(withToolCalls[0].content).toBe('');
    expect(withToolCalls[0].tool_calls[0].function.name).toBe('analyze_site');
  });

  it('TB-029 fix: /api/ai/card-cover passa costUsd Gemini (0.04) a ingestLangfuse', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini';
    const traceCalls: any[] = [];
    const api = await loadApiMiddleware(async (id: string) => {
      if (id === '/src/server/langfuse.ts') {
        return { ingestLangfuse: async (input: any) => { traceCalls.push(input); } };
      }
      if (id === '/src/ai/providers/gemini.ts') {
        return {
          GeminiImageProvider: class {
            async generateCardCover() {
              return { imageBase64: 'QUJD', mimeType: 'image/jpeg' };
            }
          },
        };
      }
      return null;
    });
    const res = mockRes();
    await api(
      mockReq('POST', '/api/ai/card-cover', { prompt: 'sfondo', userEmail: 'u@x.com' }),
      res,
      () => {},
    );
    expect(res.statusCode).toBe(200);
    expect(traceCalls.length).toBe(1);
    expect(traceCalls[0].name).toBe('card-cover');
    expect(traceCalls[0].costUsd).toBe(0.04);
    expect(traceCalls[0].subfeature).toBe('cover');
  });

  it('RAG: POST /api/ai/embeddings risponde embedding + trace observationType embedding', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini';
    const traceCalls: any[] = [];
    const api = await loadApiMiddleware(async (id: string) => {
      if (id === '/src/server/langfuse.ts') {
        return { ingestLangfuse: async (input: any) => { traceCalls.push(input); } };
      }
      return null;
    });
    const res = mockRes();
    await api(
      mockReq('POST', '/api/ai/embeddings', { input: 'pane e dolci sardi', userEmail: 'u@x.com', customerId: 'cust_1' }),
      res,
      () => { throw new Error('next() non deve essere chiamato per /api/ai/embeddings'); },
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.embedding).toEqual([0.5, 0.5]);
    expect(traceCalls.length).toBe(1);
    expect(traceCalls[0].name).toBe('embed-chunk');
    expect(traceCalls[0].observationType).toBe('embedding');
    expect(traceCalls[0].customerId).toBe('cust_1');
  });

  it('RAG: /api/ai/embeddings senza GEMINI_API_KEY → 503 strutturato', async () => {
    const api = await loadApiMiddleware(async () => null);
    delete process.env.GEMINI_API_KEY;
    delete process.env.VITE_GEMINI_API_KEY;
    const res = mockRes();
    await api(mockReq('POST', '/api/ai/embeddings', { input: 'test' }), res, () => {});
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toContain('GEMINI_API_KEY');
  });
});
