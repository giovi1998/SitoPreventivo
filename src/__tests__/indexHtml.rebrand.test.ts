import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const INDEX_HTML = join(process.cwd(), 'index.html');

describe('index.html — Quickbrand rebrand', () => {
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
});
