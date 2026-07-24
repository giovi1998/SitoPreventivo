import { describe, it, expect, vi } from 'vitest';
import { buildCardSvg, buildFrontSvg, buildBackSvg, buildEmbeddedFontImport } from '../svgRenderer';
import { createEmptyCard, createGiovanniCardTemplate, gridPresetBackDefault } from '../../documentSchemas';

describe('svgRenderer', () => {
  describe('font-size attributes', () => {
    it('does not include pt/mm/px units in font-size attributes', () => {
      const card = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: 'MARIO ROSSI', title: 'CEO', company: 'Acme' },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      const fontSizeMatches = svg.match(/font-size="([^"]+)"/g) || [];
      expect(fontSizeMatches.length).toBeGreaterThan(0);
      for (const m of fontSizeMatches) {
        const value = m.replace(/font-size="/, '').replace(/"$/, '');
        expect(value).not.toMatch(/pt$/i);
        expect(value).not.toMatch(/mm$/i);
        expect(value).not.toMatch(/px$/i);
        expect(Number(value)).not.toBeNaN();
      }
    });
  });

  describe('logo rendering', () => {
    it('includes logo image in centered layout when photo+logo are set', () => {
      const card = {
        ...createEmptyCard(),
        front: {
          ...createEmptyCard().front,
          name: 'MARIO',
          photoUrl: 'data:image/png;base64,PHOTO',
          logoUrl: 'data:image/png;base64,LOGO',
          layout: 'centered' as const,
        },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).toContain('data:image/png;base64,LOGO');
      expect((svg.match(/<image /g) || []).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('new front layouts (Phase 2.3)', () => {
    it('renders photo-circle layout with circular clip path', () => {
      const card = {
        ...createEmptyCard(),
        front: {
          ...createEmptyCard().front,
          name: 'MARIO',
          photoUrl: 'data:image/png;base64,PHOTO',
          layout: 'photo-circle' as const,
        },
        grid: {
          cols: 4,
          rows: 4,
          elements: { photo: { x: 1, y: 0, w: 2, h: 2 }, name: { x: 0, y: 2, w: 4, h: 1 }, title: { x: 0, y: 3, w: 4, h: 1 } },
        },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).toContain('clip-path="url(#photoCircle)"');
      expect(svg).toContain('<circle');
    });

    it('renders all new front layouts without empty grid fallback', () => {
      for (const layout of ['right', 'top', 'bottom', 'minimal', 'compact'] as const) {
        const card = {
          ...createEmptyCard(),
          front: { ...createEmptyCard().front, name: 'MARIO', photoUrl: 'data:image/png;base64,PHOTO', layout },
        };
        const svg = buildFrontSvg(card, 1024, 663);
        expect(svg).toContain('MARIO');
        expect(svg).toContain('PHOTO');
      }
    });

    it('renders photo with placement offset and scale (TB-023)', () => {
      const card = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: 'MARIO', photoUrl: 'data:image/png;base64,PHOTO', layout: 'left' as const, useGrid: true },
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            photo: { x: 0, y: 0, w: 2, h: 4, photoPlacement: { x: 0.5, y: -0.5, scale: 1.2 } },
            name: { x: 2, y: 0, w: 2, h: 1 },
            title: { x: 2, y: 1, w: 2, h: 1 },
            company: { x: 2, y: 2, w: 2, h: 1 },
            logo: { x: 2, y: 3, w: 2, h: 1 },
          },
        },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      const imgMatch = svg.match(/<image[^>]*href="[^"]*PHOTO[^"]*"[^>]*>/);
      expect(imgMatch).not.toBeNull();
      const img = imgMatch![0];
      const x = Number(img.match(/x="([^"]+)"/)?.[1] ?? NaN);
      const y = Number(img.match(/y="([^"]+)"/)?.[1] ?? NaN);
      const width = Number(img.match(/width="([^"]+)"/)?.[1] ?? NaN);
      const height = Number(img.match(/height="([^"]+)"/)?.[1] ?? NaN);
      // v2.14: cell size accounts for grid padding (16px/340 ref) + gap (4px/340 ref)
      // pxW=1024, pxH=663 → pad=31, gap=8 → cellW=(962-24)/4=234.5, cellH=(601-24)/4=144.25
      expect(width).toBeCloseTo(2 * 234.5 * 1.2, 0);
      expect(height).toBeCloseTo(4 * 144.25 * 1.2, 0);
      expect(x).toBeGreaterThan(0); // original cell x=0 + nudge right
      expect(y).toBeLessThan(0); // original cell y=0 + nudge up
    });
  });

  describe('hostname deduplication', () => {
    it('does not duplicate hostname on front when QR is present on back', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://example.com' },
        front: { ...createEmptyCard().front, photoUrl: 'data:image/png;base64,PHOTO', layout: 'left' as const },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).not.toContain('example.com');
    });
  });

  describe('buildCardSvg wrapper', () => {
    it('produces valid SVG wrapper for front', () => {
      const svg = buildCardSvg(createEmptyCard(), 'front', 500, 300);
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toMatch(/<\/svg>$/);
      expect(svg).toContain('viewBox="0 0 500 300"');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('produces valid SVG wrapper for back with website', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
      const svg = buildCardSvg(card, 'back', 500, 300);
      expect(svg).toContain('CONTATTI');
      expect(svg).toContain('example.com');
    });

    it('includes @import font style in SVG when fontFamily is a web font (e.g. Oswald)', () => {
      const card = { ...createEmptyCard(), style: { ...createEmptyCard().style, fontFamily: 'Oswald' } };
      const svg = buildCardSvg(card, 'front', 500, 300);
      expect(svg).toContain('fonts.googleapis.com/css2?family=Oswald');
      expect(svg).toContain('@import');
    });

    it('does NOT include @import font style for system fonts (e.g. Georgia)', () => {
      const card = { ...createEmptyCard(), style: { ...createEmptyCard().style, fontFamily: 'Georgia' } };
      const svg = buildCardSvg(card, 'front', 500, 300);
      expect(svg).not.toContain('@import');
    });

    it('includes @import font style also in rotated SVG (90°)', () => {
      const card = { ...createEmptyCard(), style: { ...createEmptyCard().style, fontFamily: 'Oswald' } };
      const svg = buildCardSvg(card, 'front', 500, 300, { rotate: 90 });
      expect(svg).toContain('fonts.googleapis.com/css2?family=Oswald');
      expect(svg).toContain('viewBox="0 0 300 500"');
    });

    it('uses embeddedFontCss when provided instead of @import', () => {
      const card = { ...createEmptyCard(), style: { ...createEmptyCard().style, fontFamily: 'Oswald' } };
      const embeddedFontCss = '<style>@font-face{font-family:"Oswald";src:url(data:font/woff2;base64,AA);}</style>';
      const svg = buildCardSvg(card, 'front', 500, 300, { embeddedFontCss });
      expect(svg).toContain(embeddedFontCss);
      expect(svg).not.toContain('@import');
    });

    it('renders Giovanni template back SVG with full email text and no truncation', () => {
      const card = createGiovanniCardTemplate();
      const svg = buildBackSvg(card, 1024, 663);
      expect(svg).toContain('webdevcaglian@gmail.com');
      // The email should appear in full (not mangled or missing chars)
      expect(svg).toContain('>webdevcaglian@gmail.com<');
      // If wrapped at whitespace it will span multiple <text> or <tspan> lines,
      // or a single line. The important thing is the full string is present.
      const emailMatches = svg.match(/webdevcaglian@gmail\.com/g);
      expect(emailMatches?.length).toBeGreaterThanOrEqual(1);
    });

    it('contact label and value share the same baseline (alphabetic, v2.9 regression)', () => {
      const card = createGiovanniCardTemplate();
      const svg = buildBackSvg(card, 1024, 663);
      // Extract the TELEFONO label and the phone value <text> elements.
      // Use ` y="` (space-prefixed) to avoid matching the `y` inside `opacity`.
      const labelMatch = svg.match(/<text[^>]* y="([^"]+)"[^>]*dominant-baseline="alphabetic"[^>]*>TELEFONO<\/text>/);
      const valueMatch = svg.match(/<text[^>]* y="([^"]+)"[^>]*dominant-baseline="alphabetic"[^>]*>35180008042<\/text>/);
      expect(labelMatch).not.toBeNull();
      expect(valueMatch).not.toBeNull();
      // Same y => same baseline => label and value aligned (matches preview align-items: baseline).
      expect(labelMatch![1]).toBe(valueMatch![1]);
    });

    it('renders services in a dedicated grid cell when backGrid.services is set', () => {
      const card = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          services: ['Consulenza pedagogica', 'Supporto'],
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            services: { x: 0, y: 2, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      const svg = buildBackSvg(card, 1024, 663);
      expect(svg).toContain('Consulenza pedagogica');
      expect(svg).toContain('Supporto');
    });

    it('export socials y follows effectiveBackGridForRender collapse (preview/export parity)', () => {
      // v2.15: short contacts (2 entries) cause the effective grid to collapse
      // contacts by one row and move services/socials up. The export must
      // reflect this layout, so the persisted socials.y=3 becomes effective y=2.
      const base = createGiovanniCardTemplate();
      const atBottom = {
        ...base,
        back: { ...base.back, useGrid: true, services: ['UX Design'] },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            services: { x: 0, y: 2, w: 2, h: 1 },
            socials: { x: 0, y: 3, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      const movedUp = {
        ...atBottom,
        backGrid: {
          ...atBottom.backGrid,
          elements: {
            ...atBottom.backGrid.elements,
            // Same effective positions after collapse: contacts h:1,
            // services y:1, socials y:2.
            contacts: { x: 0, y: 0, w: 2, h: 1 },
            services: { x: 0, y: 1, w: 2, h: 1 },
            socials: { x: 0, y: 2, w: 2, h: 1 },
          },
        },
      };
      const svgBottom = buildBackSvg(atBottom, 1024, 663);
      const svgUp = buildBackSvg(movedUp, 1024, 663);
      const yOf = (svg: string) => {
        const idx = svg.indexOf('LinkedIn');
        const slice = svg.slice(Math.max(0, idx - 200), idx + 50);
        const ym = slice.match(/y="([\d.]+)"/);
        return ym ? parseFloat(ym[1]) : NaN;
      };
      const yBottom = yOf(svgBottom);
      const yUp = yOf(svgUp);
      expect(yBottom).not.toBeNaN();
      expect(yUp).not.toBeNaN();
      // Both should now land at the same effective y (socials moved up one row).
      expect(yUp).toBe(yBottom);
    });

    it('export name respects alignH center (not stuck on right)', () => {
      const base = createGiovanniCardTemplate();
      const card = {
        ...base,
        front: { ...base.front, useGrid: true },
        grid: {
          ...base.grid!,
          elements: {
            ...base.grid!.elements,
            name: { x: 2, y: 0, w: 2, h: 1, alignH: 'center' as const, alignV: 'center' as const },
          },
        },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      // name cell: x=2/4*1024=512, w=512 → center textX = 512+256 = 768
      expect(svg).toMatch(/text-anchor="middle"/);
      const nameIdx = svg.indexOf('GIOVANNI CIDU');
      const slice = svg.slice(Math.max(0, nameIdx - 250), nameIdx);
      expect(slice).toContain('text-anchor="middle"');
      const xMatch = slice.match(/x="([\d.]+)"[^>]*font-weight="800"|font-weight="800"[^>]*x="([\d.]+)"/);
      // Fallback: last x= before the name text
      const xs = [...slice.matchAll(/x="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
      const textX = xs[xs.length - 1];
      expect(textX).toBeGreaterThan(700);
      expect(textX).toBeLessThan(850);
    });

    it('contacts font is decent (comparable to socials) even in a short (h:1) cell', () => {
      // Regression: contacts used a fixed 0.09/0.12 factor of min(cw,ch)
      // with no shrink-to-fit, so a resized h:1 contacts cell rendered
      // "microscopic" text next to socials/services (~0.22-0.25 factor).
      const base = createGiovanniCardTemplate();
      const card = {
        ...base,
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 1 },
            socials: { x: 0, y: 1, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      const svg = buildBackSvg(card, 1024, 663);
      const keySizeMatch = svg.match(/font-size="([\d.]+)"[^>]*font-weight="700"[^>]*opacity="0\.55"/);
      const valSizeMatch = svg.match(/font-size="([\d.]+)"[^>]*font-weight="500"[^>]*fill="#1a1a2e"[^>]*dominant-baseline/);
      expect(keySizeMatch).not.toBeNull();
      const keySize = parseFloat(keySizeMatch![1]);
      // Old behaviour produced ~7-9px key size on a 663/4≈166px-tall cell.
      // New behaviour should be clearly larger (double digits).
      expect(keySize).toBeGreaterThanOrEqual(10);
      if (valSizeMatch) {
        expect(parseFloat(valSizeMatch[1])).toBeGreaterThanOrEqual(10);
      }
    });

    it('export honours card.style.fontFamily instead of hardcoded Inter (preview/export parity)', () => {
      // Regression: every <text> in the SVG export hardcoded
      // font-family="Inter, system-ui, sans-serif" regardless of the
      // font the user picked in the style panel (e.g. "Oswald"), while
      // CardPreview.tsx applies card.style.fontFamily via CSS. Preview
      // and export showed different fonts as a result.
      const base = createGiovanniCardTemplate();
      const card = { ...base, style: { ...base.style, fontFamily: 'Oswald' } };
      const frontSvg = buildFrontSvg(card, 1024, 663);
      const backSvg = buildBackSvg(card, 1024, 663);
      expect(frontSvg).not.toContain('font-family="Inter, system-ui, sans-serif"');
      expect(backSvg).not.toContain('font-family="Inter, system-ui, sans-serif"');
      expect(frontSvg).toContain('font-family="Oswald, sans-serif"');
      expect(backSvg).toContain('font-family="Oswald, sans-serif"');
    });

    it('quotes multi-word font families and applies a serif fallback for serif fonts', () => {
      const base = createGiovanniCardTemplate();
      const serifCard = { ...base, style: { ...base.style, fontFamily: 'Playfair Display' } };
      const svg = buildFrontSvg(serifCard, 1024, 663);
      expect(svg).toContain("font-family=\"'Playfair Display', serif\"");
    });

    it('socials in preview/export never render an isolated "·" separator (regression)', () => {
      // Regression: joining "Platform · handle" entries with ' · ' and
      // then wrapping the flat string at whitespace could leave a lone
      // "·" as the first token of a wrapped line (e.g. "· GitHub ...").
      const base = createGiovanniCardTemplate();
      const card = {
        ...base,
        back: {
          ...base.back,
          // I bullet dei servizi usano legittimamente '·'; questo test è sul
          // separatore dei social, quindi svuotiamo i servizi per isolarlo.
          services: [],
          socials: [
            { platform: 'LinkedIn', url: 'https://linkedin.com/in/giovanni-cidu-16162b212' },
            { platform: 'GitHub', url: 'https://github.com/GiovanniCidu' },
          ],
        },
      };
      const svg = buildBackSvg(card, 1024, 663);
      expect(svg).not.toContain('·');
      expect(svg).toContain('LinkedIn');
      expect(svg).toContain('GitHub');
    });

    it('buildCardSvg rotate=90 swaps dimensions and wraps content in rotated group', () => {
      const svg = buildCardSvg(createEmptyCard(), 'front', 1000, 600, { rotate: 90 });
      expect(svg).toMatch(/viewBox="0 0 600 1000"/);
      expect(svg).toMatch(/width="600"/);
      expect(svg).toMatch(/height="1000"/);
      expect(svg).toContain('transform="translate(600 0) rotate(90)"');
    });

    it('buildCardSvg rotate=90 includes content within the swapped viewBox (not off-canvas)', () => {
      const card = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: 'VISIBLE', company: 'CO' },
      };
      const svg = buildCardSvg(card, 'front', 1000, 600, { rotate: 90 });
      // The content must be wrapped in a translated group so it renders inside
      // the 600x1000 viewBox (regression: previously rotate(90) alone pushed
      // everything to negative x, producing a blank PDF 10-up).
      expect(svg).toContain('VISIBLE');
      expect(svg).toMatch(/translate\(600 0\) rotate\(90\)/);
    });
  });

  describe('embedded font import (v2.8.2 regression)', () => {
    it('inlines Google Font CSS without double url(...) wrapper', async () => {
      const fontCss = '@font-face{font-family:"Oswald";src:url(https://fonts.gstatic.com/oswald.woff2) format("woff2");}';
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => fontCss,
        headers: new Map([['content-type', 'font/woff2']]),
      }).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['fake-font-bytes'], { type: 'font/woff2' }),
        headers: new Map([['content-type', 'font/woff2']]),
      });

      const style = await buildEmbeddedFontImport('Oswald');
      expect(style).toContain('@font-face');
      expect(style).toContain('data:font/woff2;base64,');
      // The bug was replacing the inner URL only, leaving an outer `url(` wrapper.
      expect(style).not.toContain('url(url(');
      expect(style).toMatch(/src:\s*url\(data:font\/woff2;base64,/);
    });

    it('returns empty string for unknown font family', async () => {
      const style = await buildEmbeddedFontImport('TotallyUnknownFont');
      expect(style).toBe('');
    });

    it('falls back to empty string when Google Fonts CSS fetch fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
      const style = await buildEmbeddedFontImport('Inter');
      expect(style).toBe('');
    });
  });

  describe('QR size in grid-mode (REQ-E02)', () => {
    // Card reale card_1783109905347_v0p5j5: backGrid con qr a (2,0,2,4)
    // copre metà destra. qrSize "small" deve limitare il QR renderizzato,
    // non usare l'intera cella.
    function buildCardWithQr(qrSize: 'small' | 'medium' | 'large') {
      return {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          website: 'https://example.com',
          qrSize,
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            services: { x: 0, y: 2, w: 2, h: 1 },
            socials: { x: 0, y: 3, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
    }

    it('small qrSize produces a QR smaller than the grid cell', () => {
      const card = buildCardWithQr('small');
      const svg = buildBackSvg(card, 1024, 663);
      // Estrai la dimensione del rect bianco del QR
      const rectMatch = svg.match(/<rect[^>]+fill="#FFFFFF"[^>]+stroke[^>]+>/);
      expect(rectMatch).not.toBeNull();
      const rect = rectMatch![0];
      const wMatch = rect.match(/width="(\d+)"/);
      const hMatch = rect.match(/height="(\d+)"/);
      expect(wMatch).not.toBeNull();
      expect(hMatch).not.toBeNull();
      const qrW = parseInt(wMatch![1], 10);
      const qrH = parseInt(hMatch![1], 10);
      // La cella qr è 2 cols su 4 → ~512px wide. Un QR "small" deve essere
      // molto più piccolo della cella.
      expect(qrW).toBeLessThan(400);
      expect(qrH).toBeLessThan(400);
      expect(qrW).toBe(qrH); // quadrato
    });

    it('large qrSize produces a larger QR than small', () => {
      const smallCard = buildCardWithQr('small');
      const largeCard = buildCardWithQr('large');
      const smallSvg = buildBackSvg(smallCard, 1024, 663);
      const largeSvg = buildBackSvg(largeCard, 1024, 663);
      const extractQrSize = (svg: string) => {
        const rectMatch = svg.match(/<rect[^>]+fill="#FFFFFF"[^>]+stroke[^>]+>/);
        if (!rectMatch) return 0;
        const wMatch = rectMatch[0].match(/width="(\d+)"/);
        return wMatch ? parseInt(wMatch[1], 10) : 0;
      };
      const smallSize = extractQrSize(smallSvg);
      const largeSize = extractQrSize(largeSvg);
      expect(largeSize).toBeGreaterThan(smallSize);
    });
  });

  describe('AI cover image rendering (spec v2.4)', () => {
    it('renders coverImageUrl as a full-bleed image above the base background', () => {
      const card = {
        ...createEmptyCard(),
        front: {
          ...createEmptyCard().front,
          name: 'MARIO',
          coverImageUrl: 'data:image/png;base64,COVER',
        },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).toContain('data:image/png;base64,COVER');
      const imgIdx = svg.indexOf('data:image/png;base64,COVER');
      const bgIdx = svg.indexOf(`<rect width="1024" height="663" fill="${card.style.bgColor}"/\u003e`);
      expect(imgIdx).toBeGreaterThan(-1);
      expect(bgIdx).toBeGreaterThan(-1);
      expect(imgIdx).toBeGreaterThan(bgIdx);
    });

    it('does not include cover image when coverImageUrl is null', () => {
      const card = createEmptyCard();
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).not.toContain('data:image/png;base64,COVER');
    });

    it('adds a readability wash (flat tint + vertical gradient) on top of the cover', () => {
      const card = {
        ...createEmptyCard(),
        front: {
          ...createEmptyCard().front,
          name: 'MARIO',
          coverImageUrl: 'data:image/png;base64,COVER',
        },
        style: { ...createEmptyCard().style, bgColor: '#1a1a2e', textColor: '#FFFFFF' },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      // Flat tint of the card's bgColor, 60% opacity, over the cover.
      // v2.4: stronger wash so AI cover (which can be saturated) does
      // not visually compete with the user text.
      expect(svg).toContain('fill="#1a1a2e" opacity="0.6"');
      // Linear gradient on top, going from 0% (top) to 80% (bottom) of
      // bgColor, with the calmest area at the bottom where the user
      // name sits by default in the Giovanni template.
      expect(svg).toContain('id="frontReadGrad"');
      expect(svg).toContain('stop-color="#1a1a2e" stop-opacity="0"');
      expect(svg).toContain('stop-color="#1a1a2e" stop-opacity="0.8"');
    });

    it('does not add the cover wash when cover is absent', () => {
      const card = createEmptyCard();
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).not.toContain('id="frontReadGrad"');
      expect(svg).not.toContain('id="backReadGrad"');
    });

    it('renders back cover image and wash', () => {
      const card = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          coverImageUrl: 'data:image/png;base64,BACKCOVER',
        },
      };
      const svg = buildBackSvg(card, 1024, 663);
      expect(svg).toContain('data:image/png;base64,BACKCOVER');
      // Back cover wash: flat 35% (lighter than front's 60%) + gradient.
      expect(svg).toContain('id="backReadGrad"');
      expect(svg).toContain(`fill="${card.style.bgColor}" opacity="0.35"`);
    });
  });

  describe('back header/body layout', () => {
    it('offsets grid body below the header so contacts do not overlap the header', () => {
      const card = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          website: 'https://example.com',
          phone: '3408613407',
          email: 'test@example.com',
          services: ['Consulenza pedagogica', 'Supporto'],
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            services: { x: 0, y: 2, w: 2, h: 1 },
            socials: { x: 0, y: 3, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      const svg = buildBackSvg(card, 1050, 650);
      // Header text is around y=78 (top of text). Contacts must be clearly below the divider.
      const headerY = extractFirstTextY(svg, 'CONTATTI');
      const phoneY = extractFirstTextY(svg, 'TELEFONO');
      expect(headerY).toBeGreaterThan(0);
      expect(phoneY).toBeGreaterThan(headerY + 20);
    });

    it('shrinks services font so the list fits inside the services cell', () => {
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          useGrid: true,
          services: ['Consulenza pedagogica', 'Supporto alla genitorialità'],
          servicesLabel: 'Servizi che offro',
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            services: { x: 0, y: 2, w: 2, h: 1 },
            socials: { x: 0, y: 3, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      const svg = buildBackSvg(card, 1050, 650);
      const servicesFontSizes = extractTextFontSizes(svg, 'Consulenza pedagogica');
      expect(servicesFontSizes.length).toBeGreaterThan(0);
      // v2.5.1: floor raised to 14px and line-height tightened to 1.2,
      // so 2 services + label fit a 1-row cell at a readable size
      // (previously shrunk to ~20px, now stays around 30-38px). The
      // font is still bounded by the cell height, just no longer
      // collapses to invisible.
      servicesFontSizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(14));
      servicesFontSizes.forEach((size) => expect(size).toBeLessThan(50));
    });

    it('v2.12: logo is 72% of cell and 3×3 moves the box (not only preserveAspectRatio)', () => {
      const base = createEmptyCard();
      const make = (alignH: 'left' | 'center' | 'right', alignV: 'top' | 'center' | 'bottom') => ({
        ...base,
        front: {
          ...base.front,
          useGrid: true,
          logoUrl: 'data:image/png;base64,LOGO',
          name: 'MARIO',
        },
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            logo: { x: 0, y: 0, w: 2, h: 2, alignH, alignV },
            name: { x: 2, y: 0, w: 2, h: 1 },
          },
        },
      });
      const leftTop = buildFrontSvg(make('left', 'top'), 1024, 663);
      const rightBottom = buildFrontSvg(make('right', 'bottom'), 1024, 663);
      const center = buildFrontSvg(make('center', 'center'), 1024, 663);
      expect(leftTop).toContain('preserveAspectRatio="xMinYMin meet"');
      expect(rightBottom).toContain('preserveAspectRatio="xMaxYMax meet"');
      expect(center).toContain('preserveAspectRatio="xMidYMid meet"');
      const attrsOf = (svg: string) => {
        const m = svg.match(
          /<image[^>]*href="data:image\/png;base64,LOGO"[^>]*\/?>|<image[^>]*href='data:image\/png;base64,LOGO'[^>]*\/?>/,
        );
        // Our builder writes attributes before href; match full image tag around LOGO.
        const idx = svg.indexOf('data:image/png;base64,LOGO');
        expect(idx).toBeGreaterThan(0);
        const open = svg.lastIndexOf('<image', idx);
        const close = svg.indexOf('/>', idx);
        const tag = svg.slice(open, close > 0 ? close + 2 : open + 400);
        const x = Number(tag.match(/\sx="([\d.]+)"/)?.[1]);
        const y = Number(tag.match(/\sy="([\d.]+)"/)?.[1]);
        const w = Number(tag.match(/\swidth="([\d.]+)"/)?.[1]);
        return { x, y, w, tag };
      };
      const c = attrsOf(center);
      const l = attrsOf(leftTop);
      const r = attrsOf(rightBottom);
      // v2.14: cell w accounts for grid padding+gap → 469 → 72% = 337.68
      expect(c.w).toBeCloseTo(469 * 0.72, 0);
      // 3×3 must move the logo box, not only the aspect-ratio paint
      expect(l.x).toBeLessThan(c.x);
      expect(r.x).toBeGreaterThan(c.x);
      expect(l.y).toBeLessThan(c.y);
      expect(r.y).toBeGreaterThan(c.y);
    });

    it('v2.10.1: contact font sizes stay readable-but-not-huge at export DPI', () => {
      const card = createGiovanniCardTemplate();
      const svg = buildBackSvg(card, 1024, 663);
      // TELEFONO key: should be ~18px (9.3/340*663), not 50+
      const idx = svg.indexOf('TELEFONO');
      expect(idx).toBeGreaterThan(0);
      const tag = svg.slice(Math.max(0, idx - 200), idx);
      const m = tag.match(/font-size="([\d.]+)"/);
      expect(m).not.toBeNull();
      const size = parseFloat(m![1]);
      expect(size).toBeGreaterThanOrEqual(12);
      expect(size).toBeLessThan(28);
    });

    it('v2.13: default back preset keeps socials inside contacts half (clip, no full-card spill)', () => {
      // Regression: preset without socials cell put socials as one long <text>
      // that spilled across the whole export (user screenshot 2026-07-14).
      const card = createGiovanniCardTemplate();
      card.back.services = [];
      card.backGrid = gridPresetBackDefault();
      const svg = buildBackSvg(card, 1024, 663);
      expect(svg).toContain('LinkedIn');
      // Must use a clipPath for the socials (or contacts fallback) cell.
      expect(svg).toMatch(/clipPath id="clip(Socials|Contacts)/);
      // Collect LinkedIn text x positions — all must be in left half (x < 520).
      const re = /<text[^>]*x="([\d.]+)"[^>]*>[^<]*LinkedIn/g;
      let m: RegExpExecArray | null;
      let found = 0;
      while ((m = re.exec(svg)) !== null) {
        found += 1;
        expect(parseFloat(m[1])).toBeLessThan(520);
      }
      expect(found).toBeGreaterThan(0);
    });

    it('v2.16: empty services expands contacts into the gap; socials stays at persisted y', () => {
      const card = createGiovanniCardTemplate();
      card.back.services = [];
      const withGap = {
        ...card,
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            services: { x: 0, y: 2, w: 2, h: 1 },
            socials: { x: 0, y: 3, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      const withServices = {
        ...withGap,
        back: { ...withGap.back, services: ['UX Design'] },
      };
      const yOf = (svg: string) => {
        const idx = svg.indexOf('LinkedIn');
        expect(idx).toBeGreaterThan(0);
        const slice = svg.slice(Math.max(0, idx - 200), idx + 20);
        const ym = slice.match(/y="([\d.]+)"/);
        return ym ? parseFloat(ym[1]) : NaN;
      };
      const yEmpty = yOf(buildBackSvg(withGap, 1024, 663));
      const yWithServices = yOf(buildBackSvg(withServices, 1024, 663));
      expect(yEmpty).not.toBeNaN();
      expect(yWithServices).not.toBeNaN();
      // Services empty: the services row is collapsed by moving socials up
      // to y:2, so socials now renders at roughly the same y as when services
      // are present (v2.15 collapse also moves socials up to y:2).
      expect(yEmpty - yWithServices).toBeGreaterThanOrEqual(-10);
      expect(yEmpty - yWithServices).toBeLessThan(10);
    });

    it('v2.9.1: services still render when backGrid.services is missing but services content exists (regression)', () => {
      // Card reale card_1784571073837_hm54u1: backGrid 4×4 con contacts,
      // socials, qr ma SENZA services. I servizi in card.back.services
      // spariscono dall'export se non c'è l'elemento dedicato. Fix: inject
      // la cella services dal preset di default solo per i servizi (i social
      // restano nel fallback dentro contacts per non rompere i test esistenti).
      const base = createGiovanniCardTemplate();
      const card = {
        ...base,
        back: {
          ...base.back,
          services: ['Consulenza pedagogica', 'Supporto famiglie', 'Formazione docenti'],
          servicesLabel: 'Servizi',
          useGrid: true,
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            socials: { x: 0, y: 3, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      const svg = buildBackSvg(card, 1024, 663);
      expect(svg).toContain('Consulenza pedagogica');
      expect(svg).toContain('Supporto famiglie');
      expect(svg).toContain('Formazione docenti');
      expect(svg).toContain('SERVIZI');
    });
  });
});

function extractFirstTextY(svg: string, text: string): number {
  const idx = svg.indexOf(`>${text}`);
  if (idx === -1) return -1;
  const before = svg.lastIndexOf('<text', idx);
  if (before === -1) return -1;
  const tag = svg.slice(before, idx);
  const m = tag.match(/y="([^"]+)"/);
  return m ? parseFloat(m[1]) : -1;
}

function extractTextFontSizes(svg: string, text: string): number[] {
  const sizes: number[] = [];
  let pos = 0;
  while (true) {
    const idx = svg.indexOf(text, pos);
    if (idx === -1) break;
    const before = svg.lastIndexOf('<text', idx);
    if (before === -1) { pos = idx + 1; continue; }
    const tag = svg.slice(before, idx);
    const m = tag.match(/font-size="([^"]+)"/);
    if (m) sizes.push(parseFloat(m[1]));
    pos = idx + 1;
  }
  return sizes;
}

// v2.14 regression: preview/export parity fixes
describe('v2.14 preview/export parity', () => {
  it('front font sizes are rem-based (proportional to card height, not cell height)', () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO', title: 'Dev', useGrid: true },
      grid: {
        cols: 4, rows: 4,
        elements: {
          name: { x: 0, y: 0, w: 4, h: 1 },
          title: { x: 0, y: 1, w: 4, h: 1 },
        },
      },
    };
    const svg = buildFrontSvg(card, 1024, 663);
    // v2.17: name 1.15rem = 18.4/340; title 0.9rem = 14.4/340 (fontScale=1)
    // name: 663 * (18.4/340) = 35.9 → ~36
    // title: 663 * (14.4/340) = 28.1 → ~28
    const nameSize = fontSizeOfText(svg, 'MARIO');
    const titleSize = fontSizeOfText(svg, 'Dev');
    expect(nameSize).toBeCloseTo(663 * (18.4 / 340), 0);
    expect(titleSize).toBeCloseTo(663 * (14.4 / 340), 0);
  });

  it('front grid cells have padding offset (not starting at 0,0)', () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO', useGrid: true },
      grid: {
        cols: 4, rows: 4,
        elements: { name: { x: 0, y: 0, w: 4, h: 1, alignV: 'top' as const } },
      },
    };
    const svg = buildFrontSvg(card, 1024, 663);
    // With grid padding (16/340*663 ≈ 31), the first cell starts at y≈31, not y=0
    const nameY = yOfText(svg, 'MARIO');
    expect(nameY).toBeGreaterThan(10); // should be ≈31+3=34, not 0
  });

  it('back key/val font sizes match grid-mode rem values (10.88/12.8 base)', () => {
    const card = {
      ...createEmptyCard(),
      back: { ...createEmptyCard().back, phone: '123456789', useGrid: true },
      backGrid: {
        cols: 4, rows: 4,
        elements: {
          contacts: { x: 0, y: 0, w: 4, h: 2 },
        },
      },
    };
    const svg = buildBackSvg(card, 1024, 663);
    // v2.17: key 0.68rem = 10.88/340 → 663*(10.88/340) ≈ 21.2
    // val 0.8rem = 12.8/340 → 663*(12.8/340) ≈ 24.9
    const keySize = fontSizeOfText(svg, 'TELEFONO');
    const valSize = fontSizeOfText(svg, '123456789');
    expect(keySize).toBeCloseTo(663 * (10.88 / 340), 0);
    expect(valSize).toBeCloseTo(663 * (12.8 / 340), 0);
  });
});

