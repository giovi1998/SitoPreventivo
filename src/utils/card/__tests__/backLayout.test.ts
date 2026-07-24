import { describe, it, expect } from 'vitest';
import {
  backPad,
  backHeaderMetrics,
  backQrSizePx,
  effectiveBackGridForRender,
  alignBoxInCell,
  PREVIEW_REF_H,
} from '../backLayout';
import { createEmptyCard, createGiovanniCardTemplate, gridPresetBackDefault, QR_SIZE_PX } from '../../documentSchemas';
import type { CardGrid } from '../../documentSchemas';

describe('backLayout', () => {
  it('header bodyTop is smaller fraction of height than legacy 0.055*2+pad (v2.10)', () => {
    const pxH = 663;
    const pxW = 1024;
    const pad = backPad(pxW, pxH);
    const m = backHeaderMetrics(pxW, pxH, 1, pad);
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
    // Giovanni template has phone+email (2 contacts). The collapse logic
    // targets stacked grids with contacts h:2 (default preset) — the
    // template's own grid is already dense (v2.8.3) and never collapses.
    card.back.services = [];
    // Per esercitare il collapse v2.15 serve una griglia con socials
    // direttamente sotto contacts (stesso scenario logico di "services vuoto").
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

  it('v2.8.3: Giovanni template backGrid is already dense — effective grid is unchanged', () => {
    const card = createGiovanniCardTemplate();
    // Template ships services + a balanced grid (contacts h:1 top, services
    // middle, socials bottom): no collapse, no injection, no pruning.
    expect(card.back.services.length).toBeGreaterThan(0);
    const grid = card.backGrid!;
    const effective = effectiveBackGridForRender(grid, card);
    expect(effective.elements).toEqual(grid.elements);
  });

  it('v2.15: keeps services and collapses short contacts so the left column stays dense', () => {
    const card = createGiovanniCardTemplate();
    card.back.services = ['UX Design'];
    // Il template Giovanni ha la cella services già presente; per testare il
    // collapse classico usiamo il preset di default (contacts h:2).
    const grid = gridPresetBackDefault();
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
    // Teniamo i servizi popolati per evitare il collapse v2.16 "services empty".
    card.back.address = 'Via Roma 1, Milano';
    card.back.vatNumber = '12345678901';
    const grid = card.backGrid!;
    const effective = effectiveBackGridForRender(grid, card);
    // With 4 contact entries contacts would need h:2, but the template grid
    // already has h:1 and no collapse path triggers (h < 2, services present).
    expect(effective.elements.contacts?.h).toBe(grid.elements.contacts!.h);
    expect(effective.elements.socials?.y).toBe(grid.elements.socials!.y);
  });

  it('alignBoxInCell positions bottom-right', () => {
    const pos = alignBoxInCell({ x: 0, y: 0, w: 100, h: 100 }, 20, 20, 'right', 'bottom');
    expect(pos.x).toBe(80);
    expect(pos.y).toBe(80);
  });

  it('v2.16: services empty + socials present collapses the services row by moving socials up', () => {
    // Balanced back preset: contacts {0,0,2,2}, services {0,2,2,1},
    // socials {0,3,2,1}. When services is empty, collapse the services row
    // by moving socials up to y:2 and align contacts to the bottom of its
    // cell so the two blocks stay vertically dense (no blank services band).
    const card = createGiovanniCardTemplate();
    card.back.services = [];
    card.backGrid = {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left', alignV: 'top' },
        services: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        qr: { x: 2, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
      },
    };
    const effective = effectiveBackGridForRender(card.backGrid, card);
    expect(effective.elements.services).toBeUndefined();
    expect(effective.elements.contacts?.h).toBe(2);
    expect(effective.elements.contacts?.y).toBe(0);
    expect(effective.elements.contacts?.alignV).toBe('bottom');
    expect(effective.elements.socials?.y).toBe(2);
    expect(effective.elements.socials?.h).toBe(1);
  });

  it('v2.16: services and socials empty gives the whole left column to contacts', () => {
    const card = createGiovanniCardTemplate();
    card.back.services = [];
    card.back.socials = [];
    card.backGrid = {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left', alignV: 'top' },
        services: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        qr: { x: 2, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
      },
    };
    const effective = effectiveBackGridForRender(card.backGrid, card);
    expect(effective.elements.services).toBeUndefined();
    expect(effective.elements.socials).toBeUndefined();
    expect(effective.elements.contacts?.h).toBe(4);
    expect(effective.elements.contacts?.y).toBe(0);
  });

  it('v2.16: with services present the balanced preset layout follows the existing v2.15 collapse', () => {
    const card = createGiovanniCardTemplate();
    card.back.services = ['UX Design'];
    card.backGrid = {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left', alignV: 'top' },
        services: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        qr: { x: 2, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
      },
    };
    const effective = effectiveBackGridForRender(card.backGrid, card);
    // The new services-empty rules must not alter the normal case: the
    // existing v2.15 collapse still shrinks short contacts and moves
    // services/socials up.
    expect(effective.elements.contacts?.h).toBe(1);
    expect(effective.elements.services?.y).toBe(1);
    expect(effective.elements.socials?.y).toBe(2);
  });
});
