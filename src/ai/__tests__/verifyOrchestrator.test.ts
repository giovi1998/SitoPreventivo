import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyOrchestrator } from '../verifyOrchestrator';
import { providerRegistry } from '../providers/registry';
import { getAiVisionEnabled } from '../../utils/uiPrefs';

vi.mock('../../utils/uiPrefs', () => ({
  getAiVisionEnabled: vi.fn(() => true),
  getAiReasoningEffort: vi.fn(() => 'low'),
  isAiSkillDisabled: vi.fn(() => false),
  getAiAutoFallback: vi.fn(() => true),
}));
vi.mock('../../utils/resolveProviderId', () => ({
  resolveProviderId: vi.fn(() => 'mock-provider'),
  providerSupportsVision: vi.fn(() => true),
}));
vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

class MockProvider {
  readonly name = 'mock';
  readonly model = 'mock-v';
  readonly supportsStreaming = false;
  readonly supportsTools = false;
  readonly supportsVision = true;
  chatMock = vi.fn();
  chat = async (messages: any[], options?: any): Promise<any> => {
    return this.chatMock(messages, options);
  };
  async *stream() { /* no-op */ }
}

describe('VerifyOrchestrator (t18)', () => {
  let mock: MockProvider;

  beforeEach(() => {
    mock = new MockProvider();
    providerRegistry.register('mock-provider', mock as any);
  });

  it('vision disabilitata → ritorna {} senza chiamare provider', async () => {
    (getAiVisionEnabled as any).mockReturnValue(false);
    const out = await new VerifyOrchestrator().verifyDrafts({
      brief: 'test',
      drafts: { logo: { draft: { builder: {} } as any, preview: 'data:image/png;base64,AAAA' } },
    });
    expect(out).toEqual({});
    expect(mock.chatMock).not.toHaveBeenCalled();
  });

  it('singola immagine + verdetto pass → ritorna verdict.logo.pass', async () => {
    mock.chatMock.mockResolvedValue({
      content: '{"logo":{"verdict":"pass"}}',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });
    const out = await new VerifyOrchestrator().verifyDrafts(
      { brief: 'brand', drafts: { logo: { draft: { builder: {} } as any, preview: 'data:image/png;base64,AAAA' } } },
      { modelId: 'mock-provider' },
    );
    expect(out.logo?.verdict).toBe('pass');
    expect(mock.chatMock).toHaveBeenCalledOnce();
    const [messages, options] = mock.chatMock.mock.calls[0];
    expect(messages[0].role).toBe('system');
    expect(messages[1].images).toEqual(['data:image/png;base64,AAAA']);
    expect(options.responseFormat).toEqual({ type: 'json_object' });
    expect(options.kind).toBe('verify');
  });

  it('JSON rumoroso → parser ripulisce fence markdown', async () => {
    mock.chatMock.mockResolvedValue({
      content: '```json\n{"card":{"verdict":"retry","reason":"contrasto basso"}}\n```',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
    const out = await new VerifyOrchestrator().verifyDrafts(
      { brief: 'b', drafts: { card: { draft: {} as any, preview: 'data:image/png;base64,BBBB' } } },
      { modelId: 'mock-provider' },
    );
    expect(out.card?.verdict).toBe('retry');
    expect(out.card?.reason).toBe('contrasto basso');
  });

  it('JSON non parsabile → vuoto + warn', async () => {
    mock.chatMock.mockResolvedValue({ content: 'OPS', usage: undefined });
    const out = await new VerifyOrchestrator().verifyDrafts(
      { brief: 'b', drafts: { flyer: { draft: {} as any, preview: 'data:image/png;base64,CCCC' } } },
      { modelId: 'mock-provider' },
    );
    expect(out).toEqual({});
  });

  it('senza draft → {} senza chiamare provider', async () => {
    const out = await new VerifyOrchestrator().verifyDrafts({ brief: '', drafts: {} });
    expect(out).toEqual({});
    expect(mock.chatMock).not.toHaveBeenCalled();
  });
});
