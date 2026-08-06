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

const htmlOk = '<html><head><meta charset="UTF-8"><title>Panetteria</title></head><body><h1>Ciao</h1></body></html>';
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
        JSON.stringify({ issues: [] }),                     // verify
      ];
      let n = 0;
      const state = { verifyHasTools: true, verifyHasToolCalls: true, verifyHasAnalyzeInPrompt: false };
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: RequestInit) => {
        const u = String(url);
        n++;
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        // Tutti gli step usano SSE (body.stream true): CSS/JS/Verify
        // inclusi — limite 300s Hobby (sincrone = 60s, auto-build PROD).
        const isStreamRequest = !!body?.stream;
        if (isStreamRequest) {
          if (n === 4) {
            state.verifyHasTools = Array.isArray(body?.tools) && body.tools.length > 0;
            state.verifyHasToolCalls = body.messages.some((m: any) => m.tool_calls);
            state.verifyHasAnalyzeInPrompt = body.messages.some((m: any) => m.role === 'user' && String(m.content).includes('RISULTATI ANALISI'));
          }
          const contentPayload = JSON.stringify(queue[n - 1] ?? JSON.stringify({ issues: [] }));
          const sseBody = [
            `data: {"choices":[{"delta":{"content":${contentPayload}}}]}`,
            `data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
            'data: [DONE]',
            '',
          ].join('\n');
          return new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: queue[n - 1] ?? JSON.stringify({ issues: [] }) } }],
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
      // NESSUN tools/tool_calls nella richiesta verify (formato Ollama vs
      // DeepSeek diverge → 400): i risultati analyze_site sono nel prompt
      // user. Questa è la garanzia anti-400.
      expect(state.verifyHasTools).toBe(false);
      expect(state.verifyHasToolCalls).toBe(false);
      expect(state.verifyHasAnalyzeInPrompt).toBe(true);
    });

    it(`${label}: verify con issue → fix applicato solo su parte rotta`, async () => {
      // css rotto (parentesi non chiuse) → fix CSS; html/js integri → rifiutati
      const brokenCss = '.nav { display: flex;';
      const fixedCss = '.nav { display: flex; }';
      const queue = [
        JSON.stringify({ html: htmlOk, pages: ['index'] }), // html
        JSON.stringify({ css: brokenCss }),                  // css
        JSON.stringify({ js: 'console.log(1);' }),           // js
        JSON.stringify({ issues: ['css rotto'], fixes: { css: fixedCss } }), // verify pass1
        JSON.stringify({ issues: [] }),                      // verify recheck → ok
      ];
      let n = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: RequestInit) => {
        const u = String(url);
        n++;
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        // Tutti gli step su SSE (vedi test sopra)
        if (!!body?.stream) {
          const contentPayload = JSON.stringify(queue[n - 1] ?? JSON.stringify({ issues: [] }));
          const sseBody = [
            `data: {"choices":[{"delta":{"content":${contentPayload}}}]}`,
            'data: [DONE]',
            '',
          ].join('\n');
          return new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: queue[n - 1] ?? JSON.stringify({ issues: [] }) } }],
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
    });
  }
});
