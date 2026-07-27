import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  builderToSvg,
  sanitizeSvg,
  svgToPng,
  svgToPdf,
  svgToJpg,
  svgToIco,
  svgToFaviconZip,
  optimizeSvg,
} from '../logoGenerator';
import type { LogoBuilder } from '../documentSchemas';

const baseBuilder: LogoBuilder = {
  primaryText: 'Acme',
  tagline: 'Solutions',
  iconType: 'none',
  iconGlyph: '',
  iconShape: 'circle',
  primaryColor: '#01696F',
  secondaryColor: '#1a1a2e',
  fontFamily: 'Inter',
  layout: 'horizontal',
  icons: [],
  backgroundImage: null,
  backgroundColor: null,
  gradientFill: false,
  decorativeElements: [],
  imagePrompt: null,
  textBackdrop: 'none',
  textColorMode: 'auto',
  textOffsetX: 0,
  textOffsetY: 0,
  textScale: 1,
  taglineOffsetX: 0,
  taglineOffsetY: 0,
  textPosition: 'overlay',
};

/** Mock minimale di Image + canvas per jsdom. I test verificano la
 * struttura del payload generato (header ICO, signature PDF, ecc.),
 * non il rendering pittorico (impossibile in jsdom). */
function installCanvasMock(): { restore: () => void; sizes: { w: number; h: number }[] } {
  const sizes: { w: number; h: number }[] = [];
  const originalImage = (global as any).Image;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    _src = '';
    crossOrigin = '';
    set src(v: string) {
      this._src = v;
      setTimeout(() => this.onload && this.onload(), 0);
    }
    get src() { return this._src; }
  }
  (global as any).Image = FakeImage;
  const originalCreate = document.createElement.bind(document);
  (document as any).createElement = (tag: string) => {
    const el = originalCreate(tag);
    if (tag === 'canvas') {
      const slot = { w: 0, h: 0 };
      Object.defineProperty(el, 'width', {
        get() { return slot.w; },
        set(v: number) { slot.w = v; },
      });
      Object.defineProperty(el, 'height', {
        get() { return slot.h; },
        set(v: number) { slot.h = v; },
      });
      sizes.push(slot);
      (el as any).getContext = () => ({
        clearRect: () => undefined,
        fillRect: () => undefined,
        drawImage: () => undefined,
        fillStyle: '',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        measureText: (text: string) => ({ width: (text || '').length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }),
      });
      (el as any).toBlob = (cb: (b: Blob | null) => void, type: string, _q?: number) => {
        // PNG signature fittizia; per JPG restituiamo header JFIF finto
        const isPng = (type || '').includes('png');
        const bytes = isPng
          ? new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          : new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
        const blob = new Blob([bytes], { type: type || 'image/png' });
        setTimeout(() => cb(blob), 0);
      };
    }
    return el;
  };
  return {
    restore: () => {
      (global as any).Image = originalImage;
      (document as any).createElement = originalCreate;
    },
    sizes,
  };
}

