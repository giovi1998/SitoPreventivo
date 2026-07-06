import { describe, it, expect } from 'vitest';
import { builderToSvg, fitText, estimateTextWidth } from '../logoGenerator';
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
};

describe('logoGenerator v2.2', () => {
  describe('auto-fit', () => {
    it('keeps default viewBox for short text', () => {
      const svg = builderToSvg(baseBuilder);
      expect(svg).toContain('viewBox="0 0 400 160"');
    });

    it('expands viewBox for long primaryText (Pedagogista Susanna)', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: 'Pedagogista Susanna' });
      // viewBox width should be > 400
      const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(match).toBeTruthy();
      expect(Number(match![1])).toBeGreaterThan(400);
    });

    it('clamps viewBox width near 800 for very long text', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: 'Supercalifragilistichespiralidoso Studio' });
      const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(match).toBeTruthy();
      expect(Number(match![1])).toBeGreaterThanOrEqual(790);
      expect(Number(match![1])).toBeLessThanOrEqual(800);
    });

    it('fitText returns startSize for short text', () => {
      expect(fitText('Acme', 300)).toBe(36);
    });

    it('fitText shrinks for long text', () => {
      expect(fitText('Pedagogista Susanna', 300)).toBeLessThan(36);
      expect(fitText('Pedagogista Susanna', 300)).toBeGreaterThanOrEqual(14);
    });

    it('estimateTextWidth scales with font size', () => {
      expect(estimateTextWidth('Acme', 36)).toBe(Math.round(4 * 36 * 0.55));
    });
  });

  describe('decorations', () => {
    it('renders underline for decorativeElements=[underline]', () => {
      const svg = builderToSvg({ ...baseBuilder, decorativeElements: ['underline'] });
      expect(svg).toContain('<line');
      expect(svg).toContain('stroke="#01696F"');
    });

    it('renders dotRing with 8 circles', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'shape', decorativeElements: ['dotRing'] });
      const circles = svg.match(/<circle/g) || [];
      // 1 shape circle + 8 dot ring circles
      expect(circles.length).toBeGreaterThanOrEqual(8);
    });

    it('renders topAccent as a rect near the top', () => {
      const svg = builderToSvg({ ...baseBuilder, decorativeElements: ['topAccent'] });
      expect(svg).toContain('y="4"');
      expect(svg).toContain('height="4"');
    });
  });

  describe('gradient', () => {
    it('renders gradient defs when gradientFill=true', () => {
      const svg = builderToSvg({ ...baseBuilder, gradientFill: true });
      expect(svg).toContain('<linearGradient id="textGrad"');
      expect(svg).toContain('fill="url(#textGrad)"');
    });
  });

  describe('backgroundColor', () => {
    it('renders solid background rect when backgroundColor set', () => {
      const svg = builderToSvg({ ...baseBuilder, backgroundColor: '#FFFFFF' });
      expect(svg).toContain('<rect width="400" height="160" fill="#FFFFFF"/>');
    });

    it('renders backgroundColor rect before backgroundImage (z-order)', () => {
      const bg = 'data:image/png;base64,ABC';
      const svg = builderToSvg({ ...baseBuilder, backgroundImage: bg, backgroundColor: '#F5F5F4' });
      const rectIdx = svg.indexOf('fill="#F5F5F4"');
      const imgIdx = svg.indexOf('<image');
      expect(rectIdx).toBeGreaterThan(-1);
      expect(imgIdx).toBeGreaterThan(rectIdx);
    });
  });
});

