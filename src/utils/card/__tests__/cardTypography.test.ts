import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildFrontSvg, buildBackSvg } from '../svgRenderer';
import { CARD_REF } from '../gridConstants';
import { createEmptyCard, createGiovanniCardTemplate } from '../../documentSchemas';

/**
 * Card typography/proportion regression tests (2026-08 audit).
 *
 * 1. Export reference frame unified with the preview surface:
 *    ONE shared reference CARD_REF = 640×414 logical px (eu-85x55 at
 *    CARD_PREVIEW_REF_WIDTH). Export sizes must be pxH * (N / CARD_REF.h),
 *    never the legacy /340 (~22% larger than preview).
 * 2. Back contacts respect the print minimum: val ≥ 19 logical px,
 *    key ≥ 16 logical px (7pt/6pt on 55mm print height).
 * 3. Shrink floors are fractions of CARD_REF (DPI-independent), never
 *    absolute export px (which produced ~2pt text at 300dpi).
 * 4. Front name/title/company wrap + clip like the back contacts cell.
 * 5. Hierarchy: name 22 / title 16 / company 14 logical px.
 */

const PXW = 1024;
const PXH = 663;
const DPI300_H = 650; // 55mm @300dpi ≈ 650px export height

function fontSizeOfText(svg: string, text: string): number {
  const idx = svg.indexOf(text);
  if (idx === -1) return NaN;
  const before = svg.lastIndexOf('<text', idx);
  if (before === -1) return NaN;
  const tag = svg.slice(before, idx);
  const m = tag.match(/font-size="([^"]+)"/);
  return m ? parseFloat(m[1]) : NaN;
}

function frontIdentityCard() {
  return {
    ...createEmptyCard(),
    front: {
      ...createEmptyCard().front,
      name: 'MARIO',
      title: 'Dev',
      company: 'Acme',
      useGrid: true as const,
    },
    grid: {
      cols: 4,
      rows: 4,
      elements: {
        name: { x: 0, y: 0, w: 4, h: 1 },
        title: { x: 0, y: 1, w: 4, h: 1 },
        company: { x: 0, y: 2, w: 4, h: 1 },
      },
    },
  };
}

function backContactsCard(overrides: Partial<ReturnType<typeof createEmptyCard>['back']> = {}, contactsCell = { x: 0, y: 0, w: 4, h: 2 }) {
  return {
    ...createEmptyCard(),
    back: {
      ...createEmptyCard().back,
      phone: '123456789',
      useGrid: true as const,
      ...overrides,
    },
    backGrid: {
      cols: 4,
      rows: 4,
      elements: { contacts: contactsCell },
    },
  };
}

describe('fix 1: unified 640×414 export reference frame', () => {
  it('exposes ONE shared CARD_REF matching the preview surface (640×414)', () => {
    expect(CARD_REF.w).toBe(640);
    expect(CARD_REF.h).toBe(414);
  });

  it('front name font-size / pxH equals the preview fraction of CARD_REF.h', () => {
    const svg = buildFrontSvg(frontIdentityCard() as any, PXW, PXH);
    // name 22 logical px on a 414px-tall preview
    expect(fontSizeOfText(svg, 'MARIO') / PXH).toBeCloseTo(22 / CARD_REF.h, 2);
  });

  it('back contacts val font-size / pxH equals 19/CARD_REF.h', () => {
    const svg = buildBackSvg(backContactsCard() as any, PXW, PXH);
    expect(fontSizeOfText(svg, '123456789') / PXH).toBeCloseTo(19 / CARD_REF.h, 2);
  });
});

describe('fix 2 + 5: print-minimum contacts and hierarchy', () => {
  it('back contacts default sizes: key ≥ 16, val ≥ 19 logical px', () => {
    const svg = buildBackSvg(backContactsCard() as any, PXW, PXH);
    expect(fontSizeOfText(svg, 'TELEFONO')).toBeGreaterThanOrEqual(PXH * (16 / CARD_REF.h) - 0.5);
    expect(fontSizeOfText(svg, '123456789')).toBeGreaterThanOrEqual(PXH * (19 / CARD_REF.h) - 0.5);
  });

  it('front hierarchy: name 22 / title 16 / company 14, name/title ratio ≥ 1.3', () => {
    const svg = buildFrontSvg(frontIdentityCard() as any, PXW, PXH);
    const name = fontSizeOfText(svg, 'MARIO');
    const title = fontSizeOfText(svg, 'Dev');
    const company = fontSizeOfText(svg, 'Acme');
    expect(name).toBeCloseTo(PXH * (22 / CARD_REF.h), 0);
    expect(title).toBeCloseTo(PXH * (16 / CARD_REF.h), 0);
    expect(company).toBeCloseTo(PXH * (14 / CARD_REF.h), 0);
    expect(name / title).toBeGreaterThanOrEqual(1.3);
  });
});

