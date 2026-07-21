import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveProviderId } from '../resolveProviderId';

const getAiProviderDefault = vi.fn().mockReturnValue('deepseek-chat');
const getAiABTestingEnabled = vi.fn().mockReturnValue(false);

vi.mock('../uiPrefs', async () => {
  const actual = await vi.importActual<typeof import('../uiPrefs')>('../uiPrefs');
  return {
    ...actual,
    getAiProviderDefault: () => getAiProviderDefault(),
    getAiABTestingEnabled: () => getAiABTestingEnabled(),
  };
});

describe('resolveProviderId', () => {
  beforeEach(() => {
    getAiProviderDefault.mockReturnValue('deepseek-chat');
    getAiABTestingEnabled.mockReturnValue(false);
  });

  it('uses explicit modelId when provided', () => {
    expect(resolveProviderId('ollama-minimax-m3')).toBe('ollama-minimax-m3');
  });

  it('falls back to default provider from prefs', () => {
    expect(resolveProviderId()).toBe('deepseek-chat');
  });

  it('falls back to registry default when pref is invalid', () => {
    getAiProviderDefault.mockReturnValue('unknown-provider');
    expect(resolveProviderId()).toBe('deepseek-chat');
  });

  it('picks challenger half the time when AB testing enabled', () => {
    getAiABTestingEnabled.mockReturnValue(true);
    const choices = new Set<string>();
    for (let i = 0; i < 20; i++) {
      choices.add(resolveProviderId(undefined, `salt-${i}`));
    }
    // Con salt diversi deve vedere entrambi i provider della coppia.
    expect(choices.size).toBeGreaterThanOrEqual(2);
    expect(Array.from(choices).every((id) => id === 'deepseek-chat' || id === 'ollama-deepseek-v4-pro')).toBe(true);
  });

  it('respects explicit modelId even when AB testing enabled', () => {
    getAiABTestingEnabled.mockReturnValue(true);
    expect(resolveProviderId('ollama-minimax-m3', 'salt')).toBe('ollama-minimax-m3');
  });
});
