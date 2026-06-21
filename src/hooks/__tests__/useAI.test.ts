import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAI } from '../useAI';
import dataService from '../../utils/dataService';

vi.mock('../../utils/dataService', () => ({
  default: {
    getUserProfile: vi.fn().mockResolvedValue({ tokensUsed: 100, tokenLimit: 1000000 }),
    trackTokens: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../ai/index', () => ({
  AIOrchestrator: vi.fn().mockImplementation(function () {
    return {
      processPrompt: vi.fn().mockResolvedValue({
        quote: { quoteId: 'q1' },
        response: { content: '{"project":{"title":"X"}}', toolCalls: undefined, usage: { totalTokens: 500 } },
        sessionId: 'sess-1',
        changes: ['Titolo progetto: "X"'],
        rawResponse: '{"project":{"title":"X"}}',
      }),
      getProviderList: vi.fn().mockReturnValue([{ id: 'deepseek-chat', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }]),
      resetSession: vi.fn(),
    };
  }),
}));

describe('useAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(dataService.trackTokens).toHaveBeenCalledWith('user@test.com', expect.any(Number));
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
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, 'Rendi il preventivo premium');
    });
    const requestLog = result.current.aiLogs.find((l) => l.msg.includes('Invio richiesta'));
    expect(requestLog).toBeDefined();
    expect(requestLog!.msg).toContain('Rendi il preventivo premium');
  });

  it('log "Invio richiesta" stores full prompt in detail field', async () => {
    const longPrompt = 'This is a very long prompt that should be stored in detail so the user can expand it';
    const { result } = renderHook(() => useAI('user@test.com'));
    await act(async () => {
      await result.current.processPrompt({ quoteId: 'q' } as any, longPrompt);
    });
    const requestLog = result.current.aiLogs.find((l) => l.msg.includes('Invio richiesta'));
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
});
