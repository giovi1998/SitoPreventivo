import { describe, it, expect } from 'vitest';
import {
  builderToSvg,
  sanitizeSvg,
  svgToPng,
  isValidLucideIcon,
  LUCIDE_ICONS,
  replaceText,
  replaceColor,
  applyLayout,
  isHexColor,
  escapeXml,
} from '../logoGenerator';
import { createEmptyLogo } from '../documentSchemas';
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
};

describe('logoGenerator', () => {
  describe('LUCIDE_ICONS allowlist', () => {
    it('exposes exactly 48 icon names', () => {
      expect(LUCIDE_ICONS.length).toBe(48);
    });

    it('contains only unique names', () => {
      const unique = new Set(LUCIDE_ICONS);
      expect(unique.size).toBe(LUCIDE_ICONS.length);
    });

    it('isValidLucideIcon returns true for names in the list', () => {
      expect(isValidLucideIcon('coffee')).toBe(true);
      expect(isValidLucideIcon('cpu')).toBe(true);
      expect(isValidLucideIcon('scissors')).toBe(true);
      expect(isValidLucideIcon('briefcase')).toBe(true);
    });

    it('isValidLucideIcon returns false for unknown names', () => {
      expect(isValidLucideIcon('evil-icon')).toBe(false);
      expect(isValidLucideIcon('not-a-real-icon')).toBe(false);
      expect(isValidLucideIcon('')).toBe(false);
      expect(isValidLucideIcon('COFFEE')).toBe(false);
    });
  });

  describe('escapeXml / isHexColor', () => {
    it('escapeXml escapes special characters', () => {
      expect(escapeXml('<script>')).toBe('&lt;script&gt;');
      expect(escapeXml('A & B')).toBe('A &amp; B');
      expect(escapeXml(`'quote'`)).toBe('&apos;quote&apos;');
      expect(escapeXml('"x"')).toBe('&quot;x&quot;');
    });

    it('isHexColor accepts #RRGGBB only', () => {
      expect(isHexColor('#01696F')).toBe(true);
      expect(isHexColor('#ffffff')).toBe(true);
      expect(isHexColor('#ABCDEF')).toBe(true);
      expect(isHexColor('red')).toBe(false);
      expect(isHexColor('#FFF')).toBe(false);
      expect(isHexColor('#01696FFF')).toBe(false);
    });
  });

  describe('builderToSvg', () => {
    it('returns a valid SVG string with the default viewBox', () => {
      const svg = builderToSvg(baseBuilder);
      expect(svg).toMatch(/<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(svg).toContain('viewBox="0 0 400 160"');
      expect(svg).toContain('</svg>');
    });

    it('includes the primaryText in the SVG output', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: 'Acme' });
      expect(svg).toContain('Acme');
    });

    it('includes the tagline in the SVG output', () => {
      const svg = builderToSvg({ ...baseBuilder, tagline: 'Hello World' });
      expect(svg).toContain('Hello World');
    });

    it('escapes XML in primaryText to prevent XSS (AC-011)', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: '<script>alert(1)</script>' });
      expect(svg).toContain('&lt;script&gt;');
      expect(svg).not.toContain('<script>');
    });

    it('escapes XML in tagline', () => {
      const svg = builderToSvg({ ...baseBuilder, tagline: 'A & B' });
      expect(svg).toContain('A &amp; B');
    });

    it('produces a different layout for each layout value', () => {
      const h = builderToSvg({ ...baseBuilder, layout: 'horizontal' });
      const v = builderToSvg({ ...baseBuilder, layout: 'vertical' });
      const s = builderToSvg({ ...baseBuilder, layout: 'stacked' });
      expect(h).not.toBe(v);
      expect(v).not.toBe(s);
      expect(h).not.toBe(s);
    });

    it('omits icon shape when iconType=none (AC iconType=none hidden)', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'none' });
      // Nessun <circle>/<rect>/<polygon> per la shape quando iconType=none
      expect(svg).not.toContain('<polygon');
    });

    it('renders a shape when iconType=shape', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'shape', iconShape: 'circle' });
      expect(svg).toContain('<circle');
    });

    it('renders the monogram letters inside the shape', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'monogram', iconGlyph: 'AC' });
      expect(svg).toContain('AC');
      expect(svg).toContain('<circle');
    });

    it('auto-uppercases monogram input', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'monogram', iconGlyph: 'ac' });
      expect(svg).toContain('AC');
    });

    it('truncates monogram to 2 letters max', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'monogram', iconGlyph: 'ABCD' });
      expect(svg).toContain('AB');
      expect(svg).not.toContain('ABCD');
    });

    it('renders the lucide icon glyph as a single letter or short text', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'lucide', iconGlyph: 'coffee' });
      // L'icona lucide reale viene renderizzata: contiene il path "M10 2v2" specifico di coffee
      expect(svg).toContain('M10 2v2');
    });

    it('renders the actual lucide icon as SVG path (not a letter)', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'lucide', iconGlyph: 'chef-hat' });
      // chef-hat ha un path specifico "M6 17h12" nel file lucide
      expect(svg).toContain('M6 17h12');
      // Non c'è il <text> con lettera "C"
      expect(svg).not.toMatch(/<text[^>]*>C<\/text>/);
    });

    it('renders different lucide icons with different paths', () => {
      const coffee = builderToSvg({ ...baseBuilder, iconType: 'lucide', iconGlyph: 'coffee' });
      const cpu = builderToSvg({ ...baseBuilder, iconType: 'lucide', iconGlyph: 'cpu' });
      expect(coffee).not.toBe(cpu);
      expect(coffee).toContain('M10 2v2');
      expect(cpu).toContain('rect');
    });

    it('lucide icon is wrapped in a transformed <g> for positioning', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'lucide', iconGlyph: 'coffee' });
      expect(svg).toMatch(/<g transform="translate\([^"]+\) scale\([^"]+\)"/);
    });

    it('renders different shapes for iconShape (circle/square/rounded/hex)', () => {
      const circle = builderToSvg({ ...baseBuilder, iconType: 'shape', iconShape: 'circle' });
      const square = builderToSvg({ ...baseBuilder, iconType: 'shape', iconShape: 'square' });
      const rounded = builderToSvg({ ...baseBuilder, iconType: 'shape', iconShape: 'rounded' });
      const hex = builderToSvg({ ...baseBuilder, iconType: 'shape', iconShape: 'hex' });
      expect(circle).toContain('<circle');
      expect(square).toContain('<rect');
      expect(rounded).toContain('<rect');
      expect(hex).toContain('<polygon');
    });

    it('omits tagline <text> when tagline is empty', () => {
      const svg = builderToSvg({ ...baseBuilder, tagline: '' });
      expect(svg).not.toContain('Solutions');
    });

    it('uses primaryColor for the main icon/text accent', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryColor: '#FF0000' });
      expect(svg).toContain('#FF0000');
    });
  });

  describe('sanitizeSvg (AC-013)', () => {
    it('removes <metadata> tags', () => {
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><metadata>secret</metadata><rect/></svg>`;
      const clean = sanitizeSvg(dirty);
      expect(clean).not.toContain('<metadata');
      expect(clean).not.toContain('secret');
    });

    it('removes <desc> tags', () => {
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><desc>descrizione</desc><rect/></svg>`;
      const clean = sanitizeSvg(dirty);
      expect(clean).not.toContain('<desc');
    });

    it('removes <!-- comments -->', () => {
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><!-- commento --><rect/></svg>`;
      const clean = sanitizeSvg(dirty);
      expect(clean).not.toContain('commento');
    });

    it('removes <script> tags', () => {
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>`;
      const clean = sanitizeSvg(dirty);
      expect(clean).not.toContain('<script');
    });

    it('normalizes viewBox when width/height present but no viewBox', () => {
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect/></svg>`;
      const clean = sanitizeSvg(dirty);
      expect(clean).toContain('viewBox="0 0 100 200"');
      expect(clean).not.toContain('width="100"');
      expect(clean).not.toContain('height="200"');
    });

    it('keeps existing viewBox unchanged', () => {
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect/></svg>`;
      const clean = sanitizeSvg(dirty);
      expect(clean).toContain('viewBox="0 0 400 200"');
    });

    it('returns XML well-formed that DOMParser can parse', () => {
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`;
      const clean = sanitizeSvg(dirty);
      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, 'image/svg+xml');
      const errorNode = doc.querySelector('parsererror');
      expect(errorNode).toBeNull();
    });
  });

  describe('replaceText / replaceColor / applyLayout', () => {
    it('replaceText changes only the matching <text> content', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: 'Acme', tagline: 'Tag' });
      const updated = replaceText(svg, 'Acme', 'Beta');
      expect(updated).toContain('Beta');
      expect(updated).not.toContain('Acme');
      expect(updated).toContain('Tag');
    });

    it('replaceColor changes the matching fill in the SVG', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryColor: '#FF0000' });
      const updated = replaceColor(svg, '#FF0000', '#00FF00');
      expect(updated).toContain('#00FF00');
      expect(updated).not.toContain('#FF0000');
    });

    it('applyLayout regenerates the SVG with the requested layout', () => {
      const h = builderToSvg({ ...baseBuilder, layout: 'horizontal' });
      const stacked = applyLayout(h, 'stacked');
      const h2 = applyLayout(h, 'horizontal');
      expect(stacked).not.toBe(h);
      expect(h2).toContain('Acme');
    });
  });

  describe('svgToPng (AC-009)', () => {
    it('returns a non-empty Uint8Array for a valid SVG', async () => {
      const svg = builderToSvg(baseBuilder);
      // Mock Image + canvas per jsdom
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
          (el as any).width = 0;
          (el as any).height = 0;
          (el as any).getContext = () => ({
            clearRect: () => undefined,
            drawImage: () => undefined,
          });
          (el as any).toBlob = (cb: (b: Blob | null) => void) => {
            const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
            setTimeout(() => cb(blob), 0);
          };
        }
        return el;
      };
      try {
        const png = await svgToPng(svg, 128);
        expect(png).toBeInstanceOf(Uint8Array);
        expect(png.length).toBeGreaterThan(0);
      } finally {
        (global as any).Image = originalImage;
        (document as any).createElement = originalCreate;
      }
    });
  });

  describe('createEmptyLogo → builderToSvg pipeline (AC-001/AC-002/AC-003)', () => {
    it('produces a valid SVG for createEmptyLogo defaults', () => {
      const logo = createEmptyLogo();
      const svg = builderToSvg(logo.builder);
      const clean = sanitizeSvg(svg);
      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
    });
  });
});
