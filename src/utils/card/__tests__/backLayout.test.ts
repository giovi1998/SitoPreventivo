import { describe, it, expect } from 'vitest';
import {
  backPad,
  backHeaderMetrics,
  backQrSizePx,
  effectiveBackGridForRender,
  alignBoxInCell,
  PREVIEW_REF_H,
} from '../backLayout';
import { createEmptyCard, createGiovanniCardTemplate, QR_SIZE_PX } from '../../documentSchemas';

describe('backLayout', () => {
  it('header bodyTop is smaller fraction of height than legacy 0.055*2+pad (v2.10)', () => {
    const pxH = 663;
    const pxW = 1024;
    const pad = backPad(pxW, pxH);
    const m = backHeaderMetrics(pxW, pxH, 1, pad);
    // Old formula was ~ pad + 0.055*pxH + 0.02*pxH + 0.025*pxH ≈ 0.12+ of height
    // New should be closer to CSS (~0.08–0.10 of height)
    expect(m.bodyTop).toBeLessThan(pxH * 0.12);
    expect(m.bodyTop).toBeGreaterThan(pxH * 0.05);
    expect(m.eyebrowSize).toBeLessThan(pxH * 0.05);
  });

  it('backQrSizePx medium on PREVIEW_REF_H equals QR_SIZE_PX.medium', () => {
    const card = createEmptyCard();
    card.back.qrSize = 'medium';
    const size = backQrSizePx(card, 200, 200, PREVIEW_REF_H);
    expect(size).toBe(QR_SIZE_PX.medium);
  });

  it('effectiveBackGridForRender collapses empty services under contacts', () => {
    const card = createGiovanniCardTemplate();
    // Giovanni has socials, no services content by default
    card.back.services = [];
    const grid = card.backGrid!;
    expect(grid.elements.services).toBeDefined();
    expect(grid.elements.socials).toBeDefined();

    const effective = effectiveBackGridForRender(grid, card);
    expect(effective.elements.services).toBeUndefined();
    expect(effective.elements.socials).toBeDefined();
    const contacts = effective.elements.contacts!;
    const socials = effective.elements.socials!;
    // Socials start right under contacts
    expect(socials.y).toBe(contacts.y + contacts.h);
  });

  it('effectiveBackGridForRender keeps services when content exists', () => {
    const card = createGiovanniCardTemplate();
    card.back.services = ['UX Design'];
    const grid = card.backGrid!;
    const effective = effectiveBackGridForRender(grid, card);
    expect(effective.elements.services).toBeDefined();
    expect(effective.elements.socials?.y).toBe(grid.elements.socials?.y);
  });

  it('alignBoxInCell positions bottom-right', () => {
    const pos = alignBoxInCell({ x: 0, y: 0, w: 100, h: 100 }, 20, 20, 'right', 'bottom');
    expect(pos.x).toBe(80);
    expect(pos.y).toBe(80);
  });
});
