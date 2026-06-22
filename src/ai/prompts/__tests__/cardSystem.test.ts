import { describe, it, expect } from 'vitest';
import { buildCardSystemPrompt } from '../cardSystem';

describe('buildCardSystemPrompt', () => {
  it('mentions bigliettini da visita (not preventivi)', () => {
    const p = buildCardSystemPrompt();
    expect(p.toLowerCase()).toContain('bigliettin');
  });

  it('lists card-specific fields (front.name, back.phone, style.accentColor)', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('front.name');
    expect(p).toContain('back.phone');
    expect(p).toContain('style.accentColor');
  });

  it('declares the 3 layout enum values', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('centered');
    expect(p).toContain('left');
    expect(p).toContain('split');
  });

  it('declares the 4 borderStyle enum values', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('none');
    expect(p).toContain('thin');
    expect(p).toContain('accent-strip-left');
    expect(p).toContain('accent-strip-bottom');
  });

  it('requires hex color format #RRGGBB', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/#RRGGBB|#rrggbb|hex/i);
  });

  it('mentions ANALISI mode for print optimization', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/analisi|analysis/i);
  });

  it('does NOT mention preventivo-specific fields (options, items, legalClauses, paymentTerms)', () => {
    const p = buildCardSystemPrompt();
    expect(p).not.toContain('legalClauses');
    expect(p).not.toContain('paymentTerms');
    expect(p).not.toContain('unitPrice');
  });
});
