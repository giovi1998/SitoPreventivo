import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../providers/registry', () => {
  const mockProvider = {
    name: 'MockProvider',
    model: 'mock-model',
    supportsStreaming: false,
    supportsTools: true,
    chat: vi.fn(),
    stream: vi.fn(),
  };
  return {
    providerRegistry: {
      getProvider: vi.fn(() => mockProvider),
      listProviders: vi.fn(() => [{ id: 'mock', name: 'Mock', model: 'mock', supportsStreaming: false, supportsTools: true }]),
    },
  };
});

vi.mock('../chat/store', () => {
  return {
    chatStore: {
      createSession: vi.fn(() => ({ id: 'sess-1', messages: [], createdAt: '', updatedAt: '' })),
      getSession: vi.fn(() => ({ id: 'sess-1', messages: [], createdAt: '', updatedAt: '' })),
      addMessage: vi.fn(),
      clearSession: vi.fn(),
    },
  };
});

import { AIOrchestrator, needsTools } from '../index';
import { providerRegistry } from '../providers/registry';
import { createEmptyQuote, addEmptyOption, addEmptyItem } from '../../utils/quoteSchema';

function makeBaseQuote() {
  const withOpt = addEmptyOption(createEmptyQuote());
  return addEmptyItem(withOpt, withOpt.options[0].id);
}

describe('AIOrchestrator.processPrompt, bug #2: follow-up revert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('follow-up JSON must NOT revert tool-applied discount', async () => {
    const quote = makeBaseQuote();
    const itemId = quote.options[0].items[0].id;
    const mockProvider = providerRegistry.getProvider() as any;

    // Prima chiamata: AI restituisce tool_call per apply_discount 10% su tutto
    mockProvider.chat.mockResolvedValueOnce({
      content: null,
      toolCalls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'apply_discount',
          arguments: JSON.stringify({ type: 'percentage', value: 10, scope: 'all' }),
        },
      }],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    // Seconda chiamata (follow-up): AI restituisce JSON con il quote ORIGINALE
    // (senza discount, come se l'AI non sapesse che il tool ha già applicato lo sconto)
    mockProvider.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        options: [
          {
            id: quote.options[0].id,
            label: quote.options[0].label,
            description: quote.options[0].description,
            items: [
              {
                id: itemId,
                label: quote.options[0].items[0].label,
                description: quote.options[0].items[0].description,
                category: 'service',
                unit: 'fixed',
                quantity: 1,
                unitPrice: 100,
                discount: { type: 'none', value: 0 },
                tax: { type: 'vat', rate: 22 },
              },
            ],
          },
        ],
      }),
      usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
    });

    const orch = new AIOrchestrator();
    const result = await orch.processPrompt(quote, 'applica sconto 10%', { modelId: 'mock' });

    const finalDiscount = (result.quote as any).options[0].items[0].discount;
    expect(finalDiscount.type).toBe('percentage');
    expect(finalDiscount.value).toBe(10);
  });

  it('rejects tool call with invalid enum arg (bug #3: validateToolArgs)', async () => {
    const quote = makeBaseQuote();
    const mockProvider = providerRegistry.getProvider() as any;

    // AI invia apply_discount con type="foo" (non in enum ['percentage','absolute'])
    mockProvider.chat.mockResolvedValueOnce({
      content: null,
      toolCalls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'apply_discount',
          arguments: JSON.stringify({ type: 'foo', value: 10, scope: 'all' }),
        },
      }],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    });

    // Follow-up (non dovrebbe revertire nulla perché il tool è skip)
    mockProvider.chat.mockResolvedValueOnce({
      content: JSON.stringify({}),
      usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
    });

    const orch = new AIOrchestrator();
    const result = await orch.processPrompt(quote, 'applica sconto', { modelId: 'mock' });

    // Il tool non deve essere stato eseguito → il quote non deve avere discount
    expect(result.changes.some((c) => c.startsWith('error:invalid_args'))).toBe(true);
    expect(result.changes.some((c) => c === 'tool:apply_discount')).toBe(false);
  });

  it('rejects tool call with wrong type for numeric arg (bug #3)', async () => {
    const quote = makeBaseQuote();
    const mockProvider = providerRegistry.getProvider() as any;

    // AI invia value come stringa "10" invece di numero 10
    mockProvider.chat.mockResolvedValueOnce({
      content: null,
      toolCalls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'apply_discount',
          arguments: JSON.stringify({ type: 'percentage', value: 'not-a-number', scope: 'all' }),
        },
      }],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    });

    mockProvider.chat.mockResolvedValueOnce({
      content: JSON.stringify({}),
      usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
    });

    const orch = new AIOrchestrator();
    const result = await orch.processPrompt(quote, 'applica sconto', { modelId: 'mock' });

    expect(result.changes.some((c) => c.startsWith('error:invalid_args'))).toBe(true);
    expect(result.changes.some((c) => c === 'tool:apply_discount')).toBe(false);
  });

  it('does NOT bump updatedAt when no changes occurred (bug #14)', async () => {
    const quote = makeBaseQuote();
    const originalUpdatedAt = quote.updatedAt;
    const mockProvider = providerRegistry.getProvider() as any;

    // AI returns empty object (no modifications)
    mockProvider.chat.mockResolvedValueOnce({
      content: JSON.stringify({}),
      usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
    });

    const orch = new AIOrchestrator();
    const result = await orch.processPrompt(quote, 'prova qualcosa', { modelId: 'mock' });

    expect((result.quote as any).updatedAt).toBe(originalUpdatedAt);
  });
});

describe('needsTools, bug #4: irraggiungibili keyword mancanti', () => {
  it('detects "rimuovi voci vuote" → remove_empty_items', () => {
    expect(needsTools('rimuovi le voci vuote')).toBe(true);
  });
  it('detects "rimuovi voci zero" → remove_empty_items', () => {
    expect(needsTools('rimuovi voci con quantità zero')).toBe(true);
  });
  it('detects "verifica coerenza" → check_consistency', () => {
    expect(needsTools('verifica coerenza dei totali')).toBe(true);
  });
  it('detects "controlla consistenza" → check_consistency', () => {
    expect(needsTools('controlla consistenza')).toBe(true);
  });
  it('does NOT trigger tools for text-only prompts', () => {
    expect(needsTools('rendi il preventivo premium')).toBe(false);
  });
});
