import { describe, it, expect } from 'vitest';
import { AIProviderRegistry } from '../registry';
import { DeepSeekProvider } from '../deepseek';

describe('AIProviderRegistry', () => {
  it('has default id', () => {
    const r = new AIProviderRegistry();
    // Default: MiniMax M3 (vision); DeepSeek resta fallback.
    expect(r.getDefaultId()).toBe('ollama-minimax-m3');
    expect(r.getFallbackProvider()).toMatchObject({ id: 'deepseek-v4-flash' });
  });
  it('returns provider by id', () => {
    const r = new AIProviderRegistry();
    const p = r.getProvider('deepseek-v4-flash');
    expect(p).toBeInstanceOf(DeepSeekProvider);
  });
  it('throws on unknown provider', () => {
    const r = new AIProviderRegistry();
    expect(() => r.getProvider('non-existent')).toThrow();
  });
  it('lists providers', () => {
    const r = new AIProviderRegistry();
    const list = r.listProviders();
    expect(list.length).toBe(6);
    expect(list[0]).toHaveProperty('supportsStreaming');
    expect(list[0]).toHaveProperty('supportsTools');
  });
  it('sets default id', () => {
    const r = new AIProviderRegistry();
    r.register('foo', new DeepSeekProvider('foo'));
    r.setDefaultId('foo');
    expect(r.getDefaultId()).toBe('foo');
  });
  it('throws on setDefault with unknown', () => {
    const r = new AIProviderRegistry();
    expect(() => r.setDefaultId('nope')).toThrow();
  });

  it('includes ollama-deepseek-v4-flash', () => {
    const r = new AIProviderRegistry();
    const p = r.getProvider('ollama-deepseek-v4-flash');
    expect(p).toBeDefined();
    expect(p.model).toBe('deepseek-v4-flash:cloud');
  });
});
