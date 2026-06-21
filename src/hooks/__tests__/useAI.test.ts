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
});
