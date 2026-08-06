import { describe, it, expect } from 'vitest';
import { analyzeSiteCode } from '../siteAnalyser';

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
