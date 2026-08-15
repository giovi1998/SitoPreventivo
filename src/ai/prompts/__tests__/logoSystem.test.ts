import { describe, it, expect } from 'vitest';
import { buildLogoSystemPrompt, buildLogoGeneratePrompt, sanitizeLogoBrief } from '../logoSystem';

describe('logoSystem (v2 ready)', () => {
  it('system prompt lists JSON contract fields', () => {
    const p = buildLogoSystemPrompt();
    expect(p).toContain('primaryText');
    expect(p).toContain('iconType');
    expect(p).toContain('layout');
  });

  it('system prompt includes lucide allowlist (48 nomi)', () => {
    const p = buildLogoSystemPrompt();
    expect(p).toContain('Coffee');
    expect(p).toContain('Code');
    expect(p).toContain('Shirt');
    expect(p).toContain('Sparkles');
    expect(p).toMatch(/ALLOWLIST LUCIDE/i);
  });

  it('generate prompt embeds brief and sector', () => {
    const p = buildLogoGeneratePrompt('Logo per pizzeria', 'food');
    expect(p).toContain('Logo per pizzeria');
    expect(p).toContain('food');
  });

  it('generate prompt handles empty brief with fallback', () => {
    const p = buildLogoGeneratePrompt('', 'food');
    expect(p).toContain('Logo per attività');
    expect(p).toContain('food');
  });

  it('sanitize strips HTML and trims to 500', () => {
    expect(sanitizeLogoBrief('<script>x</script>  Logo  ')).toBe('Logo');
    const long = 'a'.repeat(600);
    expect(sanitizeLogoBrief(long).length).toBe(500);
  });

  it('generate prompt appends "Contesto cliente" section when briefContext is provided (TB-027)', () => {
    const p = buildLogoGeneratePrompt('Logo moderno', 'food', 'Attività: Bar Da Mario\nSettore: food');
    expect(p).toContain('Logo moderno');
    expect(p).toContain('Contesto cliente:');
    expect(p).toContain('Bar Da Mario');
  });

  it('generate prompt is backward compatible without briefContext', () => {
    expect(buildLogoGeneratePrompt('Logo moderno', 'food'))
      .toBe(buildLogoGeneratePrompt('Logo moderno', 'food', undefined));
  });

  it('system prompt: imagePrompt deve preservare una text legibility zone (centrale, scura, non affollata)', () => {
    const p = buildLogoSystemPrompt();
    expect(p).toMatch(/text legibility zone/i);
    expect(p).toMatch(/darker|più scura|scuro/i);
    expect(p).toMatch(/uncluttered|priva di dettagli|non affollata/i);
  });

  it('generate prompt ricorda che il wordmark bianco si sovrappone allo sfondo', () => {
    const p = buildLogoGeneratePrompt('Logo per pizzeria', 'food');
    expect(p).toMatch(/text legibility zone|zona centrale/i);
    expect(p).toMatch(/wordmark|testo bianco/i);
  });
});
