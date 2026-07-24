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
});
