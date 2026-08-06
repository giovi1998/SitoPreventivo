import { describe, it, expect } from 'vitest';
import { normalizeInlineImages } from '../imageNormalize';

describe('normalizeInlineImages', () => {
  it('strippa whitespace letterali dal payload base64 (base64 wrapped)', () => {
    const dirty = 'data:image/jpeg;base64,abc def\nghi\tjkl';
    const out = normalizeInlineImages(`<img src="${dirty}">`, 100_000);
    expect(out).toBe('<img src="data:image/jpeg;base64,abcdefghijkl">');
  });

  it('strippa whitespace dal PREFISSO (data:image/jpeg; base64,)', () => {
    const dirty = 'data:image/jpeg; base64,abcd';
    const out = normalizeInlineImages(`<img src="${dirty}">`, 100_000);
    expect(out).toBe('<img src="data:image/jpeg;base64,abcd">');
  });

  it("gestisce src SENZA quote (generato dall'AI)", () => {
    const clean = 'data:image/jpeg;base64,abcdef';
    const out = normalizeInlineImages(`<img src=${clean}>`, 100_000);
    expect(out).toBe('<img src=data:image/jpeg;base64,abcdef>');
  });

  it('gestisce src con apici singoli', () => {
    const dirty = 'data:image/jpeg;base64,ab cd';
    const out = normalizeInlineImages(`<img src='${dirty}'>`, 100_000);
    expect(out).toBe('<img src=\'data:image/jpeg;base64,abcd\'>');
  });

  it('src senza quote con immagine troppo grande → placeholder senza quote', () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(10_000)}`;
    const out = normalizeInlineImages(`<img src=${big}>`, 5_000);
    expect(out).not.toContain('A'.repeat(1000));
    expect(out).toContain('data:image/gif;base64,R0lGODlhAQAB');
  });

  it('rimuove le immagini troppo grandi (placeholder 1px)', () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(10_000)}`;
    const out = normalizeInlineImages(`<img src="${big}">`, 5_000);
    expect(out).not.toContain('A'.repeat(1000));
    expect(out).toContain('data:image/gif;base64,R0lGODlhAQAB');
  });

  it('normalizza anche background-image inline', () => {
    const dirty = 'data:image/png;base64,ab cd';
    const out = normalizeInlineImages(`<div style="background-image: url('${dirty}')"></div>`, 100_000);
    expect(out).toContain('background-image: url(\'data:image/png;base64,abcd\')');
  });

  it('html senza data URL resta invariato', () => {
    const html = '<img src="https://x.it/foto.jpg"><div style="color:red"></div>';
    expect(normalizeInlineImages(html, 1000)).toBe(html);
  });

  it('html vuoto resta vuoto', () => {
    expect(normalizeInlineImages('', 1000)).toBe('');
  });
});
