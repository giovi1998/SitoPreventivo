import { describe, it, expect } from 'vitest';
import { buildFlyerSystemPrompt, buildFlyerCopyPrompt, sanitizeFlyerBrief } from '../flyerSystem';

describe('flyerSystem prompts (phase 3)', () => {
  describe('buildFlyerSystemPrompt', () => {
    it('returns a non-empty string in Italian', () => {
      const s = buildFlyerSystemPrompt();
      expect(s.length).toBeGreaterThan(50);
      expect(s).toMatch(/italiano/i);
    });

    it('forbids markdown and emojis in output', () => {
      const s = buildFlyerSystemPrompt();
      expect(s.toLowerCase()).toContain('json');
      expect(s.toLowerCase()).toMatch(/no emoji|niente emoji/);
    });
  });

  describe('buildFlyerCopyPrompt', () => {
    it('includes the brief in the user prompt', () => {
      const p = buildFlyerCopyPrompt('Sagra del paese, 15 agosto, ingresso gratis', 'giovanile', {
        layout: 'classic', size: 'A5', bodyCharBudget: 500,
      });
      expect(p).toContain('Sagra del paese');
    });

    it('embeds the requested tone', () => {
      const formale = buildFlyerCopyPrompt('x', 'formale', { layout: 'classic', size: 'A5', bodyCharBudget: 500 });
      const giov = buildFlyerCopyPrompt('x', 'giovanile', { layout: 'classic', size: 'A5', bodyCharBudget: 500 });
      const tec = buildFlyerCopyPrompt('x', 'tecnico', { layout: 'classic', size: 'A5', bodyCharBudget: 500 });
      expect(formale).toMatch(/formale/i);
      expect(giov).toMatch(/giovanile/i);
      expect(tec).toMatch(/tecnico/i);
    });

    it('includes the layout-specific guidance', () => {
      const c = buildFlyerCopyPrompt('x', 'formale', { layout: 'centered', size: 'A5', bodyCharBudget: 500 });
      const m = buildFlyerCopyPrompt('x', 'formale', { layout: 'magazine', size: 'A5', bodyCharBudget: 500 });
      expect(c.toLowerCase()).toContain('centrato');
      expect(m.toLowerCase()).toContain('magazine');
    });

    it('honors the body char budget', () => {
      const p = buildFlyerCopyPrompt('x', 'formale', { layout: 'classic', size: 'A5', bodyCharBudget: 800 });
      expect(p).toContain('800 caratteri');
    });

    it('forbids url in cta (user-supplied only)', () => {
      const p = buildFlyerCopyPrompt('x', 'formale', { layout: 'classic', size: 'A5', bodyCharBudget: 500 });
      expect(p.toLowerCase()).toMatch(/non includere il campo url/);
    });
  });

  describe('sanitizeFlyerBrief', () => {
    it('strips HTML tags', () => {
      const result = sanitizeFlyerBrief('<script>alert(1)</script>Sagra della birra');
      expect(result).not.toContain('<script>');
      expect(result).toContain('Sagra della birra');
    });

    it('collapses whitespace', () => {
      expect(sanitizeFlyerBrief('  a    b   c  ')).toBe('a b c');
    });

    it('strips control characters', () => {
      // Control chars are removed first, then whitespace is collapsed
      // so the result is 'ab' (no space). This is intentional: control
      // chars are not separators the user typed.
      expect(sanitizeFlyerBrief('a\x00\x01b')).toBe('ab');
    });

    it('returns empty string for whitespace-only', () => {
      expect(sanitizeFlyerBrief('   \n\t  ')).toBe('');
    });
  });
});
