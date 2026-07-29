import { describe, it, expect } from 'vitest';
import { buildPaletteSvg, palettePreviewDataUrl } from '../palettePreview';
import type { PaletteConcept } from '../../ai/PaletteOrchestrator';

const concept: PaletteConcept = {
  name: 'Caldo Tradizionale',
  primary: '#7c2d12',
  secondary: '#b45309',
  accent: '#dc2626',
  bg: '#fffbeb',
  text: '#1c1917',
  rationale: 'Palette ispirata ai colori della cucina sarda tradizionale.',
};

describe('TB-027 B5 palettePreview', () => {
  it('buildPaletteSvg produce SVG valido con 5 swatch', () => {
    const svg = buildPaletteSvg(concept);
    expect(svg).toContain('<svg');
    expect(svg).toContain(concept.primary);
    expect(svg).toContain(concept.secondary);
    expect(svg).toContain(concept.accent);
    expect(svg).toContain(concept.bg);
    expect(svg).toContain(concept.text);
    expect(svg).toContain(concept.name);
    expect(svg).toContain(concept.rationale.slice(0, 20));
  });

  it('escapeXml gestisce caratteri speciali', () => {
    const c = { ...concept, name: 'A & B <C>' };
    const svg = buildPaletteSvg(c);
    expect(svg).not.toContain('A & B <C>');
    expect(svg).toContain('A &amp; B &lt;C&gt;');
  });

  it('rationale troncato a 70 char', () => {
    const long = { ...concept, rationale: 'x'.repeat(200) };
    const svg = buildPaletteSvg(long);
    expect(svg).toContain('x'.repeat(70));
    expect(svg).not.toContain('x'.repeat(71));
  });

  it('palettePreviewDataUrl ritorna data URL SVG', () => {
    const url = palettePreviewDataUrl(concept);
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(url).toContain(encodeURIComponent(concept.name));
  });
});