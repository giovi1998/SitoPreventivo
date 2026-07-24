import { describe, it, expect } from 'vitest';
import { createEmptyCard, createGiovanniCardTemplate } from '../../documentSchemas';
import { buildCardCoverPayload, renderCardCoverScreenshot, resolveCardCoverLogo } from '../coverImage';

describe('coverImage', () => {
  it('builds payload with cardImage, logoImage, side, and prunes on budget', () => {
    const card = createGiovanniCardTemplate();
    const payload = buildCardCoverPayload('prompt', 'context', { cardImage: 'data:image/jpeg;base64,abc', logoImage: 'data:image/png;base64,def' }, 'front', 'user@example.com');
    expect(payload.prompt).toBe('prompt');
    expect(payload.context).toBe('context');
    expect(payload.side).toBe('front');
    expect(payload.cardImage).toBe('data:image/jpeg;base64,abc');
    expect(payload.logoImage).toBe('data:image/png;base64,def');
    expect(payload.userEmail).toBe('user@example.com');
  });

  it('drops logoImage then cardImage when body budget exceeded', () => {
    const card = createEmptyCard();
    const bigImage = 'data:image/jpeg;base64,' + 'x'.repeat(1_000_000);
    const payload = buildCardCoverPayload('prompt', 'context', { cardImage: bigImage, logoImage: bigImage }, 'front');
    expect(payload.logoImage).toBeUndefined();
    expect(payload.cardImage).toBeUndefined();
    expect(payload.prompt).toBe('prompt');
  });

  it('renderCardCoverScreenshot returns undefined in jsdom', async () => {
    const card = createEmptyCard();
    const result = await renderCardCoverScreenshot(card, 'front');
    expect(result).toBeUndefined();
  });

  it('resolveCardCoverLogo returns undefined when no logo', async () => {
    const card = createEmptyCard();
    const result = await resolveCardCoverLogo(card);
    expect(result).toBeUndefined();
  });
});
