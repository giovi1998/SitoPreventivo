import { describe, it, expect } from 'vitest';
import { ensureSeoMeta, stripSocialCanonical } from '../seoMeta';

const brief = { businessName: 'Gelateria Chiccheria', description: 'Gelateria artigianale a Cagliari con gusti del giorno.' };

describe('ensureSeoMeta', () => {
  it('inietta meta description + OG tags se il head ne è privo', () => {
    const html = '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Home</title></head><body></body></html>';
    const out = ensureSeoMeta(html, brief);
    expect(out).toContain('name="description" content="Gelateria artigianale a Cagliari');
    expect(out).toContain('property="og:title" content="Home"');
    expect(out).toContain('property="og:description"');
    expect(out).toContain('property="og:type" content="website"');
    expect(out).toContain('property="og:site_name" content="Gelateria Chiccheria"');
  });

  it('non duplica i meta già presenti', () => {
    const html = '<html><head><meta name="description" content="Gia presente"><meta property="og:type" content="article"><title>T</title></head></html>';
    const out = ensureSeoMeta(html, brief);
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out.match(/property="og:type"/g)).toHaveLength(1);
  });

  it('og:description coerente con la meta description esistente, non col brief', () => {
    const html = '<html><head><meta name="description" content="Tre Coni dal 2016"><title>T</title></head></html>';
    const out = ensureSeoMeta(html, brief);
    expect(out).toContain('property="og:description" content="Tre Coni dal 2016"');
    expect(out).not.toContain('og:description" content="Gelateria artigianale');
  });

  it('sanitizza il testo del brief: niente emoji né a capo letterali nei meta', () => {
    const dirty = { businessName: 'Chiccheria', description: 'Attività vincitrice 🦐 Tre coni\n@gambero_rosso dal 2016 (GR) 🏆\nDue coni 2017' };
    const html = '<html><head><meta charset="UTF-8"><title>Chiccheria</title></head></html>';
    const out = ensureSeoMeta(html, dirty);
    expect(out).not.toContain('🦐');
    expect(out).not.toContain('🏆');
    expect(out).not.toContain('\\n');
    expect(out).toContain('name="description" content="Attività vincitrice Tre coni');
    const descMatch = out.match(/name="description" content="([^"]+)"/);
    expect(descMatch![1]).not.toContain('\n');
  });

  it('i tag OG vengono inseriti DOPO charset e viewport', () => {
    const html = '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Home</title></head><body></body></html>';
    const out = ensureSeoMeta(html, brief);
    const charsetIdx = out.indexOf('charset');
    const viewportIdx = out.indexOf('viewport');
    const ogIdx = out.indexOf('property="og:title"');
    expect(ogIdx).toBeGreaterThan(charsetIdx);
    expect(ogIdx).toBeGreaterThan(viewportIdx);
  });

  it('escape XML nel contenuto (quote, &, <)', () => {
    const html = '<html><head><title>T</title></head></html>';
    const out = ensureSeoMeta(html, { businessName: 'A & B', description: 'Gelati "top" <artigianali>' });
    expect(out).toContain('content="A &amp; B"');
    expect(out).toContain('content="Gelati &quot;top&quot; &lt;artigianali&gt;"');
  });

  it('html senza <head> resta invariato', () => {
    const html = '<body><p>ciao</p></body>';
    expect(ensureSeoMeta(html, brief)).toBe(html);
  });

  it('html vuoto resta vuoto', () => {
    expect(ensureSeoMeta('', brief)).toBe('');
  });

  it('senza description: nessun tag description, ma OG strutturali si', () => {
    const html = '<html><head><title>T</title></head></html>';
    const out = ensureSeoMeta(html, { businessName: 'X', description: '' });
    expect(out).not.toContain('og:description');
    expect(out).not.toContain('name="description"');
    expect(out).toContain('property="og:title" content="T"');
    expect(out).toContain('property="og:type" content="website"');
  });
});

describe('stripSocialCanonical', () => {
  it('rimuove canonical verso Instagram', () => {
    const html = '<html><head><link rel="canonical" href="https://www.instagram.com/gelateriachiccheriacagliari/"><title>T</title></head></html>';
    expect(stripSocialCanonical(html)).not.toContain('canonical');
  });

  it('mantiene canonical verso dominio proprio', () => {
    const html = '<html><head><link rel="canonical" href="https://gelateriachiccheria.it/"><title>T</title></head></html>';
    expect(stripSocialCanonical(html)).toContain('canonical');
    expect(stripSocialCanonical(html)).toContain('gelateriachiccheria.it');
  });

  it('rimuove anche facebook/tiktok/linkedin', () => {
    const html = '<head><link rel="canonical" href="https://facebook.com/chiccheria"><link rel="canonical" href="https://tiktok.com/@x"><title>T</title></head>';
    const out = stripSocialCanonical(html);
    expect(out).not.toContain('facebook.com');
    expect(out).not.toContain('tiktok.com');
  });

  it('sanitizza emoji/a capo nei content dei meta già presenti', () => {
    const html = '<html><head><meta name="description" content="Vincitore 🦐 Tre coni\n@gambero_rosso dal 2016 🏆"><title>T</title></head></html>';
    const out = ensureSeoMeta(html, { businessName: 'X', description: '' });
    expect(out).not.toContain('🦐');
    expect(out).not.toContain('🏆');
    const desc = out.match(/name="description" content="([^"]+)"/)![1];
    expect(desc).not.toContain('\n');
    expect(desc).toContain('Tre coni');
  });
});
