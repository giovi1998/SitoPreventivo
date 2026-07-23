import { describe, it, expect } from 'vitest';
import { createEmptyCard, createGiovanniCardTemplate } from '../../documentSchemas';
import { buildCardCoverBrief } from '../coverBrief';

describe('buildCardCoverBrief', () => {
  it('returns prompt and context strings', () => {
    const card = createGiovanniCardTemplate();
    const { prompt, context } = buildCardCoverBrief(card);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(typeof context).toBe('string');
  });

  it('includes palette in both prompt and context', () => {
    const card = createGiovanniCardTemplate();
    const { prompt, context } = buildCardCoverBrief(card);
    expect(prompt).toContain('#01696F');
    expect(context).toContain('accent #01696F');
    expect(context).toContain(card.style.bgColor);
  });

  it('describes the front grid positions in context', () => {
    const card = createGiovanniCardTemplate();
    const { context } = buildCardCoverBrief(card);
    expect(context).toContain('Front grid 4x4');
    // v2.17: template Giovanni = layout right-balanced (foto a destra 2×2
    // centrata, name full-width in alto). Celle da gridPresetRightBalanced.
    expect(context).toContain('photo cols 2-4, rows 1-3');
    expect(context).toContain('name cols 0-4, rows 0-1');
  });

  it('keeps text areas readable in prompt', () => {
    const card = createGiovanniCardTemplate();
    const { prompt } = buildCardCoverBrief(card);
    // v3.0: Nano-Banana reasoning-driven formula (Subject + Action +
    // Context + Composition + Lighting + Style). Full sentences,
    // Negative Constraint Logic phrased as "Ensure the background
    // remains free of...".
    const lower = prompt.toLowerCase();
    expect(lower).toContain('subject:');
    expect(lower).toContain('action:');
    expect(lower).toContain('context:');
    expect(lower).toContain('composition:');
    expect(lower).toContain('lighting:');
    expect(lower).toContain('style:');
    expect(lower).toContain('low contrast');
  });

  it('flags photo/logo presence in context', () => {
    const card = createGiovanniCardTemplate();
    const { context } = buildCardCoverBrief(card);
    expect(context).toContain('user photo will be placed on the front');
    expect(context).toContain('user logo will be placed on the front');
  });

  it('includes a compact JSON layout snapshot in context', () => {
    const card = createGiovanniCardTemplate();
    const { context } = buildCardCoverBrief(card);
    expect(context).toContain('Layout snapshot');
    expect(context).toContain('"side":"front"');
    expect(context).toContain('"accent":"#01696F"');
  });

  it('describes font and alignment in context', () => {
    const card = createGiovanniCardTemplate();
    const { context } = buildCardCoverBrief(card);
    expect(context).toContain('font Inter');
    expect(context).toMatch(/align=(left|right|center)/);
  });

  it('falls back gracefully for empty card', () => {
    const card = createEmptyCard();
    const { prompt, context } = buildCardCoverBrief(card);
    expect(prompt.length).toBeGreaterThan(0);
    expect(context).toContain('Front grid 4x4');
  });

  it('does not exceed max lengths', () => {
    const card = createGiovanniCardTemplate();
    const { prompt, context } = buildCardCoverBrief(card);
    expect(prompt.length).toBeLessThanOrEqual(1000);
    expect(context.length).toBeLessThanOrEqual(2000);
  });

  it('includes the actual card palette hex values in the prompt', () => {
    const card = { ...createEmptyCard(), style: { ...createEmptyCard().style, accentColor: '#FFFFFF' } };
    const { prompt } = buildCardCoverBrief(card);
    // The prompt must always carry the literal hex codes from the card
    // (bgColor, textColor, accentColor) so the model can reason about
    // the exact brand colors, even when accentColor is white.
    expect(prompt).toContain(card.style.bgColor);
    expect(prompt).toContain(card.style.textColor);
    expect(prompt).toContain(card.style.accentColor);
    // The explicit "harmonious professional color palette" hint is
    // reserved for a future revision; today we always pass hex codes.
  });

  it('supports back side context', () => {
    const card = createGiovanniCardTemplate();
    const { context } = buildCardCoverBrief(card, 'back');
    expect(context).toContain('Back grid 4x4');
    expect(context).toContain('QR code');
  });

  it('does not ask for faces/text/logos in prompt', () => {
    const card = createGiovanniCardTemplate();
    const { prompt } = buildCardCoverBrief(card);
    // v3.0: Negative Constraint Logic phrased as "Ensure the background
    // remains free of...". The user does not want text, QR, logos,
    // faces or people baked into the generated background; the card
    // content is overlaid separately.
    const lower = prompt.toLowerCase();
    expect(lower).toContain('ensure the background remains completely free of');
    expect(lower).toContain('text');
    expect(lower).toContain('qr codes');
    expect(lower).toContain('logos');
    expect(lower).toContain('faces');
    expect(lower).toContain('people');
    expect(lower).toContain('real objects');
    expect(lower).toContain('watermarks');
    expect(lower).toContain('photographic details');
    // Creative abstract styles are ALLOWED, requested as Subject.
    expect(lower).toContain('soft geometric shapes');
    expect(lower).toContain('layered translucent planes');
    expect(lower).toContain('flowing wave-like curves');
    expect(lower).toContain('gentle bokeh circles');
    expect(lower).toContain('abstract topographic contour lines');
  });

  it('prompt never asks to generate text, QR, logos, faces, or real objects (negative constraints only)', () => {
    const card = createGiovanniCardTemplate();
    const { prompt } = buildCardCoverBrief(card);
    const lower = prompt.toLowerCase();
    // The prompt must forbid these, not request them. The v3.0 prompt
    // uses "free of any text, words, letters, numbers, QR codes, ...".
    expect(lower).toContain('free of any text');
    expect(lower).toContain('qr codes');
    expect(lower).toContain('logos');
    expect(lower).toContain('faces');
    expect(lower).toContain('people');
    expect(lower).toContain('real objects');
    expect(lower).toContain('recognizable icons');
  });
});
