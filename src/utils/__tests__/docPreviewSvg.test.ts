import { describe, it, expect } from 'vitest';
import { buildPreviewSvg } from '../docPreviewSvg';

describe('buildPreviewSvg website preview', () => {
  it('website with CSS and HTML renders real content via foreignObject', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      title: 'Sito Panetteria',
      brief: { businessName: 'Panetteria Artigianale' },
      css: ':root { --primary: #B45309; } body { font-family: serif; }',
      html: '<h1>Pane Fresco Ogni Giorno</h1><p>Intro</p>',
      pages: ['index', 'about'],
    });
    expect(svg).toContain('<foreignObject');
    // CSS scoped, :root diventa il wrapper della preview
    expect(svg).toContain('--primary: #B45309');
    expect(svg).toContain('.ws-preview {');
    // HTML reale incluso
    expect(svg).toContain('Pane Fresco Ogni Giorno');
    expect(svg).toContain('<h1>');
  });

  it('scopeCss scopes body selectors and keeps keyframes global', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'X' },
      css: 'body { margin: 0; } .hero h1 { color: #fff; } @keyframes spin { from { transform: rotate(0); } }',
      html: '<div class="hero"><h1>Hero</h1></div>',
    });
    expect(svg).toContain('.ws-preview { margin: 0; }');
    expect(svg).toContain('.ws-preview .hero h1 { color: #fff; }');
    expect(svg).toContain('@keyframes spin');
  });

  it('website with script-heavy html is stripped of script tags', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'X' },
      html: '<h1>Safe</h1><script>alert(1)</script>',
      css: '',
    });
    expect(svg).toContain('<h1>Safe</h1>');
    expect(svg).not.toContain('<script');
  });

  it('website with mobile media query renders at 375px viewport', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'X' },
      css: '@media (max-width: 768px) { .hero { font-size: 14px; } }',
      html: '<div class="hero">Ciao</div>',
      pages: ['index'],
    });
    expect(svg).toContain('viewBox="0 0 375 234"');
    expect(svg).toContain('width:375px');
  });

  it('website multi-page renders page count badge', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'X' },
      css: '',
      html: '<h1>Home</h1>',
      pages: ['index', 'about', 'contact'],
    });
    expect(svg).toContain('3 p.');
  });

  it('website with script-only html falls back to placeholder', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'Solo Script' },
      html: '<script>alert(1)</script>',
      css: '',
      pages: ['index'],
    });
    expect(svg).not.toContain('<foreignObject');
    expect(svg).toContain('Solo Script');
  });

  it('website without code falls back to placeholder with businessName', () => {
    const svg = buildPreviewSvg({
      documentType: 'website',
      brief: { businessName: 'Caffè Aurora' },
      pages: ['index'],
    });
    expect(svg).toContain('Caffè Aurora');
    expect(svg).toContain('1 pagina');
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
