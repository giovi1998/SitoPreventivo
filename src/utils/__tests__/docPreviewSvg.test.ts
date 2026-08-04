import { describe, it, expect } from 'vitest';
import { buildPreviewSvg } from '../docPreviewSvg';

describe('buildPreviewSvg website preview', () => {
  it('website with CSS vars and h1 renders brand color + heading in SVG', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      title: 'Sito Panetteria',
      brief: { businessName: 'Panetteria Artigianale' },
      css: ':root { --primary: #B45309; --bg: #FFFBEB; } body { background: var(--bg); }',
      html: '<h1 class="hero-title">Pane Fresco Ogni Giorno</h1><p>Intro</p>',
      pages: ['index', 'about'],
    });
    expect(svg).toContain('#B45309');
    expect(svg).toContain('#FFFBEB');
    expect(svg).toContain('Pane Fresco Ogni Giorno');
  });

  it('website with rgb() colors in CSS is normalized to hex-ish rgb in SVG', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'Studio X' },
      css: ':root { --primary: rgb(22, 105, 111); }',
      html: '',
      pages: ['index'],
    });
    expect(svg).toContain('rgb(22,105,111)');
  });

  it('website without code falls back to placeholder with businessName', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'Caffè Aurora' },
      pages: ['index'],
    });
    expect(svg).toContain('Caffè Aurora');
    expect(svg).toContain('1 p.');
  });

  it('website without brief falls back to default title', () => {
    const svg = buildPreviewSvg({ documentType: 'website', title: 'Sito Web' });
    expect(svg).toContain('Sito Web');
  });

  it('non-renderable document returns empty string', () => {
    expect(buildPreviewSvg({ documentType: 'qrCode', data: { payload: 'x' } })).toBe('');
    expect(buildPreviewSvg({})).toBe('');
  });
});
