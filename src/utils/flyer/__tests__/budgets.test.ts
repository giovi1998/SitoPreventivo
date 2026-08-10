import { describe, it, expect } from 'vitest';
import { createEmptyFlyer, createFlyerTemplate } from '../../documentSchemas';
import { getFlyerCopyBudget } from '../budgets';
import { computeFlyerLayout } from '../layoutEngine';

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

  it('fontScale 1.5 shrinks the budget (layout minimums scale up)', () => {
    const base = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, headline: 'Test', body: 'Test' } };
    const scaled = { ...base, style: { ...base.style, fontScale: 1.5 } };
    const b1 = getFlyerCopyBudget(base);
    const b15 = getFlyerCopyBudget(scaled);
    expect(b15.bodyMaxChars).toBeLessThan(b1.bodyMaxChars);
    expect(b15.headlineMaxChars).toBeLessThan(b1.headlineMaxChars);
  });

  it('budget matches real layout capacity at fontScale 1.5', () => {
    const flyer = {
      ...createEmptyFlyer(),
      content: { ...createEmptyFlyer().content, body: 'seed' },
      style: { ...createEmptyFlyer().style, fontScale: 1.5 },
    };
    const budget = getFlyerCopyBudget(flyer);
    const fits = { ...flyer, content: { ...flyer.content, body: 'testo '.repeat(Math.max(1, Math.floor(budget.bodyMaxChars / 12))) } };
    expect(getFlyerCopyBudget(fits).bodyTruncated).toBe(false);
    const over = { ...flyer, content: { ...flyer.content, body: 'testo '.repeat(budget.bodyMaxChars) } };
    expect(getFlyerCopyBudget(over).bodyTruncated).toBe(true);
  });

  it('bodyPromptMaxChars è conservativo: sotto bodyMaxChars (calcolato al font minimo)', () => {
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, body: 'seed' } };
    const budget = getFlyerCopyBudget(flyer);
    expect(budget.bodyPromptMaxChars).toBeGreaterThan(0);
    expect(budget.bodyPromptMaxChars).toBeLessThan(budget.bodyMaxChars);
  });

  it('un copy lungo bodyPromptMaxChars entra SENZA troncamento al font reale (regression auto-build: body clippato sopra la CTA)', () => {
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, body: 'seed' } };
    const budget = getFlyerCopyBudget(flyer);
    const body = 'testo '.repeat(Math.ceil(budget.bodyPromptMaxChars / 6)).slice(0, budget.bodyPromptMaxChars);
    const fits = { ...flyer, content: { ...flyer.content, body } };
    expect(getFlyerCopyBudget(fits).bodyTruncated).toBe(false);
  });

  it('body oltre capacità: troncato CON ellipsis visibile, mai clip a metà riga', () => {
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, body: 'parola '.repeat(600) } };
    const plan = computeFlyerLayout(flyer);
    expect(plan.text.body.truncated).toBe(true);
    const lastLine = plan.text.body.lines[plan.text.body.lines.length - 1];
    expect(lastLine).toMatch(/…$/);
  });
});
