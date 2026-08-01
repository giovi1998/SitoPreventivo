import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../utils/dataService', () => ({
  default: {
    getUserProfile: vi.fn().mockResolvedValue({ tokensUsed: 0, tokenLimit: 1000000 }),
    trackTokens: vi.fn(),
  },
}));

const cardOrchestratorInstances = vi.hoisted(() => [] as { processPrompt: ReturnType<typeof vi.fn> }[]);

vi.mock('../../ai/cardOrchestrator', () => ({
  CardAIOrchestrator: vi.fn().mockImplementation(function () {
    const instance = {
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
    cardOrchestratorInstances.push(instance);
    return instance;
  }),
}));

vi.mock('../../utils/card/pngExport', () => ({
  renderCardSideDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,SIDE'),
}));

import { useAICard } from '../useAICard';
import { createEmptyCard, createGiovanniCardTemplate } from '../../utils/documentSchemas';
import dataService from '../../utils/dataService';
import { renderCardSideDataUrl } from '../../utils/card/pngExport';
import { setAiVisionEnabled } from '../../utils/uiPrefs';

const mockRenderSide = renderCardSideDataUrl as unknown as ReturnType<typeof vi.fn>;

const originalLocation = window.location;

const setHost = (host: string) => {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname: host },
    writable: true,
    configurable: true,
  });
};

describe('useAICard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cardOrchestratorInstances.length = 0;
    localStorage.clear();
    setHost('localhost');
  });

  afterEach(() => {
    setAiVisionEnabled(false);
    setHost('localhost');
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
    expect(res!.aiCall).toBeDefined();
    expect(res!.aiCall!.kind).toBe('text');
    expect(res!.aiCall!.costUsd).toBeGreaterThanOrEqual(0);
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
    expect(dataService.trackTokens).toHaveBeenCalledWith('user@test.com', 15, expect.any(Number));
  });

  it('CON-MM-002: con provider text-only (deepseek-v4-flash) non cattura lo screenshot anche con vision ON', async () => {
    setAiVisionEnabled(true);
    const { result } = renderHook(() => useAICard('user@test.com'));
    await act(async () => {
      await result.current.processCardPrompt(createEmptyCard(), 'test', { modelId: 'deepseek-v4-flash' });
    });
    expect(mockRenderSide).not.toHaveBeenCalled();
    const inst = cardOrchestratorInstances.find((i) => i.processPrompt.mock.calls.length > 0)!;
    expect(inst.processPrompt).toHaveBeenCalledWith(
      expect.anything(),
      'test',
      expect.objectContaining({ imagePreviewBase64: undefined }),
    );
  });

  describe('generateCover', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns a data URL from /api/ai/card-cover', async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { imageBase64: 'FAKEBASE64', mimeType: 'image/png' } }),
      });
      const { result } = renderHook(() => useAICard('user@test.com'));
      const coverRes = await act(async () => result.current.generateCover(createGiovanniCardTemplate()));
      expect(coverRes.dataUrl).toBe('data:image/png;base64,FAKEBASE64');
      expect(coverRes.aiCall.kind).toBe('cover');
      expect(coverRes.aiCall.costUsd).toBeGreaterThan(0);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai/card-cover',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"context"'),
        }),
      );
    });

    it('sends context with grid info for non-empty card', async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { imageBase64: 'FAKEBASE64', mimeType: 'image/png' } }),
      });
      const { result } = renderHook(() => useAICard('user@test.com'));
      await act(async () => result.current.generateCover(createGiovanniCardTemplate()));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.context).toContain('Front grid 4x4');
      // v2.8.3: template Giovanni = split, foto a sinistra cols 0-2 rows 0-4.
      expect(body.context).toContain('photo cols 0-2, rows 0-4');
    });

    it('uses only prompt when explicit prompt override is provided', async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { imageBase64: 'FAKEBASE64', mimeType: 'image/png' } }),
      });
      const { result } = renderHook(() => useAICard('user@test.com'));
      await act(async () => result.current.generateCover(createGiovanniCardTemplate(), 'front', 'custom prompt'));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.prompt).toBe('custom prompt');
      expect(body.context).toBe('');
    });

    it('throws on non-ok response', async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Troppe richieste' }),
      });
      const { result } = renderHook(() => useAICard('user@test.com'));
      await expect(
        act(async () => result.current.generateCover(createEmptyCard())),
      ).rejects.toThrow('Troppe richieste');
    });

    it('throws when token limit reached', async () => {
      setHost('quickbrand.vercel.app');
      const ds = await import('../../utils/dataService');
      (ds.default.getUserProfile as any).mockResolvedValueOnce({ tokensUsed: 1_000_000, tokenLimit: 1_000_000 });
      const { result } = renderHook(() => useAICard('user@test.com'));
      await expect(
        act(async () => result.current.generateCover(createEmptyCard())),
      ).rejects.toThrow(/Limite token/);
    });
  });
});