describe('fix 3: DPI-independent shrink floors', () => {
  it('at 300dpi export the contacts font never drops below 16/414 × pxH', () => {
    // Cram 4 long entries into a short (h:1) cell: the shrink path would
    // previously dive toward the absolute 8px floor (~2pt print at 300dpi).
    const card = backContactsCard(
      {
        email: 'a.very.long.email.address@some-company-domain.com',
        address: 'Via della Repubblica 123, 20100 Milano',
        vatNumber: '12345678901',
      },
      { x: 0, y: 0, w: 2, h: 1 },
    );
    const svg = buildBackSvg(card as any, 1004, DPI300_H);
    expect(fontSizeOfText(svg, 'TELEFONO')).toBeGreaterThanOrEqual(DPI300_H * (16 / CARD_REF.h) - 0.5);
    expect(fontSizeOfText(svg, '123456789')).toBeGreaterThanOrEqual(DPI300_H * (19 / CARD_REF.h) - 0.5);
  });

  it('socials never shrink below their base proportion (floor is a fraction of CARD_REF)', () => {
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        useGrid: true as const,
        socials: [
          { platform: 'LinkedIn', url: 'https://linkedin.com/in/a-very-long-profile-handle' },
          { platform: 'GitHub', url: 'https://github.com/another-long-handle' },
          { platform: 'Twitter', url: 'https://twitter.com/yet-another-handle' },
        ],
      },
      backGrid: {
        cols: 4,
        rows: 4,
        elements: { socials: { x: 0, y: 0, w: 2, h: 1 } },
      },
    };
    const svg = buildBackSvg(card as any, 1004, DPI300_H);
    // Base socials alzata a 16/414 (~6pt stampa, floor leggibilità): il
    // test fallisce se la base torna sotto (era 12.16/414 ≈ 4.6pt).
    expect(fontSizeOfText(svg, 'LinkedIn')).toBeGreaterThanOrEqual(DPI300_H * (16 / CARD_REF.h) - 1);
  });

  it('services never shrink below their base proportion (floor is a fraction of CARD_REF)', () => {
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        useGrid: true as const,
        services: ['Uno', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei'],
        servicesLabel: 'Servizi',
      },
      backGrid: {
        cols: 4,
        rows: 4,
        elements: { services: { x: 0, y: 0, w: 2, h: 1 } },
      },
    };
    const svg = buildBackSvg(card as any, 1004, DPI300_H);
    // Base services alzata a 16/414 (~6pt stampa): fallisce se torna a
    // 13.6/414 (≈5.1pt, sotto il floor di leggibilità).
    expect(fontSizeOfText(svg, 'Uno')).toBeGreaterThanOrEqual(DPI300_H * (16 / CARD_REF.h) - 1);
  });
});

describe('fix 4: front name/title/company wrap + clip in export', () => {
  it('a 40-char name wraps to ≥2 lines, is clipped to its cell, and stays in bounds', () => {
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        name: 'ALESSANDRO BARTOLOMEO CRISTOFORO DELLA FRANCESCA',
        useGrid: true as const,
      },
      grid: {
        cols: 4,
        rows: 4,
        elements: { name: { x: 0, y: 0, w: 2, h: 1 } },
      },
    };
    const svg = buildFrontSvg(card as any, PXW, PXH);
    // Hard clip on the name cell, like the back contacts cell (v2.13 rule).
    expect(svg).toMatch(/<clipPath id="clipFront_name/);
    expect(svg).toContain('clip-path="url(#clipFront_name');
    // ≥2 wrapped lines (name renders at font-weight 800).
    const nameLines = svg.match(/<text[^>]*font-weight="800"[^>]*>[^<]+<\/text>/g) ?? [];
    expect(nameLines.length).toBeGreaterThanOrEqual(2);
    // Every painted name line stays inside the card bounds.
    for (const line of nameLines) {
      const x = parseFloat(line.match(/x="([^"]+)"/)![1]);
      const y = parseFloat(line.match(/y="([^"]+)"/)![1]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(PXW);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(PXH);
    }
  });

  it('short name stays a single line (no regression for the common case)', () => {
    const svg = buildFrontSvg(frontIdentityCard() as any, PXW, PXH);
    const nameLines = svg.match(/<text[^>]*font-weight="800"[^>]*>[^<]+<\/text>/g) ?? [];
    expect(nameLines.length).toBe(1);
    expect(svg).toContain('>MARIO<');
  });
});

describe('giovanni fixture sanity after the typography fixes', () => {
  it('back contacts still render every contact value in full (wrap, no truncation)', () => {
    const svg = buildBackSvg(createGiovanniCardTemplate(), PXW, PXH);
    const flattened = svg.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    expect(flattened).toContain('webdevcaglian@gmail.com');
    expect(flattened).toContain('35180008042');
  });
});

describe('preview CSS matches the new logical sizes', () => {
  const cardDir = resolve(__dirname, '../../../components/card');
  const gridCss = readFileSync(join(cardDir, 'cardBase.css'), 'utf8');
  const sideCss = readFileSync(join(cardDir, 'cardPreviewSide.css'), 'utf8');

  function remOf(css: string, selector: string): number {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = css.match(new RegExp(`${escaped}\\s*\\{[^}]*?font-size:\\s*calc\\(([\\d.]+)rem`, 'm'));
    return m ? parseFloat(m[1]) : NaN;
  }

  it('grid-mode contacts: key ≥ 1rem (16px), val ≥ 1.1875rem (19px)', () => {
    expect(remOf(gridCss, '.card-preview-side.grid-mode .card-back-key')).toBeGreaterThanOrEqual(1);
    expect(remOf(gridCss, '.card-preview-side.grid-mode .card-back-val')).toBeGreaterThanOrEqual(1.1875);
  });

  it('grid-mode hierarchy: name ≥ 1.375rem (22px), title ≥ 1rem, company ≥ 0.875rem', () => {
    expect(remOf(gridCss, '.card-preview-side.grid-mode .card-name')).toBeGreaterThanOrEqual(1.375);
    expect(remOf(gridCss, '.card-preview-side.grid-mode .card-title')).toBeGreaterThanOrEqual(1);
    expect(remOf(gridCss, '.card-preview-side.grid-mode .card-company')).toBeGreaterThanOrEqual(0.875);
  });

  it('flexbox back contacts: key ≥ 1rem, val ≥ 1.1875rem', () => {
    expect(remOf(sideCss, '.card-back-key')).toBeGreaterThanOrEqual(1);
    expect(remOf(sideCss, '.card-back-line')).toBeGreaterThanOrEqual(1.1875);
  });
});
