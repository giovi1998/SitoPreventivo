import { describe, it, expect, beforeEach } from 'vitest';
import { ensureDocumentFonts, resetDocumentFontsForTest } from '../fontLoader';

describe('fontLoader (REQ-DS-005)', () => {
  beforeEach(() => {
    resetDocumentFontsForTest();
  });

  it('inietta il link Google Fonts nel document head', () => {
    ensureDocumentFonts();
    const link = document.getElementById('qb-document-fonts') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link?.rel).toBe('stylesheet');
    expect(link?.href).toContain('fonts.googleapis.com');
    expect(link?.href).toContain('Playfair');
  });

  it('è idempotente (nessun duplicato su chiamate ripetute)', () => {
    ensureDocumentFonts();
    ensureDocumentFonts();
    ensureDocumentFonts();
    const links = document.querySelectorAll('#qb-document-fonts');
    expect(links).toHaveLength(1);
  });

  it('non reinietta se il link esiste già (es. hot reload)', () => {
    const manual = document.createElement('link');
    manual.id = 'qb-document-fonts';
    document.head.appendChild(manual);
    resetDocumentFontsForTest(); // reset flag ma lascia il link nel DOM? no: rimuove
    // re-aggiungo manualmente per simulare link preesistente
    const pre = document.createElement('link');
    pre.id = 'qb-document-fonts';
    document.head.appendChild(pre);
    ensureDocumentFonts();
    expect(document.querySelectorAll('#qb-document-fonts')).toHaveLength(1);
  });
});
