import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../utils/dataService', () => ({
  default: {
    getUserProfile: vi.fn().mockResolvedValue({ tokensUsed: 0, tokenLimit: 1000000 }),
    trackTokens: vi.fn(),
  },
}));

vi.mock('../../ai/cardOrchestrator', () => ({
  CardAIOrchestrator: vi.fn().mockImplementation(function () {
    return {
      processPrompt: vi.fn().mockResolvedValue({
        card: { id: 'card_1', documentType: 'businessCard', front: { name: 'AI NAME' } },
        response: { content: '{}', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
        sessionId: 's1',
        changes: ['Fronte: nome → "AI NAME"'],
        rawResponse: '{}',
      }),
      resetSession: vi.fn(),
      getCurrentSessionId: vi.fn(() => null),
      getProviderList: vi.fn(() => [{ id: 'mock', name: 'Mock', model: 'mock', supportsStreaming: true, supportsTools: false }]),
    };
  }),
}));

import { useAICard } from '../useAICard';
import { createEmptyCard } from '../../utils/documentSchemas';
import dataService from '../../utils/dataService';

describe('useAICard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state (not processing, empty logs)', () => {
    const { result } = renderHook(() => useAICard('user@test.com'));
    expect(result.current.isCardProcessing).toBe(false);
    expect(result.current.cardAiLogs).toEqual([]);
    expect(result.current.availableModels.length).toBeGreaterThan(0);
  });

  it('processCardPrompt calls orchestrator and returns result', async () => {
    const { result } = renderHook(() => useAICard('user@test.com'));
    const card = createEmptyCard();
    const res = await act(async () => {
      return await result.current.processCardPrompt(card, 'cambia nome');
    });
    expect(res!.card.front.name).toBe('AI NAME');
    expect(res!.changes.length).toBeGreaterThan(0);
  });

  it('rejects empty prompt', async () => {
    const { result } = renderHook(() => useAICard('user@test.com'));
    await expect(result.current.processCardPrompt(createEmptyCard(), '')).rejects.toThrow();
  });

  it('admin user skips token check', async () => {
    const { result } = renderHook(() => useAICard('admin@gmail.com'));
    await act(async () => {
      await result.current.processCardPrompt(createEmptyCard(), 'test');
    });
    expect(dataService.getUserProfile).not.toHaveBeenCalled();
  });

  it('resetCardChat clears logs and session', async () => {
    const { result } = renderHook(() => useAICard('user@test.com'));
    await act(async () => {
      await result.current.processCardPrompt(createEmptyCard(), 'test');
    });
    expect(result.current.cardAiLogs.length).toBeGreaterThan(0);
    act(() => {
      result.current.resetCardChat();
    });
    expect(result.current.cardAiLogs).toEqual([]);
  });

  it('tracks tokens for non-admin user', async () => {
    const { result } = renderHook(() => useAICard('user@test.com'));
    await act(async () => {
      await result.current.processCardPrompt(createEmptyCard(), 'test');
    });
    expect(dataService.trackTokens).toHaveBeenCalledWith('user@test.com', 15);
  });
});
