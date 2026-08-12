import { describe, it, expect } from 'vitest';
import { sanitizeGeneratedCss, sanitizeGeneratedHtml, sanitizeGeneratedWebsite, ensureResponsiveGallery, enforceMapIframe, sanitizeGeneratedJs, ensureHamburgerCss } from '../sanitizeGenerated';

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

  it('rimuove TUTTI i ::before/::after (anche gradienti legittimi)', () => {
    const css = `.hero::before { content: ""; background: linear-gradient(...); }\n.btn::after { content: "›"; }`;
    const out = sanitizeGeneratedCss(css);
    expect(out).not.toContain('::before');
    expect(out).not.toContain('::after');
    expect(out).not.toContain('linear-gradient');
  });

  it('rimuove ::before/::after su brand/logo con content non vuoto (gelato visibile)', () => {
    const css = `.brand::before { content: "🍦"; position: absolute; }\n.brand::after { content: url(data:image/png;base64,xxx); }`;
    const out = sanitizeGeneratedCss(css);
    expect(out).not.toContain('.brand::before');
    expect(out).not.toContain('.brand::after');
  });

  it('non tocca CSS senza pseudo-elementi', () => {
    const css = `.hero { padding: 4rem; } body { margin: 0; }`;
    expect(sanitizeGeneratedCss(css)).toBe(css);
  });
});

describe('ensureResponsiveGallery', () => {
  it('aggiunge regole gallery se mancanti', () => {
    const css = `.hero { padding: 2rem; }`;
    const out = ensureResponsiveGallery(css);
    expect(out).toContain('grid-template-columns: repeat(auto-fill');
    expect(out).toContain('.gallery-item img');
  });

  it('non duplica se gallery già definita', () => {
    const css = `.gallery { display: grid; grid-template-columns: repeat(3, 1fr); }`;
    const out = ensureResponsiveGallery(css);
    expect(out).not.toContain('/* sicurezza: immagini gallery responsive */');
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

describe('enforceMapIframe', () => {
  it('sostituisce iframe AI sbagliato (senza città) con indirizzo completo', () => {
    const html = '<section id="contatti"><iframe src="https://www.google.com/maps?q=Via+Dante+Alighieri&output=embed" width="100%" height="400"></iframe></section>';
    const out = enforceMapIframe(html, 'Via Dante Alighieri 5/A, Cagliari, 09124');
    expect(out).toContain('q=Via%20Dante%20Alighieri%205%2FA%20Cagliari');
    expect(out).not.toContain('q=Via+Dante+Alighieri&');
    expect(out).toContain('title="Mappa"');
  });

  it('senza sezione contatti e senza iframe → HTML invariato', () => {
    const html = '<main><p>Nessuna mappa qui</p></main>';
    expect(enforceMapIframe(html, 'Via Dante 5, Cagliari')).toBe(html);
  });

  it('senza contatti → HTML invariato', () => {
    const html = '<iframe src="https://www.google.com/maps?q=X&output=embed"></iframe>';
    expect(enforceMapIframe(html, '')).toBe(html);
  });

  it('inietta iframe nella sezione contatti se mancante', () => {
    const html = '<section id="contatti"><p>Via Dante 5/A</p></section>';
    const out = enforceMapIframe(html, 'Via Dante Alighieri 5/A, Cagliari');
    expect(out).toContain('google.com/maps?q=Via%20Dante%20Alighieri%205%2FA%20Cagliari');
    expect(out).toContain('title="Mappa"');
    expect(out).toContain('<p>Via Dante 5/A</p>');
  });
});

describe('ensureHamburgerCss', () => {
  it('appende regola hamburger se mancante', () => {
    const css = `.nav { padding: 1rem; }`;
    const out = ensureHamburgerCss(css);
    expect(out).toContain('.menu-toggle::before');
    expect(out).toContain('box-shadow');
  });

  it('non duplica se già presente', () => {
    const css = `.menu-toggle::before { content: ""; width: 22px; height: 2px; background: #000; }`;
    expect(ensureHamburgerCss(css)).toBe(css);
  });
});

describe('sanitizeGeneratedJs', () => {
  it('rimuove innerHTML con ☰ (hamburger via JS)', () => {
    const js = `const t = document.querySelector('.menu-toggle');\nt.innerHTML = '☰';\nt.addEventListener('click', () => nav.classList.toggle('nav-open'));`;
    const out = sanitizeGeneratedJs(js);
    expect(out).not.toContain('☰');
    expect(out).not.toContain('innerHTML');
    expect(out).toContain('addEventListener');
  });

  it('rimuove textContent con emoji', () => {
    const js = `el.textContent = '🍦 gelato';`;
    expect(sanitizeGeneratedJs(js)).not.toContain('🍦');
  });

  it('non tocca JS pulito', () => {
    const js = `const t = document.querySelector('.menu-toggle');\nt.addEventListener('click', () => nav.classList.toggle('nav-open'));`;
    expect(sanitizeGeneratedJs(js)).toBe(js);
  });
});

describe('sanitizeGeneratedHtml menu-toggle', () => {
  it('svuota il bottone menu-toggle con ☰', () => {
    const html = '<button class="menu-toggle">☰</button>';
    const out = sanitizeGeneratedHtml(html);
    expect(out).toBe('<button class="menu-toggle"></button>');
  });
});
