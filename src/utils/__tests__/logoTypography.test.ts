import { describe, it, expect, vi, afterEach } from 'vitest';
import { builderToSvg, estimateTextWidth, embedFontInSvg } from '../logoGenerator';
import type { LogoBuilder, LogoLayout } from '../documentSchemas';

// Regression tests per i fix tipografici/proporzionali del modulo logo:
// 1. ratio tagline/wordmark ≥ 0.40 + tagline fittata nel viewBox
// 2. TEXT_AREA_EXTRA non contato due volte (textPosition above/below)
// 3. centratura verticale blocco icona+testo (layout vertical/stacked)
// 4. tono backdrop dal colore testo RISOLTO (non da textColorMode)
// 5. font embedded in SVG per export raster (embedFontInSvg)

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

function viewBox(svg: string): { W: number; H: number } {
  const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!m) throw new Error('viewBox not found');
  return { W: Number(m[1]), H: Number(m[2]) };
}

function fontSizes(svg: string): { primary: number; tagline: number | null } {
  const pm = svg.match(/<text[^>]*font-weight="700"[^>]*font-size="([\d.]+)"/);
  const tm = svg.match(/<text[^>]*font-weight="400"[^>]*font-size="([\d.]+)"/);
  if (!pm) throw new Error('primary <text> not found');
  return { primary: Number(pm[1]), tagline: tm ? Number(tm[1]) : null };
}

/** maxTextW usato dal builder per il fit del testo, per layout. */
function maxTextWidth(svg: string, layout: LogoLayout): number {
  const { W, H } = viewBox(svg);
  if (layout === 'horizontal') {
    const iconSize = Math.min(W, H) * 0.4;
    const textStartX = iconSize + 24; // iconSize/2 + 10 + iconSize/2 + 14
    return W - textStartX - 28;
  }
  return W - 40;
}

describe('fix 1: tagline derivata dal wordmark fittato', () => {
  it.each<LogoLayout>(['horizontal', 'vertical', 'stacked'])(
    'ratio tagline/wordmark >= 0.40 nel layout %s',
    (layout) => {
      const svg = builderToSvg({ ...baseBuilder, layout });
      const { primary, tagline } = fontSizes(svg);
      expect(tagline).not.toBeNull();
      expect(tagline! / primary).toBeGreaterThanOrEqual(0.4);
    },
  );

  it.each<LogoLayout>(['horizontal', 'vertical', 'stacked'])(
    'tagline da 50 caratteri fittata dentro maxTextW nel layout %s (no clipping)',
    (layout) => {
      const tagline50 = 'A'.repeat(50);
      const svg = builderToSvg({ ...baseBuilder, layout, tagline: tagline50 });
      const { tagline } = fontSizes(svg);
      expect(tagline).not.toBeNull();
      expect(estimateTextWidth(tagline50, tagline!)).toBeLessThanOrEqual(maxTextWidth(svg, layout));
    },
  );

  it('tagline resta piu piccola del wordmark anche con wordmark lungo al minimo scala', () => {
    const svg = builderToSvg({
      ...baseBuilder,
      layout: 'stacked',
      primaryText: 'W'.repeat(50),
      textScale: 0.7,
    });
    const { primary, tagline } = fontSizes(svg);
    expect(tagline).not.toBeNull();
    expect(tagline!).toBeLessThan(primary);
  });
});

describe('fix 2: TEXT_AREA_EXTRA non contato due volte', () => {
  const withBg = { ...baseBuilder, backgroundImage: 'data:image/png;base64,ABC' };
  const imageH = (svg: string): number => {
    const m = svg.match(/<image[^>]*height="([\d.]+)"/);
    if (!m) throw new Error('<image> not found');
    return Number(m[1]);
  };

  it('l area immagine non cambia tra overlay, above e below', () => {
    const overlay = builderToSvg({ ...withBg, textPosition: 'overlay' });
    const above = builderToSvg({ ...withBg, textPosition: 'above' });
    const below = builderToSvg({ ...withBg, textPosition: 'below' });
    expect(imageH(above)).toBe(imageH(overlay));
    expect(imageH(below)).toBe(imageH(overlay));
  });

  it('il viewBox cresce di esattamente 120 (una sola area testo), non 240', () => {
    const overlay = builderToSvg({ ...withBg, textPosition: 'overlay' });
    const below = builderToSvg({ ...withBg, textPosition: 'below' });
    expect(viewBox(below).H - viewBox(overlay).H).toBe(120);
  });
});

