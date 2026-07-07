import { describe, it, expect } from 'vitest';
import { createEmptyFlyer, createFlyerTemplate } from '../../documentSchemas';
import {
  buildHeroPrompt,
  buildHeroContext,
  aspectRatioForFlyer,
  getDefaultHeroSector,
  hasHeroBox,
} from '../heroPrompt';

describe('heroPrompt', () => {
  it('builds a prompt with sector-specific motifs and tone', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    const prompt = buildHeroPrompt(flyer, 'ristorante', 'giovanile');
    expect(prompt).toContain('ristorante');
    expect(prompt).toContain('giovanile');
    expect(prompt).toContain('appetizing food photography');
  });

  it('forbids text, QR, logos, faces, people, UI elements but allows sector objects', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    const prompt = buildHeroPrompt(flyer, 'ristorante', 'formale').toLowerCase();
    expect(prompt).toContain('no text');
    expect(prompt).toContain('no qr codes');
    expect(prompt).toContain('no logos');
    expect(prompt).toContain('no faces');
    expect(prompt).toContain('no people');
    expect(prompt).toContain('no ui elements');
    expect(prompt).toContain('no watermarks');
    // Sector-specific real objects are allowed (described, not forbidden).
    expect(prompt).toContain('dishes');
    expect(prompt).toContain('ingredients');
  });

  it('builds context with sector, tone, and aspect ratio', () => {
    const flyer = createFlyerTemplate('evento', 'centered');
    const ctx = buildHeroContext(flyer, 'evento', 'formale');
    expect(ctx).toContain('Sector: evento');
    expect(ctx).toContain('Tone: formale');
    expect(ctx).toContain('Layout: centered');
  });

  it('centered layout has no hero box', () => {
    expect(hasHeroBox('centered')).toBe(false);
    expect(hasHeroBox('classic')).toBe(true);
  });

  it('aspect ratio matches hero box for classic portrait A5', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    // A5 portrait classic hero box is full width × ~42% height (~138×84mm),
    // aspect ≈ 1.64 → maps to 16:9.
    expect(aspectRatioForFlyer(flyer)).toBe('16:9');
  });

  it('infers ristorante sector from headline text', () => {
    const flyer = createEmptyFlyer();
    flyer.content.headline = 'Pizzeria da Mario';
    expect(getDefaultHeroSector(flyer)).toBe('ristorante');
  });
});
