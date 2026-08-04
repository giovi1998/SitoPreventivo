import { describe, it, expect } from 'vitest';
import { injectImagesIntoHtml } from '../imageInjection';

const IMG1 = 'data:image/jpeg;base64,AAA';
const IMG2 = 'data:image/jpeg;base64,BBB';
const IMG3 = 'data:image/jpeg;base64,CCC';

describe('injectImagesIntoHtml', () => {
  it('riempie i .gallery-item vuoti con le immagini', () => {
    const html = '<section id="gallery"><div class="gallery" aria-label="Galleria foto"><div class="gallery-item"></div><div class="gallery-item"></div><div class="gallery-item"></div></div></section>';
    const out = injectImagesIntoHtml(html, [IMG1, IMG2, IMG3]);
    expect(out).toContain(`<img src="${IMG1}"`);
    expect(out).toContain(`<img src="${IMG2}"`);
    expect(out).toContain(`<img src="${IMG3}"`);
    expect(out).toContain('loading="lazy"');
  });

  it('aggiunge sezione gallery prima del footer se non ci sono gallery-item', () => {
    const html = '<main><section id="hero"></section></main><footer><p>©</p></footer>';
    const out = injectImagesIntoHtml(html, [IMG1, IMG2]);
    expect(out).toContain('id="gallery"');
    expect(out).toContain('<h2>Gallery</h2>');
    expect(out.indexOf('gallery-section')).toBeLessThan(out.indexOf('<footer'));
    expect(out).toContain(`src="${IMG1}"`);
  });

  it('senza immagini rimuove i gallery-item vuoti e la gallery', () => {
    const html = '<section id="gallery"><div class="gallery"><div class="gallery-item"></div><div class="gallery-item"></div></div></section><footer></footer>';
    const out = injectImagesIntoHtml(html, []);
    expect(out).not.toContain('gallery-item');
    expect(out).not.toContain('id="gallery"');
    expect(out).toContain('<footer></footer>');
  });

  it('rimuove i gallery-item rimasti vuoti se più item che immagini', () => {
    const html = '<div class="gallery"><div class="gallery-item"></div><div class="gallery-item"></div><div class="gallery-item"></div></div>';
    const out = injectImagesIntoHtml(html, [IMG1]);
    expect(out).toContain(`src="${IMG1}"`);
    expect(out.match(/gallery-item/g) ?? []).toHaveLength(1);
  });

  it('non tocca HTML senza gallery e senza immagini', () => {
    const html = '<main><p>test</p></main>';
    expect(injectImagesIntoHtml(html, [])).toBe(html);
  });

  it('inietta immagini nei gallery-item di tipo <button> (caso AI)', () => {
    const html = '<div class="gallery-grid"><button class="gallery-item" style="--g1:#a8d977;"><span class="gallery-emoji">🍨</span><div class="gallery-overlay"><h3>Pistacchio</h3></div></button><button class="gallery-item" style="--g1:#f4e4c1;"><span class="gallery-emoji">🌰</span></button></div>';
    const out = injectImagesIntoHtml(html, [IMG1, IMG2]);
    expect(out).toContain(`<img src="${IMG1}"`);
    expect(out).toContain(`<img src="${IMG2}"`);
    expect(out).toContain('Pistacchio');
    expect(out).toContain('gallery-emoji');
  });

  it('mantiene i gallery-item che hanno già img (doppio inject evitato)', () => {
    const html = `<div class="gallery"><div class="gallery-item"><img src="${IMG1}" /></div><div class="gallery-item"></div></div>`;
    const out = injectImagesIntoHtml(html, [IMG2, IMG3]);
    // IMG1 (già presente, non toccato) + IMG2 (item vuoto) + IMG3 (extra) = 3 img
    expect(out.match(/<img/g) ?? []).toHaveLength(3);
    expect(out).toContain(`src="${IMG1}"`);
    expect(out).toContain(`src="${IMG2}"`);
    expect(out).toContain(`src="${IMG3}"`);
  });
});