describe('svgRenderer v2.16 preview/export parity fixes (TB-023)', () => {
  it('QR fgColor uses card textColor (was hardcoded #000000)', () => {
    const base = createEmptyCard();
    const card = {
      ...base,
      style: { ...base.style, textColor: '#112233' },
      front: { ...base.front, name: '' },
      back: { ...base.back, useGrid: true, qrLabel: '', qrPayload: 'https://example.com' },
      backGrid: {
        cols: 4, rows: 4,
        elements: { qr: { x: 0, y: 0, w: 2, h: 2 } },
      },
    };
    const svg = buildBackSvg(card as any, 1024, 663);
    // QR modules are filled with the text color, matching the preview
    // (CardPreview builds the QR with fgColor: card.style.textColor).
    expect(svg).toContain('#112233');
    expect(svg).not.toContain("fgColor: '#000000'");
  });

  it('front cover wash mid-stop is 0.25 (parity with preview hex alpha 40)', () => {
    const base = createEmptyCard();
    const card = {
      ...base,
      front: { ...base.front, coverImageUrl: 'data:image/png;base64,AAAA' },
    };
    const svg = buildFrontSvg(card as any, 1024, 663);
    expect(svg).toContain('stop-opacity="0.25"');
    expect(svg).not.toContain('stop-opacity="0.4"');
  });

  it('grid-mode photo has accent border stroke (parity with .card-photo CSS)', () => {
    const base = createEmptyCard();
    const card = {
      ...base,
      style: { ...base.style, accentColor: '#AABBCC' },
      front: { ...base.front, photoUrl: 'data:image/png;base64,AAAA', useGrid: true },
      grid: {
        cols: 4, rows: 4,
        elements: { photo: { x: 0, y: 0, w: 2, h: 3 } },
      },
    };
    const svg = buildFrontSvg(card as any, 1024, 663);
    expect(svg).toMatch(/<rect[^>]*fill="none" stroke="#AABBCC"/);
  });

  it('logo falls back into photo cell when no photo and no logo element (preview parity)', () => {
    const base = createEmptyCard();
    const card = {
      ...base,
      front: { ...base.front, photoUrl: null, logoUrl: 'data:image/png;base64,LOGO', useGrid: true },
      grid: {
        cols: 4, rows: 4,
        elements: { photo: { x: 0, y: 0, w: 2, h: 3 } },
      },
    };
    const svg = buildFrontSvg(card as any, 1024, 663);
    expect(svg).toContain('data:image/png;base64,LOGO');
  });

  it('services expand into socials row when socials element exists but content is empty', () => {
    const base = createEmptyCard();
    const mkCard = (withSocialsEl: boolean) => ({
      ...base,
      back: {
        ...base.back,
        useGrid: true,
        services: ['Consulenza', 'Supporto'],
        socials: [],
      },
      backGrid: {
        cols: 4, rows: 4,
        elements: {
          contacts: { x: 0, y: 0, w: 2, h: 2 },
          services: { x: 0, y: 2, w: 2, h: 1 },
          qr: { x: 2, y: 0, w: 2, h: 4 },
          ...(withSocialsEl ? { socials: { x: 0, y: 3, w: 2, h: 1 } } : {}),
        },
      },
    });
    const svgWithout = buildBackSvg(mkCard(false) as any, 1024, 663);
    const svgWith = buildBackSvg(mkCard(true) as any, 1024, 663);
    // Both must render the services block at the same geometry: an empty
    // socials element must not block the expansion (preview behavior).
    const yOf = (svg: string) => yOfText(svg, 'Consulenza');
    expect(yOf(svgWith)).toBe(yOf(svgWithout));
  });
});

function fontSizeOfText(svg: string, text: string): number {
  const idx = svg.indexOf(text);
  if (idx === -1) return NaN;
  const before = svg.lastIndexOf('<text', idx);
  if (before === -1) return NaN;
  const tag = svg.slice(before, idx);
  const m = tag.match(/font-size="([^"]+)"/);
  return m ? parseFloat(m[1]) : NaN;
}

function yOfText(svg: string, text: string): number {
  const idx = svg.indexOf(text);
  if (idx === -1) return NaN;
  const before = svg.lastIndexOf('<text', idx);
  if (before === -1) return NaN;
  const tag = svg.slice(before, idx);
  const m = tag.match(/y="([^"]+)"/);
  return m ? parseFloat(m[1]) : NaN;
}