describe('logoGenerator v2.3 (text readability + position controls)', () => {
  describe('textColorMode', () => {
    it('auto keeps the existing secondaryColor for primaryText (unchanged default)', () => {
      const svg = builderToSvg(baseBuilder);
      expect(svg).toContain('fill="#1a1a2e"');
    });

    it('light forces white primaryText fill', () => {
      const svg = builderToSvg({ ...baseBuilder, textColorMode: 'light' });
      expect(svg).toContain('fill="#FFFFFF"');
    });

    it('dark forces near-black primaryText fill', () => {
      const svg = builderToSvg({ ...baseBuilder, textColorMode: 'dark' });
      expect(svg).toContain('fill="#0F172A"');
    });

    it('gradientFill takes priority over textColorMode', () => {
      const svg = builderToSvg({ ...baseBuilder, textColorMode: 'light', gradientFill: true });
      expect(svg).toContain('fill="url(#textGrad)"');
      expect(svg).not.toContain('fill="#FFFFFF"');
    });
  });

  describe('textBackdrop', () => {
    it('none renders no extra backdrop rect (only the icon shape, no additional rect)', () => {
      const svg = builderToSvg(baseBuilder);
      // iconType none => no shape rect either; the only rects would come
      // from a backdrop, so there should be zero <rect> elements.
      expect(svg.match(/<rect/g)).toBeNull();
    });

    it('pill renders a rounded rect behind the text', () => {
      const svg = builderToSvg({ ...baseBuilder, textBackdrop: 'pill' });
      expect(svg).toMatch(/<rect[^>]*rx="\d+"[^>]*fill="rgba\(/);
    });

    it('band renders a full-width rect behind the text', () => {
      const svg = builderToSvg({ ...baseBuilder, textBackdrop: 'band' });
      expect(svg).toMatch(/<rect x="0" y="[\d.]+" width="400"[^>]*fill="rgba\(/);
    });

    it('uses a light backdrop when textColorMode=dark (contrast inversion)', () => {
      const svg = builderToSvg({ ...baseBuilder, textBackdrop: 'pill', textColorMode: 'dark' });
      expect(svg).toContain('fill="rgba(255,255,255,0.72)"');
    });

    it('uses a dark backdrop when textColorMode=light', () => {
      const svg = builderToSvg({ ...baseBuilder, textBackdrop: 'pill', textColorMode: 'light' });
      expect(svg).toContain('fill="rgba(15,23,42,0.55)"');
    });

    it('backdrop is placed before the text in the SVG so text renders on top', () => {
      const svg = builderToSvg({ ...baseBuilder, textBackdrop: 'pill' });
      const backdropIdx = svg.indexOf('fill="rgba(');
      const textIdx = svg.indexOf('<text');
      expect(backdropIdx).toBeGreaterThan(-1);
      expect(textIdx).toBeGreaterThan(backdropIdx);
    });
  });

  describe('textOffsetX/Y', () => {
    it('shifts primaryText x position for horizontal layout', () => {
      const base = builderToSvg(baseBuilder);
      const shifted = builderToSvg({ ...baseBuilder, textOffsetX: 20 });
      const baseX = Number(base.match(/<text x="([\d.]+)"/)![1]);
      const shiftedX = Number(shifted.match(/<text x="([\d.]+)"/)![1]);
      expect(shiftedX).toBeCloseTo(baseX + 20, 0);
    });

    it('shifts primaryText y position for vertical layout', () => {
      const vBuilder = { ...baseBuilder, layout: 'vertical' as const };
      const base = builderToSvg(vBuilder);
      const shifted = builderToSvg({ ...vBuilder, textOffsetY: 15 });
      const baseY = Number(base.match(/<text x="[\d.]+" y="([\d.]+)"/)![1]);
      const shiftedY = Number(shifted.match(/<text x="[\d.]+" y="([\d.]+)"/)![1]);
      expect(shiftedY).toBeCloseTo(baseY + 15, 0);
    });
  });

  describe('textScale', () => {
    it('increases font-size when textScale > 1', () => {
      const base = builderToSvg(baseBuilder);
      const scaled = builderToSvg({ ...baseBuilder, textScale: 1.5 });
      const baseFontSize = Number(base.match(/font-size="(\d+)"/)![1]);
      const scaledFontSize = Number(scaled.match(/font-size="(\d+)"/)![1]);
      expect(scaledFontSize).toBeGreaterThan(baseFontSize);
    });

    it('decreases font-size when textScale < 1', () => {
      const base = builderToSvg(baseBuilder);
      const scaled = builderToSvg({ ...baseBuilder, textScale: 0.7 });
      const baseFontSize = Number(base.match(/font-size="(\d+)"/)![1]);
      const scaledFontSize = Number(scaled.match(/font-size="(\d+)"/)![1]);
      expect(scaledFontSize).toBeLessThan(baseFontSize);
    });

    it('never shrinks font-size below 10 even at minimum scale', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: 'Pedagogista Susanna Cidu Molto Lungo', textScale: 0.7 });
      const fontSize = Number(svg.match(/font-size="(\d+)"/)![1]);
      expect(fontSize).toBeGreaterThanOrEqual(10);
    });
  });

  describe('icon/decorazioni soppressi con background AI (v2.3.1)', () => {
    const withIcon = { ...baseBuilder, iconType: 'shape' as const, iconGlyph: 'A', decorativeElements: ['underline' as const] };

    it('renders the icon shape when there is no backgroundImage', () => {
      const svg = builderToSvg(withIcon);
      expect(svg).toContain('<circle');
    });

    it('renders decorativeElements when there is no backgroundImage', () => {
      const svg = builderToSvg(withIcon);
      expect(svg).toContain('<line');
    });

    it('suppresses the icon shape when backgroundImage is set', () => {
      const svg = builderToSvg({ ...withIcon, backgroundImage: 'data:image/png;base64,ABC' });
      expect(svg).not.toContain('<circle');
    });

    it('suppresses decorativeElements when backgroundImage is set', () => {
      const svg = builderToSvg({ ...withIcon, backgroundImage: 'data:image/png;base64,ABC' });
      expect(svg).not.toContain('<line');
    });

    it('still renders backgroundImage + text when icon/decorations are suppressed', () => {
      const svg = builderToSvg({ ...withIcon, backgroundImage: 'data:image/png;base64,ABC' });
      expect(svg).toContain('<image');
      expect(svg).toContain('Acme');
    });
  });

  describe('taglineOffsetX/Y indipendente da textOffsetX/Y (v2.3.1)', () => {
    const extractTaglineXY = (svg: string): [number, number] => {
      const m = svg.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-weight="400"/);
      if (!m) throw new Error('tagline <text> not found');
      return [Number(m[1]), Number(m[2])];
    };
    const extractTitleXY = (svg: string): [number, number] => {
      const m = svg.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-weight="700"/);
      if (!m) throw new Error('title <text> not found');
      return [Number(m[1]), Number(m[2])];
    };

    it('moving textOffsetX does NOT move the tagline', () => {
      const [baseTagX] = extractTaglineXY(builderToSvg(baseBuilder));
      const [shiftedTagX] = extractTaglineXY(builderToSvg({ ...baseBuilder, textOffsetX: 30 }));
      expect(shiftedTagX).toBeCloseTo(baseTagX, 0);
    });

    it('moving taglineOffsetX does NOT move the primaryText (title)', () => {
      const [baseTitleX] = extractTitleXY(builderToSvg(baseBuilder));
      const [shiftedTitleX] = extractTitleXY(builderToSvg({ ...baseBuilder, taglineOffsetX: 30 }));
      expect(shiftedTitleX).toBeCloseTo(baseTitleX, 0);
    });

    it('taglineOffsetX shifts the tagline x position', () => {
      const [baseTagX] = extractTaglineXY(builderToSvg(baseBuilder));
      const [shiftedTagX] = extractTaglineXY(builderToSvg({ ...baseBuilder, taglineOffsetX: 25 }));
      expect(shiftedTagX).toBeCloseTo(baseTagX + 25, 0);
    });

    it('taglineOffsetY shifts the tagline y position', () => {
      const [, baseTagY] = extractTaglineXY(builderToSvg(baseBuilder));
      const [, shiftedTagY] = extractTaglineXY(builderToSvg({ ...baseBuilder, taglineOffsetY: 12 }));
      expect(shiftedTagY).toBeCloseTo(baseTagY + 12, 0);
    });
  });
});
