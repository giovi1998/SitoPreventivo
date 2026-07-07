import { describe, it, expect } from 'vitest';
import { createEmptyFlyer, createFlyerTemplate } from '../../documentSchemas';
import { buildFlyerHeroPayload, renderFlyerScreenshot } from '../heroImage';

describe('heroImage', () => {
  it('builds payload with prompt, context, aspect ratio, and optional image', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    const payload = buildFlyerHeroPayload(flyer, 'ristorante', 'formale', { flyerImage: 'data:image/jpeg;base64,xxx' }, 'user@example.com');
    expect(payload.prompt).toContain('ristorante');
    expect(payload.context).toContain('Sector: ristorante');
    expect(payload.aspectRatio).toBe('16:9');
    expect(payload.flyerImage).toBe('data:image/jpeg;base64,xxx');
    expect(payload.userEmail).toBe('user@example.com');
  });

  it('drops flyerImage when body budget is exceeded', () => {
    const flyer = createEmptyFlyer();
    const bigImage = 'data:image/jpeg;base64,' + 'x'.repeat(1_200_000);
    const payload = buildFlyerHeroPayload(flyer, 'ristorante', 'formale', { flyerImage: bigImage }, 'user@example.com');
    expect(payload.flyerImage).toBeUndefined();
    expect(payload.prompt).toContain('ristorante');
  });

  it('uses promptOverride when provided (non-empty), ignoring the auto prompt', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    const override = 'Custom hero: dark wood table, charcuterie board, warm light, no people';
    const payload = buildFlyerHeroPayload(flyer, 'ristorante', 'formale', {}, 'u@e.com', override);
    expect(payload.prompt).toBe(override);
    expect(payload.context).toContain('ristorante');
  });

  it('falls back to auto prompt when promptOverride is empty/whitespace', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    const payload = buildFlyerHeroPayload(flyer, 'ristorante', 'formale', {}, 'u@e.com', '   ');
    expect(payload.prompt).toContain('ristorante');
    expect(payload.prompt).not.toBe('   ');
  });

  it('renderFlyerScreenshot returns undefined in jsdom (no canvas)', async () => {
    const flyer = createEmptyFlyer();
    const result = await renderFlyerScreenshot(flyer);
    expect(result).toBeUndefined();
  });
});
