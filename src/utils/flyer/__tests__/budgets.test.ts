import { describe, it, expect } from 'vitest';
import { createEmptyFlyer, createFlyerTemplate } from '../../documentSchemas';
import { getFlyerCopyBudget } from '../budgets';

describe('getFlyerCopyBudget', () => {
  it('returns lower body budget for A6 than A4', () => {
    const a6 = { ...createEmptyFlyer(), size: 'A6' as const, content: { ...createEmptyFlyer().content, headline: 'Test', body: 'Test' } };
    const a4 = { ...createEmptyFlyer(), size: 'A4' as const, content: { ...createEmptyFlyer().content, headline: 'Test', body: 'Test' } };
    const b6 = getFlyerCopyBudget(a6);
    const b4 = getFlyerCopyBudget(a4);
    expect(b6.bodyMaxChars).toBeLessThan(b4.bodyMaxChars);
  });

  it('returns warning for overflow layout', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    flyer.content.body = 'x '.repeat(2000);
    const budget = getFlyerCopyBudget(flyer);
    expect(budget.warning).toBeTruthy();
  });

  it('headline max chars is reasonable for A5', () => {
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, headline: 'Test' } };
    const budget = getFlyerCopyBudget(flyer);
    expect(budget.headlineMaxChars).toBeGreaterThanOrEqual(15);
    expect(budget.headlineMaxChars).toBeLessThanOrEqual(200);
  });

  it('cta max chars is reasonable', () => {
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, cta: { label: 'Test', url: 'https://example.com' } } };
    const budget = getFlyerCopyBudget(flyer);
    expect(budget.ctaMaxChars).toBeGreaterThanOrEqual(10);
    expect(budget.ctaMaxChars).toBeLessThanOrEqual(80);
  });
});
