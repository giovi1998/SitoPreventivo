import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const INDEX_HTML = join(process.cwd(), 'index.html');

describe('index.html, Quickbrand rebrand', () => {
  const html = readFileSync(INDEX_HTML, 'utf-8');

  it('document <title> no longer contains the legacy brand', () => {
    const m = html.match(/<title>([^<]+)<\/title>/i);
    expect(m).not.toBeNull();
    expect((m?.[1] ?? '').toLowerCase()).not.toContain('precisionquote');
  });

  it('document <title> mentions Quickbrand', () => {
    const m = html.match(/<title>([^<]+)<\/title>/i);
    expect(m?.[1] ?? '').toMatch(/Quickbrand/);
  });

  // Phase 7 polish: em-dashes are not human-natural in browser tab
  // copy. The title used to render as "Quickbrand — Logo e biglietti"
  // in the browser tab, with the AI-typical em-dash. The HTML title
  // must use a regular hyphen.
  it('document <title> does NOT contain an em-dash', () => {
    const m = html.match(/<title>([^<]+)<\/title>/i);
    const title = m?.[1] ?? '';
    expect(title).not.toMatch(/—/);
    expect(title).not.toMatch(/–/);
  });
});