describe('TB-024 logo export multi-format', () => {
  describe('optimizeSvg', () => {
    it('rimuove commenti e metadata, collassa whitespace', () => {
      const input = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><!-- comment --><metadata>x</metadata><rect width="10" height="10" fill="#fff" stroke="none"/></svg>`;
      const out = optimizeSvg(input);
      expect(out).not.toContain('<!--');
      expect(out).not.toContain('<metadata');
      expect(out).not.toContain('stroke="none"');
      expect(out).not.toContain('>\s<');
    });

    it('rimuove dichiarazione XML', () => {
      const input = `<?xml version="1.0" encoding="UTF-8"?>\n<svg viewBox="0 0 10 10"><rect/></svg>`;
      const out = optimizeSvg(input);
      expect(out.startsWith('<svg')).toBe(true);
    });

    it('preserva primitive essenziali (rect, fill, text)', () => {
      const svg = builderToSvg(baseBuilder);
      const out = optimizeSvg(sanitizeSvg(svg));
      expect(out).toContain('<svg');
      expect(out).toContain('</svg>');
      expect(out).toContain('Acme');
    });

    it('output più corto o uguale all\'input', () => {
      const svg = builderToSvg({ ...baseBuilder, decorativeElements: ['underline', 'dotRing'] });
      const clean = sanitizeSvg(svg);
      const opt = optimizeSvg(clean);
      expect(opt.length).toBeLessThanOrEqual(clean.length);
    });
  });

  describe('svgToPdf', () => {
    // svg2pdf.js richiede getBBox() su elementi SVG, non implementato in
    // jsdom. Saltiamo i test in CI/jsdom; l'esecuzione reale avviene nel
    // browser (verificabile manualmente o via Playwright). Il test esiste
    // per documentare il contratto della funzione.
    const supportsSvgBBox = typeof DOMParser !== 'undefined' && (() => {
      try {
        const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><text>x</text></svg>', 'image/svg+xml');
        const t = doc.querySelector('text') as unknown as SVGTextElement;
        return typeof t?.getBBox === 'function';
      } catch { return false; }
    })();
    const maybeIt = supportsSvgBBox ? it : it.skip;

    maybeIt('restituisce Uint8Array con header PDF (%PDF-)', async () => {
      const mock = installCanvasMock();
      try {
        const svg = sanitizeSvg(builderToSvg(baseBuilder));
        const bytes = await svgToPdf(svg);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(0);
        const head = String.fromCharCode(...Array.from(bytes.slice(0, 5)));
        expect(head.startsWith('%PDF-')).toBe(true);
      } finally {
        mock.restore();
      }
    });

    maybeIt('non si blocca su SVG ben formato', async () => {
      const mock = installCanvasMock();
      try {
        const svg = sanitizeSvg(builderToSvg(baseBuilder));
        const bytes = await svgToPdf(svg);
        expect(bytes.length).toBeGreaterThan(0);
      } finally {
        mock.restore();
      }
    });
  });

  describe('svgToJpg', () => {
    it('restituisce Uint8Array con header JPG (FF D8 FF)', async () => {
      const mock = installCanvasMock();
      try {
        const svg = sanitizeSvg(builderToSvg(baseBuilder));
        const bytes = await svgToJpg(svg, 256, '#FFFFFF');
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes[0]).toBe(0xff);
        expect(bytes[1]).toBe(0xd8);
        expect(bytes[2]).toBe(0xff);
      } finally {
        mock.restore();
      }
    });

    it('rifiuta size <= 0', async () => {
      const svg = sanitizeSvg(builderToSvg(baseBuilder));
      await expect(svgToJpg(svg, 0)).rejects.toThrow();
      await expect(svgToJpg(svg, -10)).rejects.toThrow();
    });
  });

  describe('svgToIco', () => {
    it('restituisce ICO con header ICONDIR corretto (reserved=0, type=1)', async () => {
      const mock = installCanvasMock();
      try {
        const svg = sanitizeSvg(builderToSvg(baseBuilder));
        const bytes = await svgToIco(svg, [16, 32]);
        expect(bytes).toBeInstanceOf(Uint8Array);
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(dv.getUint16(0, true)).toBe(0); // reserved
        expect(dv.getUint16(2, true)).toBe(1); // type ICO
        expect(dv.getUint16(4, true)).toBe(2); // count = 2
      } finally {
        mock.restore();
      }
    });

    it('entry 16 ha width=16 height=16', async () => {
      const mock = installCanvasMock();
      try {
        const svg = sanitizeSvg(builderToSvg(baseBuilder));
        const bytes = await svgToIco(svg, [16, 32, 48]);
        expect(bytes[6]).toBe(16);
        expect(bytes[7]).toBe(16);
        // seconda entry
        expect(bytes[22]).toBe(32);
        expect(bytes[23]).toBe(32);
        // terza entry
        expect(bytes[38]).toBe(48);
        expect(bytes[39]).toBe(48);
      } finally {
        mock.restore();
      }
    });

    it('rifiuta size fuori range (>256)', async () => {
      const svg = sanitizeSvg(builderToSvg(baseBuilder));
      await expect(svgToIco(svg, [16, 512])).rejects.toThrow();
    });

    it('rifiuta array vuoto', async () => {
      const svg = sanitizeSvg(builderToSvg(baseBuilder));
      await expect(svgToIco(svg, [])).rejects.toThrow();
    });
  });

  describe('svgToFaviconZip', () => {
    it('restituisce Uint8Array con signature ZIP (PK\\x03\\x04)', async () => {
      const mock = installCanvasMock();
      try {
        const svg = sanitizeSvg(builderToSvg(baseBuilder));
        const bytes = await svgToFaviconZip(svg, 'favicon');
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(0);
        expect(bytes[0]).toBe(0x50); // P
        expect(bytes[1]).toBe(0x4b); // K
        expect(bytes[2]).toBe(0x03);
        expect(bytes[3]).toBe(0x04);
      } finally {
        mock.restore();
      }
    });
  });

  describe('regression: PNG export preservato', () => {
    // sanity check che i nuovi export non abbiano rotto svgToPng
    it('svgToPng ancora funzionante', async () => {
      const mock = installCanvasMock();
      try {
        const svg = sanitizeSvg(builderToSvg(baseBuilder));
        const bytes = await svgToPng(svg, 64);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(0);
      } finally {
        mock.restore();
      }
    });
  });
});