import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIStreamChunk } from '../types';

vi.mock('../providers/registry', () => {
  const mockProvider = {
    name: 'Mock',
    model: 'mock-model',
    supportsStreaming: true,
    supportsTools: false,
    chat: vi.fn(async () => ({
      content: JSON.stringify({ front: { name: 'MARIO ROSSI' }, style: { accentColor: '#1e3a5f' } }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })),
    stream: vi.fn(async function* (messages, options) {
      const content = JSON.stringify({ front: { name: 'STREAMED' } });
      yield { type: 'content' as const, content } satisfies AIStreamChunk;
      yield { type: 'done' as const, usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } } satisfies AIStreamChunk;
    }),
  };
  return {
    providerRegistry: {
      getProvider: vi.fn(() => mockProvider),
      listProviders: vi.fn(() => [{ id: 'mock', name: 'Mock', model: 'mock-model', supportsStreaming: true, supportsTools: false }]),
    },
  };
});

import { CardAIOrchestrator } from '../cardOrchestrator';
import { createEmptyCard } from '../../utils/documentSchemas';

describe('CardAIOrchestrator', () => {
  let orch: CardAIOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orch = new CardAIOrchestrator();
  });

  it('processPrompt returns modified card with changes', async () => {
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'cambia nome in Mario', { modelId: 'mock' });
    expect(result.card.front.name).toBe('MARIO ROSSI');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.response.usage?.totalTokens).toBe(150);
  });

  it('processPrompt preserves id and documentType', async () => {
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'cambia nome', { modelId: 'mock' });
    expect(result.card.id).toBe(card.id);
    expect(result.card.documentType).toBe('businessCard');
  });

  it('processPrompt in analysis mode returns text, no merge', async () => {
    const { providerRegistry } = await import('../providers/registry');
    (providerRegistry.getProvider as any).mockReturnValueOnce({
      ...providerRegistry.getProvider(),
      chat: vi.fn(async () => ({
        content: '1. Aumentare contrasto\n2. Usare font più leggibile',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      })),
      stream: vi.fn(async function* () {}),
    });
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'ottimizza per stampa', { modelId: 'mock' });
    expect(result.changes).toHaveLength(0);
    expect(result.rawResponse).toContain('contrasto');
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
    const { providerRegistry } = await import('../providers/registry');
    (providerRegistry.getProvider as any).mockReturnValueOnce({
      ...providerRegistry.getProvider(),
      chat: vi.fn(async () => ({ content: 'not json', usage: undefined })),
      stream: vi.fn(async function* () {}),
    });
    const card = createEmptyCard();
    const result = await orch.processPrompt(card, 'cambia', { modelId: 'mock' });
    expect(result.changes.some((c) => c.startsWith('error:'))).toBe(true);
  });

  it('processPrompt handles empty AI response', async () => {
    const { providerRegistry } = await import('../providers/registry');
    (providerRegistry.getProvider as any).mockReturnValueOnce({
      ...providerRegistry.getProvider(),
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
