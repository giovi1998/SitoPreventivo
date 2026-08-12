import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIStreamChunk } from '../types';

let chatResponses: any[] = [];
let fakeProvider: any;
let fakeFallbackProvider: any = null;

vi.mock('../providers/registry', () => ({
  get providerRegistry() {
    return {
      getProvider: vi.fn((id: string) => (id === 'ollama-deepseek-v4-flash-0731' && fakeFallbackProvider ? fakeFallbackProvider : fakeProvider)),
      getDefaultId: vi.fn(() => 'mock'),
      getFallbackProvider: vi.fn(() => (fakeFallbackProvider ? { id: 'ollama-deepseek-v4-flash-0731', provider: fakeFallbackProvider } : null)),
      listProviders: vi.fn(() => [{ id: 'mock', name: 'Mock', model: 'mock-model', supportsStreaming: true, supportsTools: false }]),
    };
  },
}));

vi.mock('../../utils/dataService', () => ({
  default: { trackTokens: vi.fn() },
}));

import { WebsiteOrchestrator } from '../websiteOrchestrator';

const baseBrief = {
  businessName: 'Gelateria Chiccheria',
  sector: 'gelateria',
  description: 'Gelateria artigianale a Cagliari con gusti del giorno',
  tone: 'amichevole',
  target: 'giovani',
  pages: 'index',
  preferredColors: '#469bdb',
  font: 'Inter',
  cta: 'Assaggia la differenza',
  sections: 'hero, contatti',
  features: '',
  contacts: '',
  socials: [],
  mapsUrl: '',
  notes: '',
};

const usage = (promptTokens = 100, completionTokens = 50) => ({
  promptTokens,
  completionTokens,
  totalTokens: promptTokens + completionTokens,
});

const htmlNoHead = '<html><head><meta charset="UTF-8"><title>Home</title></head><body><h1>Benvenuto</h1></body></html>';

function setupMockProvider() {
  fakeProvider = {
    name: 'Mock',
    model: 'mock-model',
    supportsStreaming: true,
    supportsTools: false,
    chat: vi.fn(async () => {
      const r = chatResponses.shift() ?? { content: JSON.stringify({ css: '' }), usage: usage() };
      return r;
    }),
    stream: vi.fn(async function* () {
      const r = chatResponses.shift() ?? { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() };
      const content = typeof r.content === 'string' ? r.content : '';
      if (content) yield { type: 'content' as const, content } satisfies AIStreamChunk;
      yield { type: 'done' as const, usage: r.usage } satisfies AIStreamChunk;
    }),
  };
  return fakeProvider;
}

function setupFallbackProvider() {
  fakeFallbackProvider = {
    name: 'DeepSeek',
    model: 'deepseek-v4-flash',
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    chat: vi.fn(async () => {
      const r = chatResponses.shift() ?? { content: JSON.stringify({ css: '' }), usage: usage() };
      return r;
    }),
    stream: vi.fn(async function* () {
      const r = chatResponses.shift() ?? { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() };
      const content = typeof r.content === 'string' ? r.content : '';
      if (content) yield { type: 'content' as const, content } satisfies AIStreamChunk;
      yield { type: 'done' as const, usage: r.usage } satisfies AIStreamChunk;
    }),
  };
  return fakeFallbackProvider;
}

