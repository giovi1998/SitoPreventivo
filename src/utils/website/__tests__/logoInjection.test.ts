import { describe, it, expect } from 'vitest';
import { injectLogoIntoHtml, stripLogoFromHtml } from '../logoInjection';

const LOGO = 'data:image/jpeg;base64,AAAA';

describe('injectLogoIntoHtml', () => {
  it('inietta il logo nel .brand della nav, NON nel footer-brand', () => {
    const html = `<header class="nav"><div class="nav-inner"><div class="brand">Chiccheria</div></div></header>
<footer><div class="section-inner"><div class="footer-top"><div class="footer-brand"><span class="brand">Chiccheria</span></div></div></div></footer>`;
    const out = injectLogoIntoHtml(html, LOGO);
    const navBrand = out.match(/<div class="brand">([\s\S]*?)<\/div>/);
    expect(navBrand?.[1]).toContain('qb-site-logo');
    expect(out.match(/qb-site-logo/g)?.length).toBe(1);
    expect(out.indexOf('qb-site-logo')).toBeLessThan(out.indexOf('footer-brand'));
  });

  it('logo MAI nel brand interno al footer (footer-brand con div.brand)', () => {
    const html = `<header class="nav"><div class="nav-inner"><div class="brand">Chiccheria</div></div></header>
<footer><div class="footer-brand"><div class="brand">Chiccheria</div><p>tagline</p></div></footer>`;
    const out = injectLogoIntoHtml(html, LOGO);
    expect(out.match(/qb-site-logo/g)?.length).toBe(1);
    expect(out.indexOf('qb-site-logo')).toBeLessThan(out.indexOf('<footer'));
  });

  it('fallback: senza .brand inietta in .nav-inner', () => {
    const html = '<header class="nav"><div class="nav-inner"><a href="#">Home</a></div></header>';
    const out = injectLogoIntoHtml(html, LOGO);
    expect(out.match(/qb-site-logo/g)?.length).toBe(1);
    expect(out.indexOf('qb-site-logo')).toBeLessThan(out.indexOf('nav-inner') + 100);
  });

  it('senza logoUrl → HTML invariato', () => {
    const html = '<div class="brand">X</div>';
    expect(injectLogoIntoHtml(html, null)).toBe(html);
  });

  it('rimuove img data: e brand-mark generati dall\'AI prima dell\'iniezione', () => {
    const html = '<div class="brand"><img src="data:image/png;base64,FAKE"><span class="brand-mark">LOGO</span>Nome</div>';
    const out = injectLogoIntoHtml(html, LOGO);
    expect(out).not.toContain('data:image/png;base64,FAKE');
    expect(out).not.toContain('brand-mark');
    expect(out).toContain('qb-site-logo');
  });
});

describe('stripLogoFromHtml', () => {
  it('rimuove il blocco qb-site-logo', () => {
    const html = `<div class="nav-inner"><div class="qb-site-logo" style="display:flex!important;"><img src="data:image/jpeg;base64,AAAA" alt="Logo" /></div><div class="brand">X</div></div>`;
    const out = stripLogoFromHtml(html);
    expect(out).not.toContain('qb-site-logo');
    expect(out).not.toContain('data:image/jpeg;base64,AAAA');
    expect(out).toContain('<div class="brand">X</div>');
  });

  it('HTML senza logo → invariato', () => {
    const html = '<div class="brand">X</div>';
    expect(stripLogoFromHtml(html)).toBe(html);
  });
});
