import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Phase 13b — REQ-DS-001/002/003.
 *
 * - I token "The Classic" e i token prima "fantasma" DEVONO essere definiti
 *   in GlobalStyles `:root` (light + dark).
 * - Nessun foglio UI chrome può usare hex teal `#01696F` o blu `#0B57D0`
 *   hardcoded (eccezione: `doc-theme-*` dentro GlobalStyles, che sono temi
 *   documento = contenuto utente, e i default colore dei documenti negli
 *   schema/generatori).
 */

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function collectCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectCss(full, out);
    } else if (entry.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

describe('REQ-DS-001/003: design token globali "The Classic"', () => {
  const globalStyles = read('src/components/GlobalStyles.tsx');

  const REQUIRED_TOKENS = [
    '--accent:#E62020',
    '--paper:',
    '--accent-soft:',
    '--accent-softer:',
    '--success:',
    // ghost tokens (REQ-DS-003)
    '--primary:',
    '--ink-soft:',
    '--ink-muted:',
    '--bg:',
    '--surface-2:',
    '--danger-bg:',
    '--accent-bg:',
    '--radius-pill:',
    // tipografia (REQ-DS-004)
    '--font-display:',
    '--font-body:',
    '--font-mono:',
    '--text-xs:',
    '--text-4xl:',
  ];

  it.each(REQUIRED_TOKENS)('definisce %s in :root', (token) => {
    expect(globalStyles).toContain(token);
  });

  it('definisce i token anche in dark theme', () => {
    const darkBlock = globalStyles.split('[data-theme="dark"]')[1] ?? '';
    for (const token of ['--primary:', '--ink-soft:', '--bg:', '--accent-soft:', '--radius-pill:']) {
      expect(darkBlock).toContain(token);
    }
  });

  it('non usa più rgba(11,87,208) nel chrome globale', () => {
    expect(globalStyles).not.toMatch(/rgba\(11,\s*87,\s*208/);
  });

  it('non carica più le 14 famiglie font via @import (REQ-DS-005)', () => {
    expect(globalStyles).not.toContain('@import url');
  });
});

describe('REQ-DS-002: purge teal/blu hardcoded nei fogli UI chrome', () => {
  const cssFiles = collectCss(join(ROOT, 'src', 'components'));

  // Hex vietati nei fogli chrome. Il teal/blu restano solo come default
  // colore dei documenti (schema/generatori/temi doc), non nel chrome.
  const FORBIDDEN = /#01696F|#0B57D0|rgba\(1,\s*105,\s*111|rgba\(11,\s*87,\s*208/i;

  it('trovati fogli CSS da controllare', () => {
    expect(cssFiles.length).toBeGreaterThan(10);
  });

  for (const rel of cssFiles.map((f) => f.replace(ROOT + '\\', '').replace(ROOT + '/', ''))) {
    // cardPreviewSide.css dichiara --card-accent come default del documento
    // (contenuto utente, come i doc-theme-*): esente.
    if (rel.includes('cardPreviewSide.css')) continue;
    it(`${rel} senza teal/blu hardcoded`, () => {
      const css = read(rel);
      expect(css).not.toMatch(FORBIDDEN);
    });
  }
});
