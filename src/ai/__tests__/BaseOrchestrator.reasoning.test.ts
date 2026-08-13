import { describe, it, expect, vi } from 'vitest';
import { BaseOrchestrator } from '../BaseOrchestrator';
import type { AIProvider, AIStreamChunk, ChatMessage, AIResponse } from '../types';

class TestOrchestrator extends BaseOrchestrator {
  testHandleStream(
    provider: AIProvider,
    messages: ChatMessage[],
    options: { reasoningEffort?: 'low' | 'high' | 'max'; customerId?: string; kind?: string } = {},
    callbacks: { onStream?: (chunk: AIStreamChunk) => void } = {}
  ): Promise<AIResponse> {
    return this.handleStream(provider, messages, options, callbacks);
  }
}

function streamProvider(chunks: AIStreamChunk[]): AIProvider {
  return {
    name: 'Test',
    model: 'test',
    supportsStreaming: true,
    supportsTools: true,
    async chat(): Promise<AIResponse> {
      return { content: null };
    },
    async *stream(): AsyncGenerator<AIStreamChunk> {
      for (const c of chunks) yield c;
    },
  };
}

describe('BaseOrchestrator.handleStream + reasoningContent (CON: DeepSeek tool multi-turn)', () => {
  it('accumula reasoningContent dai chunk e lo include nella AIResponse', async () => {
    const o = new TestOrchestrator();
    const provider = streamProvider([
      { type: 'content', content: '', reasoningContent: 'sto ragionando' },
      { type: 'content', content: 'risposta finale' },
      { type: 'done' },
    ]);
    const res = await o.testHandleStream(provider, [{ role: 'user', content: 'x' }], {}, {
      onStream: vi.fn(),
    });
    expect(res.content).toBe('risposta finale');
    expect(res.reasoningContent).toBe('sto ragionando');
  });

  it('ritorna reasoningContent undefined se nessun chunk lo emette', async () => {
    const o = new TestOrchestrator();
    const provider = streamProvider([{ type: 'content', content: 'ok' }, { type: 'done' }]);
    const res = await o.testHandleStream(provider, [{ role: 'user', content: 'x' }], {}, {
      onStream: vi.fn(),
    });
    expect(res.content).toBe('ok');
    expect(res.reasoningContent).toBeUndefined();
  });

  it('senza callback onStream delega a provider.chat (non-stream)', async () => {
    const o = new TestOrchestrator();
    const chat = vi.fn().mockResolvedValue({ content: 'chat', reasoningContent: 'reason' });
    const provider: AIProvider = {
      name: 'Test',
      model: 'test',
      supportsStreaming: true,
      supportsTools: true,
      chat,
      async *stream(): AsyncGenerator<AIStreamChunk> {
        yield { type: 'done' };
      },
    };
    const res = await o.testHandleStream(provider, [{ role: 'user', content: 'x' }]);
    expect(chat).toHaveBeenCalled();
    expect(res.reasoningContent).toBe('reason');
  });

  it('propaga reasoningEffort nelle options al provider', async () => {
    const o = new TestOrchestrator();
    const chat = vi.fn().mockResolvedValue({ content: null });
    const provider: AIProvider = {
      name: 'Test',
      model: 'test',
      supportsStreaming: true,
      supportsTools: true,
      chat,
      async *stream(): AsyncGenerator<AIStreamChunk> {
        yield { type: 'done' };
      },
    };
    await o.testHandleStream(provider, [{ role: 'user', content: 'x' }], { reasoningEffort: 'low' });
    expect(chat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'x' }],
      expect.objectContaining({ reasoningEffort: 'low' })
    );
  });

  it('TB-029: propaga kind di default (chat) e customerId alle options del provider', async () => {
    const o = new TestOrchestrator();
    const chat = vi.fn().mockResolvedValue({ content: null });
    const provider: AIProvider = {
      name: 'Test',
      model: 'test',
      supportsStreaming: true,
      supportsTools: true,
      chat,
      async *stream(): AsyncGenerator<AIStreamChunk> {
        yield { type: 'done' };
      },
    };
    await o.testHandleStream(provider, [{ role: 'user', content: 'x' }], { customerId: 'cust_9' });
    expect(chat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'x' }],
      expect.objectContaining({ customerId: 'cust_9', kind: 'chat' })
    );
  });

  it('TB-029: override kind esplicito vince sul default dell\u2019orchestratore', async () => {
    const o = new TestOrchestrator();
    const chat = vi.fn().mockResolvedValue({ content: null });
    const provider: AIProvider = {
      name: 'Test',
      model: 'test',
      supportsStreaming: true,
      supportsTools: true,
      chat,
      async *stream(): AsyncGenerator<AIStreamChunk> {
        yield { type: 'done' };
      },
    };
    await o.testHandleStream(provider, [{ role: 'user', content: 'x' }], { kind: 'card' });
    expect(chat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'x' }],
      expect.objectContaining({ kind: 'card' })
    );
  });
});
