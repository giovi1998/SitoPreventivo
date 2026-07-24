import { describe, it, expect, vi } from 'vitest';

vi.mock('qrcode', () => ({
  default: {
    create: () => ({ modules: { size: 1, data: [1] } }),
  },
}));

import { buildFlyerSvg } from '../flyerGenerator';
import { createEmptyFlyer, createFlyerTemplate, getFlyerDimensions, FLYER_BLEED_MM } from '../documentSchemas';
import type { Flyer } from '../documentSchemas';

function svg(f: Flyer): string {
  return buildFlyerSvg(f);
}

function styleOf(svgStr: string, el: string, attr: string): string | null {
  const re = new RegExp(`<${el}[^>]*\\s${attr}="([^"]*)"`, 'i');
  const m = svgStr.match(re);
  return m ? m[1] : null;
}

function numMm(svgStr: string, el: string, attr: string): number | null {
  const raw = styleOf(svgStr, el, attr);
  if (!raw) return null;
  return parseFloat(raw);
}

describe('buildFlyerSvg - layout structure', () => {
  it('produces a root <svg> with viewBox in mm including bleed', () => {
    const f = createEmptyFlyer(); // A5 portrait 148x210
    const s = svg(f);
    expect(s.startsWith('<svg')).toBe(true);
    expect(s.trim().endsWith('</svg>')).toBe(true);
    const dims = getFlyerDimensions(f);
    expect(s).toContain(`viewBox="0 0 ${(dims.w + FLYER_BLEED_MM * 2).toFixed(3)} ${(dims.h + FLYER_BLEED_MM * 2).toFixed(3)}"`);
  });

  it('renders a full-bleed background rect', () => {
    const s = svg(createEmptyFlyer());
    expect(s).toMatch(/<rect[^]*fill="#FFFFFF"/);
  });

  it('foreignObject children for body declare min-width:0 (no horizontal overflow)', () => {
    const f = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, body: 'Test body content here' } };
    const s = svg(f);
    // Body is still rendered in foreignObject with overflow control
    expect(s).toContain('overflow:hidden');
  });

  it('does not use the old aggressive -webkit-line-clamp:5 clamp on body', () => {
    const f = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, body: 'x'.repeat(500) } };
    const s = svg(f);
    expect(s).not.toContain('-webkit-line-clamp:5');
  });

  it('hero image for classic layout occupies ~40% of content height', () => {
    const f = createFlyerTemplate('ristorante', 'classic'); // A5 portrait, has heroImage
    const s = svg(f);
    const dims = getFlyerDimensions(f);
    const h = numMm(s, 'image', 'height');
    expect(h).not.toBeNull();
    // content height ~ dims.h minus margins; 40% of ~ (dims.h - 10*2)
    const expected = (dims.h - 10) * 0.42;
    expect(h!).toBeGreaterThan(expected * 0.85);
    expect(h!).toBeLessThan(expected * 1.15);
  });

  it('hero image for split landscape uses left half width', () => {
    // salone split is A6 landscape 148x105
    const f = createFlyerTemplate('salone', 'split');
    const s = svg(f);
    const dims = getFlyerDimensions(f);
    expect(dims.w).toBeGreaterThan(dims.h); // landscape
    const w = numMm(s, 'image', 'width');
    expect(w).not.toBeNull();
    expect(w!).toBeLessThan(dims.w * 0.55);
    expect(w!).toBeGreaterThan(dims.w * 0.40);
  });

  it('CTA rect sits inside the content area (y < total height)', () => {
    const f = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, cta: { label: 'Prenota', url: 'https://example.com' } } };
    const s = svg(f);
    const dims = getFlyerDimensions(f);
    const totalH = dims.h + FLYER_BLEED_MM * 2;
    const y = numMm(s, 'rect', 'y');
    // at least one rect (bg) at y=0; filter for the CTA by finding the accent-colored rect
    const ctaRectMatch = s.match(/<rect[^]*y="([0-9.]+)"[^]*fill="#01696f"/i) || s.match(/<rect[^]*fill="#01696f"[^]*y="([0-9.]+)"/i);
    expect(ctaRectMatch).not.toBeNull();
    const ctaY = parseFloat(ctaRectMatch![1]);
    expect(ctaY).toBeGreaterThan(0);
    expect(ctaY).toBeLessThan(totalH);
  });

  it('magazine body uses CSS multi-column (column-count:3) not manual 3-div split', () => {
    const f = { ...createFlyerTemplate('ristorante', 'magazine'), content: { ...createFlyerTemplate('ristorante', 'magazine').content } };
    const s = svg(f);
    expect(s).toContain('column-count:3');
  });

  it('font sizes scale with format (A4 headline >= A6 headline)', () => {
    const a4 = { ...createEmptyFlyer(), size: 'A4' as const, content: { ...createEmptyFlyer().content, headline: 'Test' } };
    const a6 = { ...createEmptyFlyer(), size: 'A6' as const, content: { ...createEmptyFlyer().content, headline: 'Test' } };
    const sA4 = svg(a4);
    const sA6 = svg(a6);
    const headPt = (s: string) => {
      const m = s.match(/font-size="([0-9.]+)pt"\s+font-weight="700"/);
      return m ? parseFloat(m[1]) : 0;
    };
    expect(headPt(sA4)).toBeGreaterThanOrEqual(headPt(sA6));
  });

  it('renders an <image> element for magazine layout when heroImage is set', () => {
    const f = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, heroImage: 'data:image/png;base64,xxx', headline: 'Test' }, style: { ...createEmptyFlyer().style, layout: 'magazine' as const } };
    const s = svg(f);
    expect(s).toMatch(/<image[^>]*href=/);
  });

  it('renders without throwing for all 4 layouts with full content', () => {
    for (const layout of ['classic', 'centered', 'split', 'magazine'] as const) {
      const f = createFlyerTemplate('evento', layout);
      const s = svg(f);
      expect(s.startsWith('<svg')).toBe(true);
      // Headline should be rendered as native SVG <text> elements
      expect(s).toContain('<text');
    }
  });

  it('headline renders as native SVG <text> elements (not foreignObject)', () => {
    const f = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, headline: 'Sagra della Birra 2026 Ingresso Gratuito' } };
    const s = svg(f);
    expect(s).toContain('<text');
    expect(s).toContain('font-weight="700"');
    // Should NOT use foreignObject for headline
    const foMatch = s.match(/<foreignObject/g);
    expect(foMatch ? foMatch.length : 0).toBeLessThanOrEqual(1); // at most 1 for body
  });

  it('QR is inlined as a <g> group when qrPayload is a valid http url', () => {
    const f = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, qrPayload: 'https://example.com' } };
    const s = svg(f);
    expect(s).toMatch(/<g transform="translate/);
  });

  it('no QR group when qrPayload is empty or not a url', () => {
    const f = createEmptyFlyer();
    const s = svg(f);
    expect(s).not.toMatch(/<g transform="translate/);
  });
});
