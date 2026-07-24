import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAI } from '../useAI';
import dataService from '../../utils/dataService';
import { renderQuotePreviewImage } from '../../utils/quote/quotePreviewImage';
import { setAiVisionEnabled } from '../../utils/uiPrefs';

vi.mock('../../utils/dataService', () => ({
  default: {
    getUserProfile: vi.fn().mockResolvedValue({ tokensUsed: 100, tokenLimit: 1000000 }),
    trackTokens: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const orchestratorInstances = vi.hoisted(() => [] as { processPrompt: ReturnType<typeof vi.fn> }[]);

vi.mock('../../ai/index', () => ({
  AIOrchestrator: vi.fn().mockImplementation(function () {
    const instance = {
      processPrompt: vi.fn().mockResolvedValue({
        quote: { quoteId: 'q1' },
        response: { content: '{"project":{"title":"X"}}', toolCalls: undefined, usage: { totalTokens: 500 } },
        sessionId: 'sess-1',
        changes: ['Titolo progetto: "X"'],
        rawResponse: '{"project":{"title":"X"}}',
      }),
      getProviderList: vi.fn().mockReturnValue([{ id: 'deepseek-chat', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }]),
      resetSession: vi.fn(),
      getCurrentSessionId: vi.fn().mockReturnValue('sess-1'),
    };
    orchestratorInstances.push(instance);
    return instance;
  }),
}));

vi.mock('../../utils/quote/quotePreviewImage', () => ({
  renderQuotePreviewImage: vi.fn().mockResolvedValue('data:image/jpeg;base64,PREVIEW'),
}));

const mockCapture = renderQuotePreviewImage as unknown as ReturnType<typeof vi.fn>;

describe('useAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orchestratorInstances.length = 0;
    sessionStorage.clear();
    localStorage.clear();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    expect(result.current.aiLogs).toEqual([]);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.availableModels.length).toBeGreaterThan(0);
  });

  it('throws on empty prompt', async () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    await expect(
      result.current.processPrompt({ quoteId: 'q' } as any, '')
    ).rejects.toThrow('Inserisci un prompt');
  });

  it('processes prompt and adds log entries', async () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });
    expect(result.current.aiLogs.length).toBeGreaterThan(0);
  });

  it('tracks tokens after successful prompt', async () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    expect(dataService.trackTokens).toHaveBeenCalledWith('user@test.com', expect.any(Number), expect.any(Number));
  });

  it('resetChat clears logs', async () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    act(() => {
      result.current.resetChat();
    });
    expect(result.current.aiLogs).toEqual([]);
    expect(result.current.sessionId).toBeNull();
  });

  it('admin user skips token tracking', async () => {
    const { result } = renderHook(() => useAI('admin@gmail.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    expect(dataService.trackTokens).not.toHaveBeenCalled();
  });

  it('log "Invio richiesta" includes the prompt text sent to the AI', async () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    const prompt = 'Rendi il preventivo premium';
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, prompt);
    });
    const requestLog = result.current.aiLogs.find((l) => l.type === 'info' && l.msg.includes('Invio richiesta'));
    expect(requestLog).toBeDefined();
    expect(requestLog!.msg).toContain('Invio richiesta');
    expect(requestLog!.detail).toContain(prompt);
  });

  it('log "Invio richiesta" stores full prompt in detail field', async () => {
    const longPrompt = 'This is a very long prompt that should be stored in detail so the user can expand it';
    const { result } = renderHook(() => useAI('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, longPrompt);
    });
    const requestLog = result.current.aiLogs.find((l) => l.type === 'info' && l.msg.includes('Invio richiesta'));
    expect(requestLog).toBeDefined();
    expect(requestLog!.detail).toBe(longPrompt);
  });

  it('log "Modifiche applicate" lists actual change descriptions in detail, not just count', async () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    const successLog = result.current.aiLogs.find((l) => l.type === 'success');
    expect(successLog).toBeDefined();
    expect(successLog!.detail).toBeDefined();
    expect(successLog!.detail).toContain('Titolo progetto: "X"');
  });

  it('success log msg does NOT duplicate the ✨ emoji (already shown by icon)', async () => {
    const { result } = renderHook(() => useAI('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    const successLog = result.current.aiLogs.find((l) => l.type === 'success');
    expect(successLog).toBeDefined();
    expect(successLog!.msg).not.toContain('✨');
    expect(successLog!.msg).toMatch(/1 modifica applicata/);
  });

  it('error:invalid_quote:* entries are classified as errors, not shown as modifications', async () => {
    vi.doMock('../../ai/index', () => ({
      AIOrchestrator: vi.fn().mockImplementation(function () {
        return {
          processPrompt: vi.fn().mockResolvedValue({
            quote: { quoteId: 'q1' },
            response: { content: '{}', usage: { totalTokens: 100 } },
            sessionId: 's1',
            changes: ['error:invalid_quote:10'],
            rawResponse: '{}',
          }),
          getProviderList: vi.fn().mockReturnValue([{ id: 'deepseek-chat', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }]),
          resetSession: vi.fn(),
          getCurrentSessionId: vi.fn().mockReturnValue('s1'),
        };
      }),
    }));
    vi.resetModules();
    const { useAI: useAIFresh } = await import('../useAI');
    const { result } = renderHook(() => useAIFresh('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    const successLog = result.current.aiLogs.find((l) => l.type === 'success');
    expect(successLog).toBeUndefined();
    const errorLog = result.current.aiLogs.find((l) => l.type === 'error');
    expect(errorLog).toBeDefined();
    vi.doUnmock('../../ai/index');
    vi.resetModules();
  });

  it('any error:* prefix is classified as error, not modification', async () => {
    vi.doMock('../../ai/index', () => ({
      AIOrchestrator: vi.fn().mockImplementation(function () {
        return {
          processPrompt: vi.fn().mockResolvedValue({
            quote: { quoteId: 'q1' },
            response: { content: '{}', usage: { totalTokens: 100 } },
            sessionId: 's1',
            changes: ['error:unknown_new_kind:42'],
            rawResponse: '{}',
          }),
          getProviderList: vi.fn().mockReturnValue([{ id: 'deepseek-chat', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }]),
          resetSession: vi.fn(),
          getCurrentSessionId: vi.fn().mockReturnValue('s1'),
        };
      }),
    }));
    vi.resetModules();
    const { useAI: useAIFresh } = await import('../useAI');
    const { result } = renderHook(() => useAIFresh('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'ciao');
    });
    const successLog = result.current.aiLogs.find((l) => l.type === 'success');
    expect(successLog).toBeUndefined();
    vi.doUnmock('../../ai/index');
    vi.resetModules();
  });

  describe('CON-MM-002: screenshot solo se il provider supporta vision', () => {
    afterEach(() => {
      setAiVisionEnabled(false);
      document.querySelectorAll('[data-quote-preview]').forEach((el) => el.remove());
    });

    it('provider text-only (deepseek-chat): nessuna cattura, imagePreviewBase64 undefined', async () => {
      setAiVisionEnabled(true);
      const quote = { quoteId: 'q', project: { title: 'Test' }, options: [] } as any;
      const { result } = renderHook(() => useAI('user@test.com'));
      await act(async () => {
        await result.current.processPrompt(quote, 'ciao', { modelId: 'deepseek-chat' });
      });
      expect(mockCapture).not.toHaveBeenCalled();
      const inst = orchestratorInstances.find((i) => i.processPrompt.mock.calls.length > 0)!;
      expect(inst.processPrompt).toHaveBeenCalledWith(
        expect.anything(),
        'ciao',
        expect.objectContaining({ imagePreviewBase64: undefined }),
      );
    });

    it('provider vision (ollama-minimax-m3): cattura eseguita e passata all\'orchestratore', async () => {
      setAiVisionEnabled(true);
      const quote = { quoteId: 'q', project: { title: 'Test' }, options: [] } as any;
      const { result } = renderHook(() => useAI('user@test.com'));
      await act(async () => {
        await result.current.processPrompt(quote, 'ciao', { modelId: 'ollama-minimax-m3' });
      });
      expect(mockCapture).toHaveBeenCalled();
      const inst = orchestratorInstances.find((i) => i.processPrompt.mock.calls.length > 0)!;
      expect(inst.processPrompt).toHaveBeenCalledWith(
        expect.anything(),
        'ciao',
        expect.objectContaining({ imagePreviewBase64: 'data:image/jpeg;base64,PREVIEW' }),
      );
    });

    it('quote vuota: nessuna cattura anche con provider vision', async () => {
      setAiVisionEnabled(true);
      const quote = { quoteId: 'q', project: {}, options: [] } as any;
      const { result } = renderHook(() => useAI('user@test.com'));
      await act(async () => {
        await result.current.processPrompt(quote, 'ciao', { modelId: 'ollama-minimax-m3' });
      });
      expect(mockCapture).not.toHaveBeenCalled();
      const inst = orchestratorInstances.find((i) => i.processPrompt.mock.calls.length > 0)!;
      expect(inst.processPrompt).toHaveBeenCalledWith(
        expect.anything(),
        'ciao',
        expect.objectContaining({ imagePreviewBase64: undefined }),
      );
    });
  });
});
