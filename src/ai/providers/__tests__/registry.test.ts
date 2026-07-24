import { describe, it, expect } from 'vitest';
import { AIProviderRegistry } from '../registry';
import { DeepSeekProvider } from '../deepseek';

describe('AIProviderRegistry', () => {
  it('has default id', () => {
    const r = new AIProviderRegistry();
    expect(r.getDefaultId()).toBe('deepseek-chat');
  });
  it('returns provider by id', () => {
    const r = new AIProviderRegistry();
    const p = r.getProvider('deepseek-chat');
    expect(p).toBeInstanceOf(DeepSeekProvider);
  });
  it('throws on unknown provider', () => {
    const r = new AIProviderRegistry();
    expect(() => r.getProvider('non-existent')).toThrow();
  });
  it('lists providers', () => {
    const r = new AIProviderRegistry();
    const list = r.listProviders();
    expect(list.length).toBeGreaterThan(0);
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
});
