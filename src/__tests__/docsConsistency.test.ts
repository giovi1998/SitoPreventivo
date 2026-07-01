import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 7, spec REQ-010/011/012/013. Docs must reflect the current
 * state of the codebase. This test parses README.md, REQUIREMENTS.md,
 * DESIGN.md and AGENTS.md with regex and asserts that the new
 * features (QR, Bigliettino, Volantino-skip, Logo, Tier, Phase 7) and
 * the new env vars (REPLICATE_API_TOKEN replaces BLOB_READ_WRITE_TOKEN)
 * are documented.
 *
 * The contract is intentionally loose (substring / regex on raw text)
 * so it does not break on minor copy changes, it only catches docs
 * that are missing the new concepts entirely.
 */

const ROOT = resolve(__dirname, '..', '..');

function readDoc(filename: string): string {
  const path = resolve(ROOT, filename);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

describe('Docs consistency (Phase 7, REQ-010/011/012/013)', () => {
  // AC-010
  it('README.md mentions QR Code, Bigliettino and Logo in the features list', () => {
    const md = readDoc('README.md');
    expect(md).toMatch(/QR Code/i);
    expect(md).toMatch(/Bigliettin/i);
    expect(md).toMatch(/Logo Builder/i);
  });

  // AC-011
  it('README.md documents the documents table (not legacy quotes table) and unlock_codes', () => {
    const md = readDoc('README.md');
    expect(md).toMatch(/documents/i);
    expect(md).toMatch(/unlock_codes/i);
  });

  // AC-013
  it('AGENTS.md no longer lists BLOB_READ_WRITE_TOKEN and mentions REPLICATE_API_TOKEN', () => {
    const md = readDoc('AGENTS.md');
    expect(md).not.toMatch(/BLOB_READ_WRITE_TOKEN/);
    expect(md).toMatch(/REPLICATE_API_TOKEN/i);
  });

  it('AGENTS.md lists documentSchemas, qrGenerator, cardGenerator, watermark as Key Files', () => {
    const md = readDoc('AGENTS.md');
    expect(md).toMatch(/documentSchemas\.ts/);
    expect(md).toMatch(/qrGenerator\.ts/);
    expect(md).toMatch(/cardGenerator\.ts/);
    expect(md).toMatch(/watermark\.ts/);
  });

  it('AGENTS.md reflects Phase 7 as done (not pending) and notes Volantino skip', () => {
    const md = readDoc('AGENTS.md');
    expect(md).toMatch(/Phase 7/i);
    expect(md).toMatch(/Volantino/i);
  });

  it('REQUIREMENTS.md documents the new localStorage keys (precisionQuote_documents, userSettings_*)', () => {
    const md = readDoc('REQUIREMENTS.md');
    expect(md).toMatch(/precisionQuote_documents/i);
    expect(md).toMatch(/userSettings_/i);
  });

  it('DESIGN.md documents QREditor, CardEditor and LogoEditor components', () => {
    const md = readDoc('DESIGN.md');
    expect(md).toMatch(/QREditor/);
    expect(md).toMatch(/CardEditor/);
    expect(md).toMatch(/LogoEditor/);
  });

  it('README.md does NOT link to the public /docs/logo-ai page (Phase 7 polish, private docs)', () => {
    const md = readDoc('README.md');
    // The /docs/logo-ai page was removed from the public app in a later
    // iteration. The docs live privately in docs/logo-ai.md. README
    // must not advertise a public page that no longer exists.
    expect(md).not.toMatch(/\/docs\/logo-ai/);
  });

  it('the LogoAiDocsPage source file is removed (no public docs page)', () => {
    // Per the user's request: LogoAiDocsPage is not user-visible. The
    // content is kept as a private .md in docs/. The React page +
    // its public route must be gone.
    const path = resolve(ROOT, 'src/pages/LogoAiDocsPage.tsx');
    expect(existsSync(path)).toBe(false);
  });

  it('main.tsx does NOT wire the lazy /docs/logo-ai route', () => {
    const src = readDoc('src/main.tsx');
    expect(src).not.toMatch(/path="\/docs\/logo-ai"/);
  });

  it('docs/logo-ai.md exists as the private internal documentation', () => {
    const path = resolve(ROOT, 'docs/logo-ai.md');
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, 'utf8');
    expect(content).toMatch(/AI Logo Generation/i);
    expect(content).toMatch(/v2/i);
  });

  it('db/schema.ts adds the preferredDocumentType column to userSettings', () => {
    const src = readDoc('db/schema.ts');
    expect(src).toMatch(/preferredDocumentType.*preferred_document_type/);
  });
});