describe('WebsiteOrchestrator.generateSite', () => {
  let orch: WebsiteOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    chatResponses = [];
    fakeFallbackProvider = null;
    setupMockProvider();
    orch = new WebsiteOrchestrator();
  });
  it('happy path: 4 step, SEO meta iniettati, costo sommato', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage(10, 5) },
      { content: JSON.stringify({ css: 'body { color: red; }' }), usage: usage(20, 10) },
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage(20, 10) },
      { content: JSON.stringify({ issues: [] }), usage: usage(20, 10) },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock', userEmail: 'u@test.com' });
    expect(result.site.html).toContain('name="description"');
    expect(result.site.html).toContain('og:title');
    expect(result.site.pages).toEqual(['index']);
    expect(result.changes).toContain('seo:meta-injected');
    expect(result.changes).toContain('verify:ok');
    expect(result.verifyIssues).toBeUndefined();
    expect(result.aiCall?.costUsd).toBeGreaterThan(0);
    expect(result.site.css).toBe('body { color: red; }');
    expect(result.site.js).toBe('console.log(1);');
  });

  it('mappa: iframe AI senza città → forzato con indirizzo completo (no Monza/Rozzano)', async () => {
    const htmlWithBadMap = '<section id="contatti"><iframe src="https://www.google.com/maps?q=Via%20Dante%20Alighieri%205%2FA&output=embed" width="100%" height="400"></iframe></section>';
    chatResponses.push(
      { content: JSON.stringify({ html: htmlWithBadMap, pages: ['index'] }), usage: usage(10, 5) },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage(20, 10) },
      { content: JSON.stringify({ js: '// x' }), usage: usage(20, 10) },
      { content: JSON.stringify({ issues: [] }), usage: usage(20, 10) },
    );
    const briefWithContacts = { ...baseBrief, contacts: 'Via Dante Alighieri 5/A, Cagliari, 09124' };
    const result = await orch.generateSite(briefWithContacts, { modelId: 'mock', userEmail: 'u@test.com' });
    expect(result.site.html).toContain('q=Via%20Dante%20Alighieri%205%2FA%20Cagliari');
    expect(result.site.html).not.toContain('q=Via%20Dante%20Alighieri%205%2FA&');
    expect(result.site.html).toContain('title="Mappa"');
    expect(result.changes).toContain('map:iframe-forced');
  });

  it('hero: heroPrompts dal modello → generateHeroImages chiamato, hero-bg iniettato', async () => {
    const htmlWithHero = '<section id="hero" class="hero"><div class="section-inner"><h1>X</h1></div></section>';
    chatResponses.push(
      { content: JSON.stringify({ html: htmlWithHero, pages: ['index'], heroPrompts: ['Gelato artigianale su sfondo azzurro'] }), usage: usage(10, 5) },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage(20, 10) },
      { content: JSON.stringify({ js: '// x' }), usage: usage(20, 10) },
      { content: JSON.stringify({ issues: [] }), usage: usage(20, 10) },
    );
    const genHero = vi.fn(async () => 'data:image/jpeg;base64,HERO');
    const result = await orch.generateSite(baseBrief, { modelId: 'mock', userEmail: 'u@test.com', generateHeroImages: genHero });
    expect(genHero).toHaveBeenCalledWith('Gelato artigianale su sfondo azzurro');
    expect(result.heroImages).toHaveLength(1);
    expect(result.site.html).toContain('hero-bg');
    expect(result.site.html).toContain('data:image/jpeg;base64,HERO');
    expect(result.changes).toContain('hero:images:1');
  });

  it('hero: senza heroPrompts → nessuna chiamata immagine', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage(10, 5) },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage(20, 10) },
      { content: JSON.stringify({ js: '// x' }), usage: usage(20, 10) },
      { content: JSON.stringify({ issues: [] }), usage: usage(20, 10) },
    );
    const genHero = vi.fn(async () => 'data:image/jpeg;base64,HERO');
    const result = await orch.generateSite(baseBrief, { modelId: 'mock', userEmail: 'u@test.com', generateHeroImages: genHero });
    expect(genHero).not.toHaveBeenCalled();
    expect(result.heroImages).toHaveLength(0);
  });

  it('fallback: primario 500 → Ollama 0731, sito generato comunque', async () => {    setupFallbackProvider();
    fakeProvider.stream = vi.fn(async function* () {
      throw new Error('Ollama (500): Internal Server Error');
    });
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage(10, 5) },
      { content: JSON.stringify({ css: 'body { color: red; }' }), usage: usage(20, 10) },
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage(20, 10) },
      { content: JSON.stringify({ issues: [] }), usage: usage(20, 10) },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock', userEmail: 'u@test.com' });
    expect(result.site.html).toContain('name="description"');
    expect(result.site.css).toBe('body { color: red; }');
    expect(result.changes.some((c) => c.startsWith('fallback:ollama-deepseek-v4-flash-0731'))).toBe(true);
    expect(result.changes).toContain('fallback:html:ok');
  });

  it('verify issues + fixes: applica le correzioni al codice finale', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: '.a { display: flex;' }), usage: usage() },  // CSS rotto (parentesi non chiusa)
      { content: JSON.stringify({ js: 'console.log("old");' }), usage: usage() },
      {
        content: JSON.stringify({
          issues: ['css rotto'],
          fixes: { css: '.a { display: flex; }' },
        }),
        usage: usage(),
      },
      { content: JSON.stringify({ issues: [] }), usage: usage() }, // recheck → ok
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    // Solo il CSS era rotto (tool ok=false) → solo il fix CSS applicato
    expect(result.site.css).toBe('.a { display: flex; }');
    expect(result.verifyIssues).toBeUndefined(); // recheck pulito → nessun problema residuo
    expect(result.verifyFixesApplied).toEqual(['css']);
    expect(result.changes).toContain('verify:css:fixed');
  });

  it('verify: messaggio user include i risultati analyze_site, nessun tool_calls', async () => {
    fakeProvider.supportsTools = true;
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage() },
      { content: JSON.stringify({ js: '' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    let verifyUserContent = '';
    let verifyMessages: any[] = [];
    fakeProvider.stream.mockImplementation(async function* (messages: any[]) {
      const userMsg = messages.find((m: any) => m.role === 'user' && String(m.content).includes('RISULTATI ANALISI'));
      if (userMsg) {
        verifyUserContent = String(userMsg.content);
        verifyMessages = messages;
      }
      const r = chatResponses.shift() ?? { content: JSON.stringify({ issues: [] }), usage: usage() };
      const content = typeof r.content === 'string' ? r.content : '';
      if (content) yield { type: 'content' as const, content };
      yield { type: 'done' as const, usage: r.usage };
    });
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.changes).toContain('verify:ok');
    // I risultati deterministici sono nel prompt user (non tool_calls):
    // nessun formato tool da validare → nessun 400 Ollama/DeepSeek.
    expect(verifyUserContent).toContain('analyze_site("html")');
    expect(verifyUserContent).toContain('analyze_site("css")');
    expect(verifyUserContent).toContain('analyze_site("js")');
    // Nessun messaggio con tool_calls né opzioni tools nella chiamata verify
    expect(verifyMessages.some((m: any) => m.toolCalls)).toBe(false);
    const verifyStreamOpts = fakeProvider.stream.mock.calls.find((c: any[]) =>
      c[0].some((m: any) => String(m.content).includes('RISULTATI ANALISI'))
    )?.[1];
    expect(verifyStreamOpts?.tools).toBeUndefined();
    expect(verifyStreamOpts?.responseFormat).toEqual({ type: 'json_object' });
    expect(result.site.html).toContain('Benvenuto');
  });

  it('verify: errore → best-effort, sito comunque restituito', async () => {
    fakeProvider.supportsTools = true;
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage() },
      { content: JSON.stringify({ js: '' }), usage: usage() },
    );
    // stream: html(1), css(2), js(3), verify(4) fallisce
    let streamCalls = 0;
    fakeProvider.stream.mockImplementation(async function* () {
      streamCalls++;
      if (streamCalls === 4) {
        yield { type: 'error', error: 'Ollama (400): can\'t find closing \'}\' symbol' };
        return;
      }
      const r = chatResponses.shift() ?? { content: JSON.stringify({ issues: [] }), usage: usage() };
      const content = typeof r.content === 'string' ? r.content : '';
      if (content) yield { type: 'content' as const, content };
      yield { type: 'done' as const, usage: r.usage };
    });
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.site.html).toContain('Benvenuto');
    expect(result.site.css).toBe('body{}');
    expect(result.changes.some((c) => c.startsWith('verify:error:'))).toBe(true);
    expect(result.verifyIssues).toBeUndefined();
  });

  it('CSS fallito (timeout/502) → sito generato senza CSS, changes error:css', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    // stream: html(1), css(2) fallisce, js(3), verify(4)
    let streamCalls = 0;
    fakeProvider.stream.mockImplementation(async function* () {
      streamCalls++;
      if (streamCalls === 2) {
        yield { type: 'error', error: 'Ollama (502): Ollama error: This operation was aborted' };
        return;
      }
      const r = chatResponses.shift() ?? { content: JSON.stringify({ issues: [] }), usage: usage() };
      const content = typeof r.content === 'string' ? r.content : '';
      if (content) yield { type: 'content' as const, content };
      yield { type: 'done' as const, usage: r.usage };
    });
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.site.html).toContain('Benvenuto');
    expect(result.site.css).toBe('');
    expect(result.site.js).toBe('console.log(1);');
    expect(result.changes.some((c) => c.startsWith('error:css:'))).toBe(true);
    expect(result.changes).toContain('verify:ok');
  });

  it('JS fallito → sito generato senza JS, changes error:js', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    let streamCalls = 0;
    fakeProvider.stream.mockImplementation(async function* () {
      streamCalls++;
      if (streamCalls === 3) {
        yield { type: 'error', error: 'Ollama (502): aborted' };
        return;
      }
      const r = chatResponses.shift() ?? { content: JSON.stringify({ issues: [] }), usage: usage() };
      const content = typeof r.content === 'string' ? r.content : '';
      if (content) yield { type: 'content' as const, content };
      yield { type: 'done' as const, usage: r.usage };
    });
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.site.html).toContain('Benvenuto');
    expect(result.site.css).toBe('body{}');
    expect(result.site.js).toBe('');
    expect(result.changes.some((c) => c.startsWith('error:js:'))).toBe(true);
  });

  it('pagina secondaria fallita → index ok, changes error:page:about', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index', 'about'] }), usage: usage() },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage() },
      { content: JSON.stringify({ js: '' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    // stream: html(1), page:about(2) fallisce, css(3), js(4), verify(5)
    let streamCalls = 0;
    fakeProvider.stream.mockImplementation(async function* () {
      streamCalls++;
      if (streamCalls === 2) {
        yield { type: 'error', error: 'Ollama (502): aborted' };
        return;
      }
      const r = chatResponses.shift() ?? { content: JSON.stringify({ issues: [] }), usage: usage() };
      const content = typeof r.content === 'string' ? r.content : '';
      if (content) yield { type: 'content' as const, content };
      yield { type: 'done' as const, usage: r.usage };
    });
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.site.html).toContain('Benvenuto');
    expect(result.site.pagesHtml['about']).toBeUndefined();
    expect(result.changes.some((c) => c.startsWith('error:page:about'))).toBe(true);
    expect(result.changes).toContain('verify:ok');
  });

  it('verify: fix AI su parte VALIDA viene rifiutato (tool = fonte di verità)', async () => {
    fakeProvider.supportsTools = true;
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: 'body { color: red; }' }), usage: usage() },
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage() },
      {
        content: JSON.stringify({
          issues: ['HTML troncato', 'CSS troncato', 'JS troncato'],
          fixes: { html: '<h1>PERSA LA MAPPA</h1>', css: 'body{}', js: '// perso' },
        }),
        usage: usage(),
      },
      { content: JSON.stringify({ issues: ['ancora troncato'] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    // I fix dell'AI erano RISCITTURE distruttive: `<h1>PERSA LA MAPPA</h1>`
    // è HTML valido ma corto (<50% dell'originale → perde mappa/contatti) →
    // rifiutato. CSS/JS identici all'originale → niente changes.
    expect(result.site.html).toContain('Benvenuto');
    expect(result.site.html).not.toContain('PERSA LA MAPPA');
    expect(result.site.css).toBe('body { color: red; }');
    expect(result.site.js).toBe('console.log(1);');
    expect(result.verifyFixesApplied).toBeUndefined();
    expect(result.changes.some((c) => c.startsWith('verify:html:fixed'))).toBe(false);
    // Recheck deterministico: tutto integro → nessun problema residuo
    expect(result.verifyIssues).toBeUndefined();
    expect(result.changes).toContain('verify:recheck:ok');
  });

  it('verify: fix applicato SOLO sulla parte realmente rotta (css non bilanciato)', async () => {
    fakeProvider.supportsTools = true;
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: '.nav { display: flex;' }), usage: usage() },
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage() },
      {
        content: JSON.stringify({
          issues: ['CSS troncato', 'HTML troncato'],
          fixes: { html: '<h1>FIX HTML</h1>', css: '.nav { display: flex; }', js: '// x' },
        }),
        usage: usage(),
      },
      { content: JSON.stringify({ issues: ['css rotto'] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    // CSS aveva parentesi non chiuse → fix CSS (valido + lungo) applicato
    expect(result.site.css).toBe('.nav { display: flex; }');
    expect(result.verifyFixesApplied).toEqual(['css']);
    expect(result.changes).toContain('verify:css:fixed');
    // HTML integro ma fix `<h1>FIX HTML</h1>` troppo corto (<50%) → rifiutato,
    // contenuto originale preservato
    expect(result.site.html).toContain('Benvenuto');
    expect(result.site.html).not.toContain('FIX HTML');
    expect(result.changes.some((c) => c.startsWith('verify:html:fixed'))).toBe(false);
    // Recheck: css fixato ora bilanciato → tutto ok
    expect(result.verifyIssues).toBeUndefined();
    expect(result.changes).toContain('verify:recheck:ok');
  });

  it('verify issues senza fixes: codice invariato, recheck deterministico pulito', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage() },
      { content: JSON.stringify({ js: '' }), usage: usage() },
      { content: JSON.stringify({ issues: ['manca alt'] }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.site.html).toContain('og:title');
    expect(result.site.css).toBe('body{}');
    expect(result.verifyFixesApplied).toBeUndefined();
    expect(result.changes.some((c) => c.startsWith('verify:1issues'))).toBe(true);
    // Codice integro secondo il tool → nessun problema residuo mostrato
    expect(result.verifyIssues).toBeUndefined();
  });

  it('verify: risultati analyze_site nel messaggio user, nessun tool_calls né tools (niente 400)', async () => {
    fakeProvider.supportsTools = true;
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: 'body { color: red; }' }), usage: usage() },
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.changes).toContain('verify:ok');
    expect(result.verifyIssues).toBeUndefined();
    // La chiamata verify (stream, con RISULTATI ANALISI nel prompt) NON deve
    // avere tool_calls/tools: il formato tool di Ollama (arguments object,
    // tool_name) diverge da DeepSeek → i tool_calls precompilati causavano
    // il 400. Ora i risultati sono nel prompt user.
    const verifyCall = fakeProvider.stream.mock.calls.find((c: any[]) =>
      c[0].some((m: any) => String(m.content).includes('RISULTATI ANALISI'))
    );
    expect(verifyCall).toBeDefined();
    const messages = verifyCall![0];
    expect(messages.some((m: any) => m.toolCalls)).toBe(false);
    expect(verifyCall![1].tools).toBeUndefined();
    expect(verifyCall![1].responseFormat).toEqual({ type: 'json_object' });
    // Il messaggio user contiene i risultati deterministici
    const userMsg = messages.find((m: any) => m.role === 'user');
    expect(String(userMsg.content)).toContain('RISULTATI ANALISI DETERMINISTICA');
    expect(String(userMsg.content)).toContain('analyze_site("html")');
  });

  it('verify loop: secondo pass recheck deterministico → ok (issue del modello scartate)', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: '.a { display: flex;' }), usage: usage() }, // CSS rotto
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage() },
      { content: JSON.stringify({ issues: ['contrasto basso'], fixes: { css: '.a { display: flex; }' } }), usage: usage() },
      { content: JSON.stringify({ issues: ['ancora un problema'] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.site.css).toBe('.a { display: flex; }');
    expect(result.changes).toContain('verify:css:fixed');
    // Il codice fixato è integro secondo il tool → le issue del modello
    // ("ancora un problema") vengono scartate, nessun pannello allarmi
    expect(result.verifyIssues).toBeUndefined();
    expect(result.changes).toContain('verify:recheck:ok');
  });

  it('verify loop: recheck deterministico fallito → issue residue REALI nel pannello', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: '.a { display: flex;' }), usage: usage() },
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage() },
      { content: JSON.stringify({ issues: ['css troncato'], fixes: { css: '.a { display: flex; color: red' } }), usage: usage() },
      { content: JSON.stringify({ issues: ['css ancora rotto'] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    // Il fix del modello era ANCHE lui rotto (parentesi non chiusa) → rifiutato
    expect(result.changes.some((c) => c.startsWith('verify:css:fixed'))).toBe(false);
    // Il recheck deterministico trova ancora parentesi non chiuse → issue REALI
    expect(result.changes.some((c) => c.startsWith('verify:recheck:'))).toBe(true);
    expect(result.verifyIssues?.length).toBeGreaterThan(0);
    expect(result.verifyIssues![0]).toContain('parentesi');
    expect(result.site.css).toBe('.a { display: flex;');
  });

  it('verify loop: secondo pass pulito → verify:ok (fix risolti)', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: '.a { display: flex;' }), usage: usage() }, // CSS rotto
      { content: JSON.stringify({ js: 'console.log(1);' }), usage: usage() },
      { content: JSON.stringify({ issues: ['contrasto basso'], fixes: { css: '.a { display: flex; }' } }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.changes).toContain('verify:css:fixed');
    expect(result.changes).toContain('verify:ok');
    expect(result.verifyIssues).toBeUndefined(); // recheck pulito → problemi risolti, niente pannello
    expect(result.verifyFixesApplied).toEqual(['css']);
  });

  it('html non JSON → fallbackResult con nome attività', async () => {
    chatResponses.push({ content: 'non-json', usage: usage() });
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.changes.some((c) => c.startsWith('error:html:'))).toBe(true);
    expect(result.site.html).toContain('Gelateria Chiccheria');
    expect(result.site.pages).toEqual(['index']);
  });

  it('onStep/onStepResult chiamati per i 4 step', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index'] }), usage: usage() },
      { content: JSON.stringify({ css: '' }), usage: usage() },
      { content: JSON.stringify({ js: '' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    const steps: string[] = [];
    await orch.generateSite(baseBrief, {
      modelId: 'mock',
      onStep: (s) => steps.push(s),
      onStepResult: (s, _c, meta) => { expect(meta.durationMs).toBeGreaterThanOrEqual(0); },
    });
    expect(steps).toEqual(['html', 'css', 'js', 'verify']);
  });

  it('multi-pagina: genera HTML dedicato per le pagine secondarie', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index', 'about'] }), usage: usage() },
      { content: JSON.stringify({ html: '<html><head><title>Chi siamo</title></head><body><h1>Chi siamo</h1><nav class="nav"><div class="nav-inner"><div class="brand">Nome</div><ul class="nav-links"><li><a href="index.html">Home</a></li></ul></div></nav></body></html>' }), usage: usage() },
      { content: JSON.stringify({ css: 'body{}' }), usage: usage() },
      { content: JSON.stringify({ js: '' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    const steps: string[] = [];
    const result = await orch.generateSite(baseBrief, {
      modelId: 'mock',
      onStep: (s) => steps.push(s),
    });
    expect(steps).toEqual(['html', 'page:about', 'css', 'js', 'verify']);
    expect(result.site.pages).toEqual(['index', 'about']);
    expect(result.site.pagesHtml['about']).toContain('Chi siamo');
    expect(result.site.pagesHtml['about']).toContain('name="description"');
    expect(result.changes).toContain('page:about:generated');
  });

  it('multi-pagina: pagina fallita → changes error, altre pagine intatte', async () => {
    chatResponses.push(
      { content: JSON.stringify({ html: htmlNoHead, pages: ['index', 'about', 'contact'] }), usage: usage() },
      { content: 'non-json', usage: usage() },
      { content: JSON.stringify({ html: '<h1>Contatti</h1>' }), usage: usage() },
      { content: JSON.stringify({ css: '' }), usage: usage() },
      { content: JSON.stringify({ js: '' }), usage: usage() },
      { content: JSON.stringify({ issues: [] }), usage: usage() },
    );
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.changes).toContain('error:page:about');
    expect(result.changes).toContain('page:contact:generated');
    expect(result.site.pagesHtml['about']).toBeUndefined();
    expect(result.site.pagesHtml['contact']).toContain('Contatti');
  });
});

describe('WebsiteOrchestrator.refineSite', () => {
  let orch: WebsiteOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    chatResponses = [];
    setupMockProvider();
    orch = new WebsiteOrchestrator();
  });

  const site = { html: '<h1>X</h1>', css: 'body{}', js: '// x', pages: ['index'], pagesHtml: {} };

  it('merge parziale: solo i campi presenti cambiano', async () => {
    chatResponses.push({ content: JSON.stringify({ css: 'body { color: blue; }' }), usage: usage() });
    const result = await orch.refineSite(site, 'cambia colore', { modelId: 'mock' });
    expect(result.site.css).toBe('body { color: blue; }');
    expect(result.site.html).toBe('<h1>X</h1>');
    expect(result.site.js).toBe('// x');
    expect(result.changes.some((c) => c.startsWith('refine:css:changed'))).toBe(true);
    expect(result.changes.some((c) => c.startsWith('refine:html:'))).toBe(false);
  });

  it('refine: pagesHtml merge parziale con le pagine secondarie nel prompt', async () => {
    const multiSite = { html: '<h1>X</h1>', css: 'body{}', js: '// x', pages: ['index', 'about'], pagesHtml: { about: '<h1>Chi siamo</h1>' } };
    let promptText = '';
    chatResponses.push({ content: JSON.stringify({ pagesHtml: { about: '<h1>Chi siamo aggiornato</h1>' } }), usage: usage() });
    const result = await orch.refineSite(multiSite, 'aggiorna about', { modelId: 'mock', onStep: (_s, t) => { promptText = t; } });
    expect(result.site.pagesHtml['about']).toBe('<h1>Chi siamo aggiornato</h1>');
    expect(result.site.html).toBe('<h1>X</h1>');
    expect(promptText).toContain('### HTML about');
    expect(promptText).toContain('pagesHtml');
    expect(result.changes.some((c) => c.startsWith('refine:pagesHtml:changed'))).toBe(true);
  });

  it('JSON invalido → sito invariato + changes error', async () => {
    chatResponses.push({ content: 'non-json', usage: usage() });
    const result = await orch.refineSite(site, 'cambia', { modelId: 'mock' });
    expect(result.site).toEqual(site);
    expect(result.changes.some((c) => c.startsWith('error:'))).toBe(true);
  });

  it('multi-pagina fallbackResult: pagesHtml vuoto', async () => {
    chatResponses.push({ content: 'non-json', usage: usage() });
    const result = await orch.generateSite(baseBrief, { modelId: 'mock' });
    expect(result.site.pagesHtml).toEqual({});
  });

  it('onStep refine chiamato', async () => {
    chatResponses.push({ content: JSON.stringify({}), usage: usage() });
    const steps: string[] = [];
    await orch.refineSite(site, 'cambia', { modelId: 'mock', onStep: (s) => steps.push(s) });
    expect(steps).toEqual(['refine']);
  });

  it('refine: HTML riscritto drasticamente più corto → rifiutato, originale mantenuto', async () => {
    const bigSite = { html: '<h1>X</h1>'.repeat(1000), css: 'body{}', js: '// x', pages: ['index'], pagesHtml: {} };
    chatResponses.push({ content: JSON.stringify({ html: '<h1>X</h1>' }), usage: usage() });
    const result = await orch.refineSite(bigSite, 'rinomina brand', { modelId: 'mock' });
    expect(result.site.html).toBe(bigSite.html);
    expect(result.changes.some((c) => c.startsWith('refine:html:rejected'))).toBe(true);
  });
});
