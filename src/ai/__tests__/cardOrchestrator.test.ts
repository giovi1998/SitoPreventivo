import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIStreamChunk } from '../types';

let chatResponses: any[] = [];
let fakeProvider: any;

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

// TB-029 fase 2: il system prompt DEVE passare dal promptRegistry (dove il
// prefetch remoto Langfuse registra gli override). I builder locali restano
// come fallback registrato.
vi.mock('../prompts/registry', () => ({
  get promptRegistry() {
    return {
      getPrompt: vi.fn(() => mockSystemPrompt),
      hasPrompt: vi.fn(() => true),
    };
  },
}));

let mockSystemPrompt = 'SYSTEM LOCALE';

import { CardAIOrchestrator } from '../cardOrchestrator';
import { createEmptyCard } from '../../utils/documentSchemas';

function setupMockProvider(overrides: Partial<typeof fakeProvider> = {}) {
  fakeProvider = {
    name: 'Mock',
    model: 'mock-model',
    supportsStreaming: true,
    supportsTools: true,
    chat: vi.fn(async () => {
      const r = chatResponses.shift() ?? {
        content: JSON.stringify({ front: { name: 'MARIO ROSSI' }, style: { accentColor: '#1e3a5f' } }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };
      return r;
    }),
    stream: vi.fn(async function* () {
      const content = JSON.stringify({ front: { name: 'STREAMED' } });
      yield { type: 'content' as const, content } satisfies AIStreamChunk;
      yield { type: 'done' as const, usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } } satisfies AIStreamChunk;
    }),
    ...overrides,
  };
  return fakeProvider;
}

describe('CardAIOrchestrator', () => {
  let orch: CardAIOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    chatResponses = [];
    setupMockProvider();
    orch = new CardAIOrchestrator();
  });

  it('processPrompt returns modified card with changes', async () => {
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'cambia nome in Mario', { modelId: 'mock' });
    expect(result.card.front.name).toBe('MARIO ROSSI');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.response.usage?.totalTokens).toBe(150);
  });

  it('TB-029: usa il system prompt dal promptRegistry (override remoto possibile)', async () => {
    mockSystemPrompt = 'PROMPT REMOTO LANGfUSE';
    const card = createEmptyCard();
    await orch.processPrompt(card, 'cambia nome', { modelId: 'mock' });
    const msgs = fakeProvider.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toBe('PROMPT REMOTO LANGfUSE');
  });

  it('processPrompt preserves id and documentType', async () => {
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'cambia nome', { modelId: 'mock' });
    expect(result.card.id).toBe(card.id);
    expect(result.card.documentType).toBe('businessCard');
  });

  it('processPrompt in analysis mode returns text, no merge', async () => {
    chatResponses.push({
      content: '1. Aumentare contrasto\n2. Usare font più leggibile',
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    });
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'ottimizza per stampa', { modelId: 'mock' });
    expect(result.changes).toHaveLength(0);
    expect(result.rawResponse).toContain('contrasto');
  });

  it('uses card_apply_palette tool when prompt mentions palette', async () => {
    chatResponses.push({
      content: null,
      toolCalls: [{
        id: 'tc1',
        type: 'function',
        function: { name: 'card_apply_palette', arguments: JSON.stringify({ palette: 'premium' }) },
      }],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    });
    chatResponses.push({
      content: JSON.stringify({ front: { name: 'Mario' }, style: { accentColor: '#1e3a5f' } }),
      usage: { promptTokens: 80, completionTokens: 30, totalTokens: 110 },
    });
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'applica palette premium', { modelId: 'mock' });
    expect(result.card.style.accentColor).toBe('#1e3a5f');
    expect(result.card.style.bgColor).toBe('#ffffff');
    expect(result.changes.some((c) => c.startsWith('tool:card_apply_palette'))).toBe(true);
  });

  it('falls back to direct JSON when provider does not support tools', async () => {
    const { providerRegistry } = await import('../providers/registry');
    chatResponses.push({
      content: JSON.stringify({ front: { name: 'NO TOOL' }, style: { accentColor: '#000' } }),
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const noToolProvider = {
      ...providerRegistry.getProvider(),
      supportsTools: false,
    };
    (providerRegistry.getProvider as any).mockReturnValueOnce(noToolProvider);
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'applica palette premium', { modelId: 'mock' });
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.startsWith('tool:'))).toBe(false);
  });

  it('processPrompt with streaming calls onStream', async () => {
    const card = createEmptyCard();
    const chunks: AIStreamChunk[] = [];
    const result = await orch.processPrompt(card, 'cambia nome', {
      modelId: 'mock',
      onStream: (chunk) => chunks.push(chunk),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.type === 'content')).toBe(true);
    expect(result.card.front.name).toBe('STREAMED');
  });

  it('processPrompt handles invalid JSON gracefully', async () => {
    const prev = { ...fakeProvider };
    setupMockProvider({
      ...prev,
      chat: vi.fn(async () => ({ content: 'not json', usage: undefined })),
      stream: vi.fn(async function* () {}),
    });
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'cambia', { modelId: 'mock' });
    expect(result.changes.some((c) => c.startsWith('error:'))).toBe(true);
  });

  it('processPrompt handles empty AI response', async () => {
    const prev = { ...fakeProvider };
    setupMockProvider({
      ...prev,
      chat: vi.fn(async () => ({ content: null, usage: undefined })),
      stream: vi.fn(async function* () {}),
    });
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'cambia', { modelId: 'mock' });
    expect(result.changes).toContain('error:empty');
  });

  it('resetSession clears the active session', async () => {
    const card = createEmptyCard();
    await orch.processPrompt(card, 'cambia nome', { modelId: 'mock' });
    expect(orch.getCurrentSessionId()).not.toBeNull();
    orch.resetSession();
    expect(orch.getCurrentSessionId()).toBeNull();
  });

  it('getProviderList returns available providers', () => {
    const list = orch.getProviderList();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].id).toBe('mock');
  });
});
