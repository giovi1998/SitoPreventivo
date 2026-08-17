import { describe, it, expect } from 'vitest';
import { analyzeSiteCode, analyzeSiteRegression } from '../siteAnalyser';

const completeHtml = `<html><head><meta charset="UTF-8"><title>T</title></head><body>
<header class="nav"><div class="nav-inner"><div class="brand">Nome</div><button class="menu-toggle" aria-label="Apri menu">Menu</button><ul class="nav-links"><li><a href="index.html">Home</a></li></ul></div></header>
<main><h1>Benvenuto</h1><section id="contatti"><h2>Contatti</h2><form><input type="email" placeholder="Email"></form><iframe src="https://www.google.com/maps?q=Via%20Dante%20Cagliari&output=embed" width="100%" height="400" title="Mappa"></iframe></section></main>
<footer><p>&copy; <span class="current-year">2026</span> Nome</p></footer></body></html>`;

describe('analyzeSiteCode html', () => {
  it('ok su html bilanciato con alt', () => {
    const res = analyzeSiteCode('<html><head><title>T</title></head><body><img src="x.jpg" alt="foto"></body></html>', 'html');
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it('segnala tag non chiusi', () => {
    const res = analyzeSiteCode('<section><p>ciao</section>', 'html');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('non bilanciato'))).toBe(true);
  });

  it('segnala img senza alt', () => {
    const res = analyzeSiteCode('<img src="x.jpg">', 'html');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('alt'))).toBe(true);
  });

  it('segnala ::before con content non vuoto', () => {
    const res = analyzeSiteCode('<style>.brand::before { content: "logo"; }</style>', 'html');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('content non vuoto'))).toBe(true);
  });

  it('segnala emoji nel testo', () => {
    const res = analyzeSiteCode('<h1>Gelateria 🍦</h1>', 'html');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('Emoji'))).toBe(true);
  });
});

describe('analyzeSiteCode css', () => {
  it('ok su css bilanciato', () => {
    const res = analyzeSiteCode('.a { color: red; } .b { display: flex; }', 'css');
    expect(res.ok).toBe(true);
  });

  it('segnala parentesi non chiuse (troncato)', () => {
    const res = analyzeSiteCode('.hero h2 { font-size: 2rem;', 'css');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('non chiuse'))).toBe(true);
  });

  it('segnala ::after con content emoji', () => {
    const res = analyzeSiteCode('.btn::after { content: "🍦"; }', 'css');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('content non vuoto'))).toBe(true);
  });

  it('segnala regola annidata dentro un\'altra regola (bug slice)', () => {
    // Simula il danno del fallback whitespace: .contatti h2 finito dentro
    // .site-header { ... } → parentesi bilanciate ma regola ignorata.
    const css = '/* header */\n.site-header {\n  padding: 1rem;\n.contatti h2 { font-size: 1.75rem; }.5rem;\n}';
    const res = analyzeSiteCode(css, 'css');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('annidata'))).toBe(true);
  });

  it('non segnala regole annidate dentro @media/@keyframes', () => {
    const css = '@media (max-width: 768px) { .a { color: red; } } @keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }';
    const res = analyzeSiteCode(css, 'css');
    expect(res.ok).toBe(true);
  });
});

describe('analyzeSiteCode js', () => {
  it('ok su js completo', () => {
    const js = `'use strict';\n(function(){ const x = (a) => a + 1; document.addEventListener('click', function(){ x(1); }); })();`;
    const res = analyzeSiteCode(js, 'js');
    expect(res.ok).toBe(true);
  });

  it('segnala stringa non chiusa (troncato)', () => {
    const res = analyzeSiteCode("const a = 'anchor.getAttribu", 'js');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('stringa non chiusa'))).toBe(true);
  });

  it('segnala parentesi non chiuse', () => {
    const res = analyzeSiteCode('function f() { return (1 + 2; }', 'js');
    expect(res.ok).toBe(false);
  });
});

describe('analyzeSiteCode vuoto', () => {
  it('segnala parte vuota', () => {
    const res = analyzeSiteCode('', 'css');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('vuoto'))).toBe(true);
  });
});

describe('analyzeSiteRegression — sezione regressione struttura (TB-032)', () => {
  it('ok su html con nav, menu-toggle, footer, current-year, mappa e form', () => {
    const res = analyzeSiteRegression(completeHtml, 'Via Dante 5/A, Cagliari');
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it('segnala nav mancante', () => {
    const html = completeHtml.replace(/<header class="nav">[\s\S]*?<\/header>/, '');
    const res = analyzeSiteRegression(html, '');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('nav'))).toBe(true);
  });

  it('segnala menu-toggle mancante (hamburger mobile)', () => {
    const html = completeHtml.replace(/<button class="menu-toggle"[\s\S]*?<\/button>/, '');
    const res = analyzeSiteRegression(html, '');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('menu-toggle'))).toBe(true);
  });

  it('segnala footer mancante', () => {
    const html = completeHtml.replace(/<footer>[\s\S]*?<\/footer>/, '');
    const res = analyzeSiteRegression(html, '');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('footer'))).toBe(true);
  });

  it('segnala .current-year mancante nel footer', () => {
    const html = completeHtml.replace('class="current-year"', 'class="anno"');
    const res = analyzeSiteRegression(html, '');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('current-year'))).toBe(true);
  });

  it('segnala mappa mancante quando il brief ha un indirizzo', () => {
    const html = completeHtml.replace(/<iframe[\s\S]*?<\/iframe>/, '');
    const res = analyzeSiteRegression(html, 'Via Dante 5/A, Cagliari');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('mappa'))).toBe(true);
  });

  it('mappa opzionale senza indirizzo nel brief', () => {
    const html = completeHtml.replace(/<iframe[\s\S]*?<\/iframe>/, '');
    const res = analyzeSiteRegression(html, '');
    expect(res.issues.some((i) => i.includes('mappa'))).toBe(false);
  });

  it('segnala form mancante', () => {
    const html = completeHtml.replace(/<form>[\s\S]*?<\/form>/, '');
    const res = analyzeSiteRegression(html, '');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('form'))).toBe(true);
  });

  it('segnala link relativi mancanti (navigazione tra pagine rotta)', () => {
    const html = completeHtml.replace('href="index.html"', 'href="#home"');
    const res = analyzeSiteRegression(html, '');
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('href relativo'))).toBe(true);
  });

  it('su HTML strutturalmente rotto non raddoppia le segnalazioni (regressione skip)', () => {
    const html = completeHtml.replace('</form>', '');
    const res = analyzeSiteRegression(html, '');
    expect(res.issues.some((i) => i.includes('form'))).toBe(false);
  });
});
