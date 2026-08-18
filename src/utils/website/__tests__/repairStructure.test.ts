import { describe, it, expect } from 'vitest';
import { repairCssStructure, repairHtmlStructure } from '../repairStructure';
import { analyzeSiteCode } from '../siteAnalyser';

describe('repairCssStructure', () => {
  it('estrae regola annidata dentro regola normale', () => {
    const css = '/* header */\n.site-header {\n  padding: 1rem;\n.contatti h2 { font-size: 1.75rem; }.5rem;\n}';
    const out = repairCssStructure(css);
    expect(analyzeSiteCode(out, 'css').ok).toBe(true);
    expect(out).toContain('.contatti h2 { font-size: 1.75rem; }');
    expect(out).toContain('.site-header {');
  });

  it('non tocca regole dentro @media/@keyframes', () => {
    const css = '@media (max-width: 768px) { .a { color: red; } } @keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }';
    const out = repairCssStructure(css);
    expect(out).toBe(css);
    expect(analyzeSiteCode(out, 'css').ok).toBe(true);
  });

  it('bilancia parentesi { non chiuse', () => {
    const css = '.hero h2 { font-size: 2rem;';
    const out = repairCssStructure(css);
    expect(analyzeSiteCode(out, 'css').ok).toBe(true);
  });

  it('rimuove } extra', () => {
    const css = '.a { color: red; } }';
    const out = repairCssStructure(css);
    expect(analyzeSiteCode(out, 'css').ok).toBe(true);
  });

  it('css sano invariato', () => {
    const css = '.a { color: red; } .b { display: flex; }';
    expect(repairCssStructure(css)).toBe(css);
  });
});

describe('repairHtmlStructure', () => {
  it('rimuove tag di chiusura orfani', () => {
    const html = '<div class="brand">Chiccheria</div></header><section>X</section>';
    const out = repairHtmlStructure(html);
    expect(out).not.toContain('</header>');
    expect(out).toContain('<section>X</section>');
  });

  it('chiude i tag aperti prima di una chiusura orfana (</header> senza <header>)', () => {
    const html = '<header class="nav"><div class="nav-inner"><div class="brand">Chiccheria</div></header><section>X</section>';
    const out = repairHtmlStructure(html);
    expect(analyzeSiteCode(out, 'html').ok).toBe(true);
    expect(out).toContain('</div></header>');
    expect(out).toContain('<section>X</section>');
  });

  it('html sano invariato', () => {
    const html = '<header><div>X</div></header><section><p>Y</p></section>';
    expect(repairHtmlStructure(html)).toBe(html);
  });

  it('rispetta tag void', () => {
    const html = '<div><img src="x.jpg" alt="f"><br></div>';
    expect(repairHtmlStructure(html)).toBe(html);
  });
});
