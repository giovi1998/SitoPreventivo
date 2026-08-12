import { describe, it, expect, vi, beforeEach } from 'vitest';

let fakeProvider: any;
const chatResponses: any[] = [];

vi.mock('../providers/registry', () => ({
  get providerRegistry() {
    return {
      getProvider: vi.fn(() => fakeProvider),
      getDefaultId: vi.fn(() => 'mock'),
      getFallbackProvider: vi.fn(() => null),
      listProviders: vi.fn(() => [{ id: 'mock', name: 'Mock', model: 'mock-model', supportsStreaming: true, supportsTools: true }]),
    };
  },
}));

const mockGenerateLogo = vi.fn();
const mockProcessPrompt = vi.fn();
const mockGenerateCopy = vi.fn();
const mockGenerateSite = vi.fn();

vi.mock('../logoOrchestrator', () => ({
  LogoAIOrchestrator: class { generateLogo = mockGenerateLogo; },
}));
vi.mock('../cardOrchestrator', () => ({
  CardAIOrchestrator: class { processPrompt = mockProcessPrompt; },
}));
vi.mock('../flyerOrchestrator', () => ({
  FlyerAIOrchestrator: class { generateCopy = mockGenerateCopy; },
}));
vi.mock('../websiteOrchestrator', () => ({
  WebsiteOrchestrator: class { generateSite = mockGenerateSite; },
}));

import { AgentOrchestrator, type AgentBrief, type AgentDoc } from '../agentOrchestrator';

const brief: AgentBrief = {
  businessName: 'Pizzeria Da Gigi',
  sector: 'ristorazione',
  description: 'Pizzeria artigianale nel centro di Cagliari, forno a legna, ingredienti locali.',
  tone: 'giovanile',
  target: 'giovani e famiglie',
  preferredColors: '#E62020',
  cta: 'Prenota un tavolo',
  contacts: 'via Roma 1, Cagliari',
  pages: 'index',
  features: '',
  socials: ['instagram'],
  notes: '',
};

const docs: AgentDoc = {
  logo: { builder: {} } as any,
  card: { front: {}, back: {}, style: {} } as any,
  flyer: { content: {}, style: {}, size: 'A5' } as any,
};

const usage = () => ({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });

function setupMockProvider() {
  fakeProvider = {
    name: 'Mock',
    model: 'mock-model',
    supportsStreaming: true,
    supportsTools: true,
    chat: vi.fn(async () => {
      const r = chatResponses.shift() ?? { content: 'fatto', usage: usage() };
      return r;
    }),
    stream: vi.fn(async function* () {
      const r = chatResponses.shift() ?? { content: 'fatto', usage: usage() };
      if (r.toolCalls) {
        yield { type: 'tool_call', toolCall: r.toolCalls[0] };
      }
      if (r.content) yield { type: 'content', content: r.content };
      yield { type: 'done', usage: r.usage };
    }),
  };
}

beforeEach(() => {
  chatResponses.length = 0;
  setupMockProvider();
  mockGenerateLogo.mockReset();
  mockProcessPrompt.mockReset();
  mockGenerateCopy.mockReset();
  mockGenerateSite.mockReset();
  mockGenerateLogo.mockResolvedValue({
    applied: true,
    selected: 0,
    changes: 'ok',
    concepts: [{ primaryText: 'Gigi', layout: 'centered' }],
    response: { usage: usage() },
  });
  mockProcessPrompt.mockResolvedValue({
    card: { front: {}, back: {}, style: { layout: 'left', bgColor: '#fff', accentColor: '#E62020' } },
    response: { usage: usage() },
    changes: [],
  });
  mockGenerateCopy.mockResolvedValue({
    applied: true,
    changes: 'ok',
    flyer: { content: { headline: 'Pizza vera' } },
    response: { usage: usage() },
  });
  mockGenerateSite.mockResolvedValue({
    site: { html: '<h1>x</h1>', css: 'body{}', js: '//', pages: ['index'], pagesHtml: {} },
    response: { usage: usage() },
  });
});

describe('AgentOrchestrator (T9)', () => {
  it('esegue i tool pianificati dal modello e ritorna i risultati', async () => {
    chatResponses.push(
      {
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'generate_logo', arguments: '{}' } }],
        content: '',
        usage: usage(),
      },
      { content: 'fatto', usage: usage() },
    );

    const agent = new AgentOrchestrator();
    const toolResults: any[] = [];
    const { results } = await agent.run(brief, docs, {}, { onToolResult: (r) => toolResults.push(r) });

    expect(mockGenerateLogo).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('generate_logo');
    expect(results[0].ok).toBe(true);
    expect(results[0].summary).toContain('Gigi');
    expect(toolResults).toHaveLength(1);
  });

  it('propaga runTrace (runId/rootSpanId/stepName) agli orchestratori', async () => {
    chatResponses.push(
      {
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'generate_card', arguments: '{}' } }],
        content: '',
        usage: usage(),
      },
      { content: 'fatto', usage: usage() },
    );

    const agent = new AgentOrchestrator();
    await agent.run(brief, docs, {
      runTrace: { runId: 'a'.repeat(32), runName: 'auto-build', startRun: true, rootSpanId: 'b'.repeat(16) },
    });

    const opts = mockProcessPrompt.mock.calls[0][2];
    expect(opts.runId).toBe('a'.repeat(32));
    expect(opts.rootSpanId).toBe('b'.repeat(16));
    expect(opts.stepName).toBe('card');
    expect(opts.stepSpanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('gestisce un tool che fallisce (ok=false) senza crash', async () => {
    mockGenerateCopy.mockResolvedValue({ applied: false, changes: 'schema_fail', flyer: docs.flyer, response: { usage: usage() } });
    chatResponses.push(
      {
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'generate_flyer', arguments: '{}' } }],
        content: '',
        usage: usage(),
      },
      { content: 'fatto', usage: usage() },
    );

    const agent = new AgentOrchestrator();
    const { results } = await agent.run(brief, docs, {});
    expect(results[0].ok).toBe(false);
    expect(results[0].summary).toContain('schema_fail');
  });

  it('si ferma quando il modello non chiama più tool', async () => {
    chatResponses.push(
      { content: 'risposta finale senza tool', usage: usage() },
    );

    const agent = new AgentOrchestrator();
    const { results, response } = await agent.run(brief, docs, {});
    expect(results).toHaveLength(0);
    expect(response.content).toBe('risposta finale senza tool');
    expect(mockGenerateLogo).not.toHaveBeenCalled();
  });

  it('rispetta il filtro include (solo logo)', async () => {
    chatResponses.push(
      {
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'generate_card', arguments: '{}' } }],
        content: '',
        usage: usage(),
      },
      { content: 'fatto', usage: usage() },
    );

    const agent = new AgentOrchestrator();
    await agent.run(brief, docs, {}, { include: ['logo'] });

    // generate_card non è nei tools dichiarati → il modello non può
    // chiamarlo; qui il mock risponde comunque ma il registry non lo
    // esegue perché il tool non esiste (fallback "Tool sconosciuto").
    expect(mockProcessPrompt).not.toHaveBeenCalled();
  });
});
