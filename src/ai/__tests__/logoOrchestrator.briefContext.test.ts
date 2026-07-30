import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIStreamChunk, AIResponse, ChatMessage, ChatOptions, AIProvider } from '../types';

let fakeProvider: MockProvider;

vi.mock('../providers/registry', () => ({
  get providerRegistry() {
    return {
      getProvider: () => fakeProvider,
      getDefaultId: () => 'mock-logo',
      getFallbackProvider: () => null,
      listProviders: () => [
        { id: 'mock-logo', name: 'Mock', model: 'mock-logo', supportsStreaming: true, supportsTools: false, supportsVision: false },
      ],
      setDefaultId: vi.fn(),
    };
  },
}));

import { LogoAIOrchestrator } from '../logoOrchestrator';
import { createEmptyLogo } from '../../utils/documentSchemas';

class MockProvider implements AIProvider {
  readonly name = 'Mock';
  readonly model = 'mock-logo';
  readonly supportsStreaming = true;
  readonly supportsTools = false;
  public chatMock = vi.fn();

  async chat(messages: ChatMessage[], _options?: ChatOptions): Promise<AIResponse> {
    return await this.chatMock(messages);
  }

  async *stream(_messages: ChatMessage[], _options?: ChatOptions): AsyncGenerator<AIStreamChunk> {
    yield { type: 'done' };
  }
}

const THREE_CONCEPTS = JSON.stringify([
  { primaryText: 'Brand A', tagline: 'Tag A', iconType: 'none', primaryColor: '#01696F', secondaryColor: '#1a1a2e', layout: 'horizontal' },
  { primaryText: 'Brand B', tagline: 'Tag B', iconType: 'shape', primaryColor: '#E11D48', secondaryColor: '#1a1a2e', layout: 'vertical' },
  { primaryText: 'Brand C', tagline: 'Tag C', iconType: 'monogram', monogram: 'BC', primaryColor: '#B45309', secondaryColor: '#1a1a2e', layout: 'stacked' },
]);

function lastUserMessage(mock: MockProvider): string {
  const calls = mock.chatMock.mock.calls;
  const messages = calls[calls.length - 1]?.[0] as ChatMessage[];
  return messages.find((m) => m.role === 'user')?.content ?? '';
}

describe('LogoAIOrchestrator.generateLogo briefContext (TB-027)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeProvider = new MockProvider();
    fakeProvider.chatMock.mockResolvedValue({
      content: THREE_CONCEPTS,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
  });

  it('falls back to logo.briefContext when brief is empty', async () => {
    const orch = new LogoAIOrchestrator();
    const logo = { ...createEmptyLogo(), briefContext: 'Attività: Bar Da Mario\nSettore: food' };
    const result = await orch.generateLogo(logo, '   ');
    expect(result.applied).toBe(true);
    const prompt = lastUserMessage(fakeProvider);
    expect(prompt).toContain('Bar Da Mario');
    expect(prompt).toContain('Settore: food');
    // briefContext used AS the brief: no separate section
    expect(prompt).not.toContain('Contesto cliente:');
  });

  it('appends briefContext as "Contesto cliente" when the user provides a brief', async () => {
    const orch = new LogoAIOrchestrator();
    const logo = { ...createEmptyLogo(), briefContext: 'Attività: Bar Da Mario' };
    const result = await orch.generateLogo(logo, 'Logo minimal e moderno');
    expect(result.applied).toBe(true);
    const prompt = lastUserMessage(fakeProvider);
    expect(prompt).toContain('Logo minimal e moderno');
    expect(prompt).toContain('Contesto cliente:');
    expect(prompt).toContain('Bar Da Mario');
  });

  it('prompt is unchanged when the logo has no briefContext', async () => {
    const orch = new LogoAIOrchestrator();
    await orch.generateLogo(createEmptyLogo(), 'Logo minimal');
    const prompt = lastUserMessage(fakeProvider);
    expect(prompt).toContain('Logo minimal');
    expect(prompt).not.toContain('Contesto cliente:');
  });

  it('accepts a single concept object (not array) from the provider', async () => {
    fakeProvider.chatMock.mockResolvedValue({
      content: JSON.stringify({ primaryText: 'Pad Thai', tagline: 'Sapori', iconType: 'lucide', iconName: 'ChefHat', primaryColor: '#2D6A4F', secondaryColor: '#E76F51', layout: 'horizontal' }),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    const orch = new LogoAIOrchestrator();
    const result = await orch.generateLogo(createEmptyLogo(), 'Logo Pad Thai');
    expect(result.applied).toBe(true);
    expect(result.concepts).toHaveLength(3);
    expect(result.concepts[0].primaryText).toBe('Pad Thai');
  });

  it('accepts an array with fewer than 3 concepts', async () => {
    fakeProvider.chatMock.mockResolvedValue({
      content: JSON.stringify([
        { primaryText: 'A', tagline: '', iconType: 'none', primaryColor: '#01696F', secondaryColor: '#1a1a2e', layout: 'horizontal' },
      ]),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    const orch = new LogoAIOrchestrator();
    const result = await orch.generateLogo(createEmptyLogo(), 'Logo A');
    expect(result.applied).toBe(true);
    expect(result.concepts).toHaveLength(3);
  });

  it('falls back to default concepts when provider returns non-JSON text', async () => {
    fakeProvider.chatMock.mockResolvedValue({
      content: '"Pad Thai",\n    "tagline": "Sapori",\n    "iconType": "lucide"',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    const orch = new LogoAIOrchestrator();
    const result = await orch.generateLogo(createEmptyLogo(), 'Logo Pad Thai');
    expect(result.applied).toBe(true);
    expect(result.concepts).toHaveLength(3);
    expect(result.changes.some((c) => c.includes('fallback_concepts'))).toBe(true);
  });
});