describe('fix 3: centratura verticale in vertical/stacked senza backgroundImage', () => {
  it('blocco icona+testo centrato: whitespace sopra ≈ whitespace sotto, margine top >= 16', () => {
    const svg = builderToSvg({ ...baseBuilder, layout: 'vertical', iconType: 'shape' });
    const { H } = viewBox(svg);
    const circle = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
    if (!circle) throw new Error('icon <circle> not found');
    const top = Number(circle[2]) - Number(circle[3]);
    const tag = svg.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-weight="400" font-size="([\d.]+)"/);
    if (!tag) throw new Error('tagline <text> not found');
    const bottom = Number(tag[2]) + Number(tag[3]) * 0.25;
    expect(top).toBeGreaterThanOrEqual(16);
    expect(Math.abs(top - (H - bottom))).toBeLessThanOrEqual(10);
  });

  it('stessa centratura nel layout stacked', () => {
    const svg = builderToSvg({ ...baseBuilder, layout: 'stacked', iconType: 'shape' });
    const { H } = viewBox(svg);
    const circle = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
    if (!circle) throw new Error('icon <circle> not found');
    const top = Number(circle[2]) - Number(circle[3]);
    const tag = svg.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-weight="400" font-size="([\d.]+)"/);
    if (!tag) throw new Error('tagline <text> not found');
    const bottom = Number(tag[2]) + Number(tag[3]) * 0.25;
    expect(top).toBeGreaterThanOrEqual(16);
    expect(Math.abs(top - (H - bottom))).toBeLessThanOrEqual(10);
  });
});

describe('fix 4: tono backdrop dal colore testo risolto', () => {
  it('auto senza backgroundImage (testo scuro risolto) → backdrop chiaro', () => {
    const svg = builderToSvg({ ...baseBuilder, textBackdrop: 'pill' });
    expect(svg).toContain('fill="rgba(255,255,255,0.72)"');
  });

  it('auto con backgroundImage (testo bianco risolto) → backdrop scuro', () => {
    const svg = builderToSvg({
      ...baseBuilder,
      textBackdrop: 'pill',
      backgroundImage: 'data:image/png;base64,ABC',
    });
    expect(svg).toContain('fill="rgba(15,23,42,0.55)"');
  });
});

describe('fix 5: embedFontInSvg per export raster', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inietta <style> con @font-face base64 subito dopo il tag <svg>', async () => {
    const fontCss =
      '@font-face{font-family:"Inter";src:url(https://fonts.gstatic.com/inter.woff2) format("woff2");}';
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => fontCss,
        headers: new Map([['content-type', 'font/woff2']]),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['fake-font-bytes'], { type: 'font/woff2' }),
        headers: new Map([['content-type', 'font/woff2']]),
      });
    const svg = builderToSvg(baseBuilder);
    const out = await embedFontInSvg(svg);
    expect(out).toContain('<style>');
    expect(out).toContain('data:font/woff2;base64,');
    expect(out.indexOf('<style>')).toBeGreaterThan(out.indexOf('<svg'));
  });

  it('restituisce il SVG invariato per font sconosciuti', async () => {
    const svg = '<svg viewBox="0 0 10 10"><text font-family="Unknown Font, sans-serif">A</text></svg>';
    const out = await embedFontInSvg(svg);
    expect(out).toBe(svg);
  });

  it('restituisce il SVG invariato quando il fetch del font fallisce', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('offline'));
    const svg = builderToSvg({ ...baseBuilder, fontFamily: 'Oswald' });
    const out = await embedFontInSvg(svg);
    expect(out).toBe(svg);
  });
});
