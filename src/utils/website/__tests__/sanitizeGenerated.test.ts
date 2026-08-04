import { describe, it, expect } from 'vitest';
import { sanitizeGeneratedCss, sanitizeGeneratedHtml, sanitizeGeneratedWebsite } from '../sanitizeGenerated';

describe('sanitizeGeneratedCss', () => {
  it('rimuove ::before con content emoji', () => {
    const css = `.hero::before { content: "🍦"; position: absolute; }\n.hero { padding: 2rem; }`;
    const out = sanitizeGeneratedCss(css);
    expect(out).not.toContain('::before');
    expect(out).not.toContain('🍦');
    expect(out).toContain('.hero { padding: 2rem; }');
  });

  it('rimuove ::after con content emoji (doppi apici)', () => {
    const css = `.brand::after { content: '🌱'; }`;
    expect(sanitizeGeneratedCss(css)).not.toContain('::after');
  });

  it('mantiene ::before con content testuale o gradienti', () => {
    const css = `.hero::before { content: ""; background: linear-gradient(...); }\n.btn::after { content: "›"; }`;
    const out = sanitizeGeneratedCss(css);
    expect(out).toContain('linear-gradient');
    expect(out).toContain('content: "›"');
  });

  it('non tocca CSS senza pseudo-elementi', () => {
    const css = `.hero { padding: 4rem; } body { margin: 0; }`;
    expect(sanitizeGeneratedCss(css)).toBe(css);
  });
});

describe('sanitizeGeneratedHtml', () => {
  it('rimuove div decorativi vuoti (shape, hero-shapes, dot)', () => {
    const html = '<div class="hero-shapes"><div class="shape"></div><div class="dot"></div></div><main><h1>Titolo</h1></main>';
    const out = sanitizeGeneratedHtml(html);
    expect(out).not.toContain('shape');
    expect(out).not.toContain('hero-shapes');
    expect(out).not.toContain('dot');
    expect(out).toContain('<main><h1>Titolo</h1></main>');
  });

  it('non tocca gallery-item vuoti (iniettati dopo)', () => {
    const html = '<div class="gallery"><div class="gallery-item"></div></div>';
    expect(sanitizeGeneratedHtml(html)).toContain('gallery-item');
  });
});

describe('sanitizeGeneratedWebsite', () => {
  it('applica html + css insieme', () => {
    const html = '<div class="shape"></div><main>ok</main>';
    const css = `.hero::before { content: "🍦"; }`;
    const out = sanitizeGeneratedWebsite(html, css);
    expect(out.html).not.toContain('shape');
    expect(out.css).not.toContain('::before');
    expect(out.html).toContain('<main>ok</main>');
  });
});
