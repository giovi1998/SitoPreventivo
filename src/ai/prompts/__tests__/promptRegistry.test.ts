import { describe, it, expect } from 'vitest';
import { promptRegistry, AIPromptRegistry } from '../registry';
import { buildSystemPrompt } from '../system';
import { buildCardSystemPrompt } from '../cardSystem';
import { buildFlyerSystemPrompt, buildFlyerCopyPrompt } from '../flyerSystem';

describe('AIPromptRegistry', () => {
  it('returns the compact quote system prompt by default', () => {
    const text = promptRegistry.getPrompt('quote-system');
    expect(text).toBe(buildSystemPrompt(true));
  });

  it('returns the full quote system prompt when compact=false', () => {
    const text = promptRegistry.getPrompt('quote-system', { compact: false });
    expect(text).toBe(buildSystemPrompt(false));
  });

  it('returns the card system prompt without context', () => {
    const text = promptRegistry.getPrompt('card-system');
    expect(text).toBe(buildCardSystemPrompt());
  });

  it('returns the flyer system prompt', () => {
    const text = promptRegistry.getPrompt('flyer-system');
    expect(text).toBe(buildFlyerSystemPrompt());
  });

  it('returns the flyer copy user prompt with ctx', () => {
    const context = { layout: 'classic' as const, size: 'A5' as const, bodyCharBudget: 500 };
    const text = promptRegistry.getPrompt('flyer-copy', {
      brief: 'Pizzeria Da Mario',
      tone: 'formale',
      context,
    });
    expect(text).toBe(buildFlyerCopyPrompt('Pizzeria Da Mario', 'formale', context));
  });

  it('throws on unknown id', () => {
    expect(() => promptRegistry.getPrompt('does-not-exist')).toThrow(/non registrato/);
  });

  it('hasPrompt returns true/false correctly', () => {
    expect(promptRegistry.hasPrompt('card-system')).toBe(true);
    expect(promptRegistry.hasPrompt('xxx')).toBe(false);
  });

  it('listPrompts returns at least 4 entries', () => {
    const list = promptRegistry.listPrompts();
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list.map((e) => e.id)).toEqual(
      expect.arrayContaining(['quote-system', 'card-system', 'flyer-system', 'flyer-copy'])
    );
  });

  it('setDefaultId / getDefaultId', () => {
    const reg = new AIPromptRegistry();
    reg.register('foo', () => 'foo');
    expect(reg.getDefaultId()).toBe('');
    reg.setDefaultId('foo');
    expect(reg.getDefaultId()).toBe('foo');
  });

  it('setDefaultId throws on unknown id', () => {
    const reg = new AIPromptRegistry();
    expect(() => reg.setDefaultId('missing')).toThrow(/non registrato/);
  });

  it('warns on duplicate registration but still works', () => {
    const reg = new AIPromptRegistry();
    reg.register('a', () => 'first');
    reg.register('a', () => 'second');
    expect(reg.getPrompt('a')).toBe('second');
  });

  it('default id is quote-system (singleton sanity)', () => {
    expect(promptRegistry.getDefaultId()).toBe('quote-system');
  });
});
