import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/dataService', () => ({
  default: {
    getDeepseekKey: vi.fn().mockResolvedValue('test-key'),
    chatWithAI: vi.fn(),
    streamChat: vi.fn(),
    trackTokens: vi.fn(),
  },
}));

import { WebsiteOrchestrator } from '../websiteOrchestrator';

const originalLocation = globalThis.window?.location;
function setWindowLocation(hostname: string) {
  // @ts-expect-error - test override
  if (!globalThis.window) globalThis.window = {};
  // @ts-expect-error - test override
  globalThis.window.location = { hostname, origin: `http://${hostname}`, href: `http://${hostname}/` };
}

const brief = {
  businessName: 'Panetteria Test',
  sector: 'food',
  description: 'Panetteria artigianale con forno a legna',
  tone: 'caldo',
  target: 'famiglie',
  pages: 'index',
  preferredColors: '',
  font: '',
  cta: 'Ordina ora',
  sections: 'hero, contatti',
  features: '',
  contacts: '',
  socials: [],
  mapsUrl: '',
  notes: '',
};

const htmlOk = '<html><head><meta charset="UTF-8"><title>Panetteria</title></head><body><header class="nav"><div class="nav-inner"><div class="brand">Nome</div><button class="menu-toggle" aria-label="Apri menu">Menu</button><ul class="nav-links"><li><a href="index.html">Home</a></li></ul></div></header><main><h1>Ciao</h1><section id="contatti"><h2>Contatti</h2><form><input type="email" placeholder="Email"></form></section></main><footer><p><span class="current-year">2026</span></p></footer></body></html>';
const usage = (p = 100, c = 50) => ({ prompt_tokens: p, completion_tokens: c, total_tokens: p + c });

const PROVIDERS = [
  { id: 'ollama-deepseek-v4-flash-0731', label: 'ollama v4 flash 0731' },
  { id: 'ollama-minimax-m3', label: 'ollama minimax m3' },
  { id: 'deepseek-v4-flash', label: 'deepseek v4 flash' },
];

describe('generateSite flusso completo — matrice 3 provider', () => {
  beforeEach(() => {
    setWindowLocation('localhost');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalLocation) {
      // @ts-expect-error - restore
      globalThis.window.location = originalLocation;
    } else {
      // @ts-expect-error - cleanup
      delete globalThis.window;
    }
  });

  for (const { id, label } of PROVIDERS) {
    it(`${label}: sito completo (tutti gli step via SSE stream, verify con risultati nel prompt)`, async () => {
      const queue = [
        JSON.stringify({ html: htmlOk, pages: ['index'] }), // html
        JSON.stringify({ css: 'body { color: #000; }' }),   // css
        JSON.stringify({ js: 'console.log(1);' }),          // js
      ];
      let n = 0;
      const state = { requestsWithTools: 0, requestsWithToolCalls: 0 };
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: RequestInit) => {
        const u = String(url);
        n++;
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        // Tutti gli step usano SSE (body.stream true): CSS/JS/Verify
        // inclusi — limite 300s Hobby (sincrone = 60s, auto-build PROD).
        const isStreamRequest = !!body?.stream;
        if (isStreamRequest) {
          if (Array.isArray(body?.tools) && body.tools.length > 0) state.requestsWithTools++;
          if (body.messages.some((m: any) => m.tool_calls)) state.requestsWithToolCalls++;
          const contentPayload = JSON.stringify(queue[n - 1] ?? JSON.stringify({ fixes: {} }));
          const sseBody = [
            `data: {"choices":[{"delta":{"content":${contentPayload}}}]}`,
            `data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
            'data: [DONE]',
            '',
          ].join('\n');
          return new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: queue[n - 1] ?? JSON.stringify({ fixes: {} }) } }],
          usage: usage(),
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const orch = new WebsiteOrchestrator();
      const streamed: string[] = [];
      const result = await orch.generateSite(brief, {
        modelId: id,
        userEmail: 'u@test.com',
        onStream: (chunk) => { if (chunk.type === 'content' && chunk.content) streamed.push(chunk.content); },
      });
      expect(streamed.length).toBeGreaterThan(0);
      expect(result.site.html).toContain('Ciao');
      expect(result.site.css).toBe('body { color: #000; }');
      expect(result.site.js).toBe('console.log(1);');
      expect(result.site.pages).toEqual(['index']);
      expect(result.changes).toContain('verify:ok');
      expect(result.verifyIssues).toBeUndefined();
      // NESSUN tools/tool_calls nelle richieste AI: il fix agent lavora su
      // prompt testuale (solo parti rotte), mai tool_calls → niente 400
      // Ollama/DeepSeek (formato tool diverge). Codice integro → verify
      // zero-AI: 3 chiamate totali (html, css, js), nessun fix agent.
      expect(state.requestsWithTools).toBe(0);
      expect(state.requestsWithToolCalls).toBe(0);
      expect(n).toBe(3);
    });

    it(`${label}: verify con issue → fix agent (solo parte rotta), recheck ok`, async () => {
      // CSS con ::after content emoji: repair deterministico NON lo risolve
      // (parentesi bilanciate) → serve il fix agent (una sola chiamata).
      const brokenCss = '.btn::after { content: "\\1F366"; }';
      const fixedCss = '.btn::after { content: ""; }';
      const queue = [
        JSON.stringify({ html: htmlOk, pages: ['index'] }), // html
        JSON.stringify({ css: brokenCss }),                  // css
        JSON.stringify({ js: 'console.log(1);' }),           // js
        JSON.stringify({ fixes: { css: fixedCss } }),        // fix agent
      ];
      let n = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: RequestInit) => {
        const u = String(url);
        n++;
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        // Tutti gli step su SSE (vedi test sopra)
        if (!!body?.stream) {
          const contentPayload = JSON.stringify(queue[n - 1] ?? JSON.stringify({ fixes: {} }));
          const sseBody = [
            `data: {"choices":[{"delta":{"content":${contentPayload}}}]}`,
            'data: [DONE]',
            '',
          ].join('\n');
          return new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: queue[n - 1] ?? JSON.stringify({ fixes: {} }) } }],
          usage: usage(),
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const orch = new WebsiteOrchestrator();
      const result = await orch.generateSite(brief, { modelId: id, userEmail: 'u@test.com' });
      expect(result.site.html).toContain('Ciao');
      expect(result.site.css).toBe(fixedCss);
      expect(result.verifyFixesApplied).toEqual(['css']);
      expect(result.changes).toContain('verify:css:fixed');
      expect(result.changes).toContain('verify:ok');
      expect(result.verifyIssues).toBeUndefined();
      // html(1) + css(2) + js(3) + fix agent(4): una sola chiamata AI verify
      expect(n).toBe(4);
    });
  }
});
