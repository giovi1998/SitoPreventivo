import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIHarness } from '../aiModule';

// Mock dependencies
vi.mock('../../hooks/useAILogs', () => ({
  useAILogs: () => ({
    logs: [],
    isProcessing: false,
    totalCostUsd: 0,
    lastCostUsd: 0,
    startStream: vi.fn(() => 'stream-1'),
    finalizeStream: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../resolveProviderId', () => ({
  resolveProviderId: () => 'deepseek-v4-flash',
}));

vi.mock('../ai/captureElement', () => ({
  captureElementAsBase64: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../uiPrefs', async () => {
  const actual = await vi.importActual<typeof import('../../uiPrefs')>('../../uiPrefs');
  return {
    ...actual,
    getAiVisionEnabled: () => false,
    setAiVisionEnabled: vi.fn(),
    getAiAutoFallback: () => true,
    setAiAutoFallback: vi.fn(),
    getAiProviderDefault: () => undefined,
    setAiProviderDefault: vi.fn(),
  };
});

vi.mock('../../ai/providers/registry', () => ({
  providerRegistry: {
    listProviders: () => [
      { id: 'deepseek-v4-flash', name: 'DeepSeek', model: 'deepseek-v4-flash', supportsStreaming: true, supportsTools: true, supportsVision: false },
    ],
    getDefaultId: () => 'deepseek-v4-flash',
    getProviderCount: () => 1,
  },
}));

vi.mock('../../ai/providerPricing', () => ({
  calculateCostUsd: (_id: string, _usage?: unknown, _images?: number) => 0.001,
  getPricingLabel: () => '$0.001/Mtoken',
}));

describe('useAIHarness', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const prefs = async () => (await import('../../uiPrefs'));

  it('returns default state and toggles', () => {
    const { result } = renderHook(() => useAIHarness());
    expect(result.current.providerId).toBe('deepseek-v4-flash');
    expect(result.current.visionEnabled).toBe(false);
    expect(result.current.autoFallbackEnabled).toBe(true);
    expect(result.current.totalCostUsd).toBe(0);
    // Nano Banana 2 + Nano Banana 2 Lite (spec ai-image-quality);
    // gemini-2.0-flash-preview-image-generation ritirato da Google.
    expect(result.current.availableImageModels.length).toBe(2);
    expect(result.current.availableImageModels[0].id).toBe('gemini-3.1-flash-image');
    expect(result.current.availableImageModels[1].id).toBe('gemini-3.1-flash-lite-image');
  });

  it('toggle vision calls setAiVisionEnabled and refreshes', async () => {
    const { result } = renderHook(() => useAIHarness());
    act(() => {
      result.current.setVision(true);
    });
    expect((await prefs()).setAiVisionEnabled).toHaveBeenCalledWith(true);
  });

  it('toggle auto-fallback calls setAiAutoFallback', async () => {
    const { result } = renderHook(() => useAIHarness());
    act(() => {
      result.current.setAutoFallback(false);
    });
    expect((await prefs()).setAiAutoFallback).toHaveBeenCalledWith(false);
  });

  it('capturePreview returns undefined when vision disabled', async () => {
    const { result } = renderHook(() => useAIHarness());
    const captured = await result.current.capturePreview('[data-preview]');
    expect(captured).toBeUndefined();
  });
});
