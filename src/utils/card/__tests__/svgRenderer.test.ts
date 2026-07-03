import { describe, it, expect } from 'vitest';
import { buildCardSvg, buildFrontSvg, buildBackSvg } from '../svgRenderer';
import { createEmptyCard, createGiovanniCardTemplate } from '../../documentSchemas';

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

  describe('hostname deduplication', () => {
    it('does not duplicate hostname on front when QR is present on back', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://webdeveloperca.netlify.app' },
        front: { ...createEmptyCard().front, photoUrl: 'data:image/png;base64,PHOTO', layout: 'left' as const },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).not.toContain('webdeveloperca.netlify.app');
    });
  });

  describe('buildCardSvg wrapper', () => {
    it('produces valid SVG wrapper for front', () => {
      const svg = buildCardSvg(createEmptyCard(), 'front', 500, 300);
      expect(svg).toMatch(/^<svg[^>]*>/);
      expect(svg).toMatch(/<\/svg>$/);
      expect(svg).toContain('viewBox="0 0 500 300"');
    });

    it('produces valid SVG wrapper for back with website', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
      const svg = buildCardSvg(card, 'back', 500, 300);
      expect(svg).toContain('CONTATTI');
      expect(svg).toContain('example.com');
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
      // Font is shrunk to fit the 1-row cell, should be well under the naive 27px.
      servicesFontSizes.forEach((size) => expect(size).toBeLessThan(25));
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
