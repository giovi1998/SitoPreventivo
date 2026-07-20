import { describe, it, expect } from 'vitest';
import {
  DECORATIVE_PATTERN_IDS,
  renderDecorativePattern,
  suggestPatternForSector,
  defaultDecorativePalette,
  type DecorativePatternId,
} from '../patterns';

describe('decorative patterns', () => {
  it('renders each registered pattern as non-empty SVG group', () => {
    const palette = { primary: '#01696F', secondary: '#E11D48', accent: '#F59E0B' };
    DECORATIVE_PATTERN_IDS.forEach((id: DecorativePatternId) => {
      const svg = renderDecorativePattern(id, 200, 100, { palette });
      expect(svg).toContain(`data-decorative-pattern="${id}"`);
      expect(svg).toContain('<svg' === svg.trim().slice(0, 4) ? '<' : '<g');
    });
  });

  it('wave-bottom renders multiple wave paths', () => {
    const svg = renderDecorativePattern('wave-bottom', 300, 150, { palette: { primary: '#000', secondary: '#fff' } });
    const matches = svg.match(/\u003cpath/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('full-overlay uses gradient when requested', () => {
    const svg = renderDecorativePattern('full-overlay', 300, 150, {
      palette: { primary: '#000', secondary: '#fff' },
      gradient: true,
    });
    expect(svg).toContain('linearGradient');
  });

  it('suggestPatternForSector maps known sectors', () => {
    expect(suggestPatternForSector('ristorazione')).toBe('wave-bottom');
    expect(suggestPatternForSector('tech software')).toBe('blob-corner');
    expect(suggestPatternForSector('fashion moda')).toBe('splash-corners');
    expect(suggestPatternForSector('studio professionale')).toBe('wave-split');
    expect(suggestPatternForSector('unknown')).toBe('full-overlay');
  });

  it('defaultDecorativePalette normalizes missing colors', () => {
    expect(defaultDecorativePalette()).toEqual({ primary: '#01696F', secondary: '#E11D48', accent: undefined });
    expect(defaultDecorativePalette('#fff', '#000', '#abc')).toEqual({ primary: '#fff', secondary: '#000', accent: '#abc' });
  });

  it('invalid pattern id returns empty string', () => {
    const svg = renderDecorativePattern('not-real' as DecorativePatternId, 100, 100, { palette: { primary: '#000', secondary: '#fff' } });
    expect(svg).toBe('');
  });
});
