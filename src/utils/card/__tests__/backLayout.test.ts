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
import type { CardGrid } from '../../documentSchemas';

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

  it('v2.15: collapses short contacts and moves socials up when services are empty', () => {
    const card = createGiovanniCardTemplate();
    // Giovanni template has phone+email (2 contacts), services empty.
    card.back.services = [];
    // v2.16: la griglia derivata del template non ha più la cella services
    // fantasma e socials resta in fondo (y:3, riga 2 libera per eventuali
    // servizi futuri). Per esercitare il collapse v2.15 serve una griglia
    // con socials direttamente sotto contacts (stesso scenario logico di
    // "services vuoto" della v2.15).
    const grid: CardGrid = {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left', alignV: 'top' },
        socials: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        qr: { x: 2, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
      },
    };
    const effective = effectiveBackGridForRender(grid, card);
    expect(effective.elements.services).toBeUndefined();
    // Contacts shrink from h:2 to h:1; socials move up one row.
    expect(effective.elements.contacts?.h).toBe(grid.elements.contacts!.h - 1);
    expect(effective.elements.socials?.y).toBe(grid.elements.socials!.y - 1);
    expect(effective.elements.socials?.h).toBe(grid.elements.socials!.h);
  });

  it('v2.16: griglia derivata del template senza cella services resta invariata al render', () => {
    const card = createGiovanniCardTemplate();
    card.back.services = [];
    const grid = card.backGrid!;
    // Nessuna cella fantasma nella griglia persistita del template.
    expect(grid.elements.services).toBeUndefined();
    expect(grid.elements.socials).toBeDefined();
    const effective = effectiveBackGridForRender(grid, card);
    // Socials non è direttamente sotto contacts (riga 2 riservata ai
    // servizi): nessun collapse, posizioni invariate.
    expect(effective.elements.services).toBeUndefined();
    expect(effective.elements.contacts?.h).toBe(grid.elements.contacts!.h);
    expect(effective.elements.socials?.y).toBe(grid.elements.socials!.y);
  });

  it('v2.15: keeps services and collapses short contacts so the left column stays dense', () => {
    const card = createGiovanniCardTemplate();
    card.back.services = ['UX Design'];
    const grid = card.backGrid!;
    // v2.16: la griglia persistita non ha la cella services; il renderer la
    // inietta dal preset di default (x:0, y:2, w:2, h:1) per non perdere il
    // contenuto, poi applica il collapse.
    expect(grid.elements.services).toBeUndefined();
    const effective = effectiveBackGridForRender(grid, card);
    expect(effective.elements.services).toBeDefined();
    // Contacts shrink from h:2 to h:1, services move up one row (2→1),
    // socials move up one row (3→2).
    expect(effective.elements.contacts?.h).toBe(grid.elements.contacts!.h - 1);
    expect(effective.elements.services?.y).toBe(1);
    expect(effective.elements.socials?.y).toBe(grid.elements.socials!.y - 1);
  });

  it('does not collapse contacts when there are many contact entries', () => {
    const card = createGiovanniCardTemplate();
    card.back.services = [];
    card.back.address = 'Via Roma 1, Milano';
    card.back.vatNumber = '12345678901';
    const grid = card.backGrid!;
    const effective = effectiveBackGridForRender(grid, card);
    // With 4 contact entries contacts needs h:2; socials stay at persisted y.
    expect(effective.elements.contacts?.h).toBe(grid.elements.contacts!.h);
    expect(effective.elements.socials?.y).toBe(grid.elements.socials!.y);
  });

  it('alignBoxInCell positions bottom-right', () => {
    const pos = alignBoxInCell({ x: 0, y: 0, w: 100, h: 100 }, 20, 20, 'right', 'bottom');
    expect(pos.x).toBe(80);
    expect(pos.y).toBe(80);
  });
});
