import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveProviderId } from '../resolveProviderId';

const getAiProviderDefault = vi.fn().mockReturnValue('deepseek-v4-flash');

vi.mock('../uiPrefs', async () => {
  const actual = await vi.importActual<typeof import('../uiPrefs')>('../uiPrefs');
  return {
    ...actual,
    getAiProviderDefault: () => getAiProviderDefault(),
  };
});

describe('resolveProviderId', () => {
  beforeEach(() => {
    getAiProviderDefault.mockReturnValue('deepseek-v4-flash');
  });

  it('uses explicit modelId when provided', () => {
    expect(resolveProviderId('ollama-minimax-m3')).toBe('ollama-minimax-m3');
  });

  it('falls back to default provider from prefs', () => {
    expect(resolveProviderId()).toBe('deepseek-v4-flash');
  });

  it('falls back to registry default when pref is invalid', async () => {
    const { providerRegistry } = await import('../../ai/providers/registry');
    getAiProviderDefault.mockReturnValue('unknown-provider');
    expect(resolveProviderId()).toBe(providerRegistry.getDefaultId());
  });
});
