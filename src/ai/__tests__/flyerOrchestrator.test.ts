import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIStreamChunk, AIResponse, ChatMessage, ChatOptions, AIProvider } from '../types';

let fakeProvider: any;

vi.mock('../providers/registry', () => ({
  get providerRegistry() {
    return {
      getProvider: () => fakeProvider,
      listProviders: () => [
        { id: 'mock-flyer', name: 'Mock', model: 'mock-flyer', supportsStreaming: true, supportsTools: false },
      ],
      setDefaultId: vi.fn(),
    };
  },
}));

import { FlyerAIOrchestrator, flyerAIOutputSchema } from '../flyerOrchestrator';
import { createEmptyFlyer } from '../../utils/documentSchemas';

class MockProvider implements AIProvider {
  readonly name = 'Mock';
  readonly model = 'mock-flyer';
  readonly supportsStreaming = true;
  readonly supportsTools = false;
  public chatMock = vi.fn();
  public streamChunks: AIStreamChunk[] = [];
  public streamCalls: ChatMessage[][] = [];

  async chat(messages: ChatMessage[], _options?: ChatOptions): Promise<AIResponse> {
    return await this.chatMock(messages);
  }

  async *stream(messages: ChatMessage[], _options?: ChatOptions): AsyncGenerator<AIStreamChunk> {
    this.streamCalls.push(messages);
    for (const c of this.streamChunks) {
      yield c;
    }
  }
}

function setupMock() {
  const m = new MockProvider();
  fakeProvider = m;
  return m;
}

describe('FlyerAIOrchestrator (phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('flyerAIOutputSchema', () => {
    it('accepts a valid AI output', () => {
      const r = flyerAIOutputSchema.safeParse({
        headline: 'Titolo',
        subheadline: 'Sotto',
        body: 'Corpo',
        cta: { label: 'CTA' },
      });
      expect(r.success).toBe(true);
    });

    it('rejects cta with extra fields (url forbidden in AI output)', () => {
      const r = flyerAIOutputSchema.safeParse({
        headline: 'T', subheadline: 'S', body: 'B',
        cta: { label: 'C', url: 'https://x.it' },
      });
      expect(r.success).toBe(false);
    });

    it('rejects oversize body', () => {
      const r = flyerAIOutputSchema.safeParse({
        headline: 'T', subheadline: 'S', body: 'x'.repeat(2001),
        cta: { label: 'C' },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('generateCopy', () => {
    it('parses the JSON response and merges it into the flyer (keeps cta.url)', async () => {
      const mock = setupMock();
      mock.chatMock.mockResolvedValue({
        content: JSON.stringify({
          headline: 'Sagra della birra',
          subheadline: '15 agosto',
          body: 'Ingresso gratis',
          cta: { label: 'Prenota ora' },
        }),
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      });
      const orch = new FlyerAIOrchestrator();
      const flyer = createEmptyFlyer();
      flyer.content.cta.url = 'https://existing.it/book';
      const result = await orch.generateCopy(flyer, 'Sagra della birra 15 agosto ingresso gratis', 'giovanile');
      expect(result.applied).toBe(true);
      expect(result.flyer.content.headline).toBe('Sagra della birra');
      expect(result.flyer.content.subheadline).toBe('15 agosto');
      expect(result.flyer.content.body).toBe('Ingresso gratis');
      expect(result.flyer.content.cta.label).toBe('Prenota ora');
      // user-supplied url is preserved
      expect(result.flyer.content.cta.url).toBe('https://existing.it/book');
      expect(result.changes).toContain('copy_generated');
      expect(result.response.usage?.totalTokens).toBe(80);
    });

    it('reports error:not_json when content is malformed', async () => {
      const mock = setupMock();
      mock.chatMock.mockResolvedValue({ content: '{ headline: "missing quotes }' });
      const orch = new FlyerAIOrchestrator();
      const flyer = createEmptyFlyer();
      const result = await orch.generateCopy(flyer, 'brief', 'formale');
      expect(result.applied).toBe(false);
      expect(result.changes).toContain('error:not_json');
    });

    it('reports error:empty when content is null', async () => {
      const mock = setupMock();
      mock.chatMock.mockResolvedValue({ content: null });
      const orch = new FlyerAIOrchestrator();
      const flyer = createEmptyFlyer();
      const result = await orch.generateCopy(flyer, 'brief', 'formale');
      expect(result.applied).toBe(false);
      expect(result.changes).toContain('error:empty');
    });

    it('clamps oversize body via Zod', async () => {
      const mock = setupMock();
      mock.chatMock.mockResolvedValue({
        content: JSON.stringify({
          headline: 'T', subheadline: 'S',
          body: 'x'.repeat(2500),
          cta: { label: 'C' },
        }),
      });
      const orch = new FlyerAIOrchestrator();
      const flyer = createEmptyFlyer();
      const result = await orch.generateCopy(flyer, 'brief', 'formale');
      expect(result.applied).toBe(false);
      expect(result.changes.join(' ')).toMatch(/error:invalid_flyer/);
    });
  });

  describe('refineCopy', () => {
    it('streams the prompt to the provider and applies the refined copy', async () => {
      const mock = setupMock();
      mock.streamChunks = [
        { type: 'content', content: '{"headline":"Titolo"' },
        { type: 'content', content: ',"subheadline":"S","body":"più breve","cta":{"label":"Vai"}}' },
        { type: 'done', usage: { promptTokens: 60, completionTokens: 20, totalTokens: 80 } },
      ];
      const orch = new FlyerAIOrchestrator();
      const flyer = createEmptyFlyer();
      flyer.content.headline = 'Titolo Originale';
      flyer.content.body = 'Body originale molto lungo che verra semplificato';
      const onStream = vi.fn();
      const result = await orch.refineCopy(flyer, 'simplify', { onStream });
      expect(result.applied).toBe(true);
      expect(result.flyer.content.body).toBe('più breve');
      expect(result.changes.join(' ')).toMatch(/Semplificato/);
      expect(onStream).toHaveBeenCalled();
      expect(mock.streamCalls.length).toBe(1);
    });
  });

  describe('session lifecycle', () => {
    it('reuses the same session across calls', async () => {
      const mock = setupMock();
      mock.chatMock.mockResolvedValue({ content: JSON.stringify({ headline: 'A', subheadline: '', body: '', cta: { label: '' } }) });
      const orch = new FlyerAIOrchestrator();
      await orch.generateCopy(createEmptyFlyer(), 'a', 'formale');
      mock.chatMock.mockResolvedValue({ content: JSON.stringify({ headline: 'B', subheadline: '', body: '', cta: { label: '' } }) });
      await orch.generateCopy(createEmptyFlyer(), 'b', 'formale');
      expect(orch.getCurrentSessionId()).toBeTruthy();
    });

    it('resetSession clears the active session', async () => {
      const mock = setupMock();
      mock.chatMock.mockResolvedValue({ content: JSON.stringify({ headline: 'A', subheadline: '', body: '', cta: { label: '' } }) });
      const orch = new FlyerAIOrchestrator();
      await orch.generateCopy(createEmptyFlyer(), 'a', 'formale');
      const idBefore = orch.getCurrentSessionId();
      orch.resetSession();
      expect(orch.getCurrentSessionId()).not.toBe(idBefore);
    });
  });
});
