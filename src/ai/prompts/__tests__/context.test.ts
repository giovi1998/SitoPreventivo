import { describe, it, expect } from 'vitest';
import { detectRelevantFields, buildAIContext } from '../context';

describe('detectRelevantFields', () => {
  it('detects project field for title keywords', () => {
    expect(detectRelevantFields('Cambia il titolo del progetto')).toContain('project');
  });
  it('detects client field for cliente/email', () => {
    expect(detectRelevantFields('Aggiorna il cliente Francesca')).toContain('client');
  });
  it('detects options for opzioni/prezzo', () => {
    expect(detectRelevantFields('Modifica opzione 2')).toContain('options');
  });
  it('detects legalClauses for clausole', () => {
    expect(detectRelevantFields('Aggiungi una clausola FAQ')).toContain('legalClauses');
  });
  it('detects paymentTerms for pagamenti/IBAN', () => {
    expect(detectRelevantFields('Cambia IBAN di pagamento')).toContain('paymentTerms');
  });
  it('detects notes for nota', () => {
    expect(detectRelevantFields('Aggiungi una nota interna')).toContain('notes');
  });
  it('detects uiPreferences for colore/tema', () => {
    expect(detectRelevantFields('Cambia colore in blu')).toContain('uiPreferences');
  });
  it('detects status for bozza/inviato', () => {
    expect(detectRelevantFields('Imposta stato inviato')).toContain('status');
  });
  it('returns empty for unrelated prompt', () => {
    expect(detectRelevantFields('Ciao come stai?').size).toBe(0);
  });
  it('detects issuer for "partita iva" (bug fix: missing keyword)', () => {
    expect(detectRelevantFields('Cambia la partita iva')).toContain('issuer');
  });
  it('detects issuer for "codice fiscale"', () => {
    expect(detectRelevantFields('Aggiorna codice fiscale')).toContain('issuer');
  });
});

describe('buildAIContext', () => {
  const baseQuote = {
    project: { title: 'X', description: 'Y' },
    client: { name: 'A' },
    issuer: {},
    legalClauses: [],
    paymentTerms: {},
    notes: { internal: '', clientVisible: '' },
    uiPreferences: { accentColor: '#000' },
    status: 'draft',
    validUntil: '',
    currency: 'EUR',
    locale: 'it',
    options: [{ id: 'o1', label: 'A', description: '', isDefault: false, selectionType: 'single', items: [] }],
  } as any;

  it('returns payload + relevantFields for known prompt', () => {
    const result = buildAIContext(baseQuote, 'Cambia il titolo del progetto');
    expect(result.payload.project).toBeDefined();
    expect(result.relevantFields).toContain('project');
  });
  it('returns default fields when no match', () => {
    const result = buildAIContext(baseQuote, 'Ciao');
    expect(result.payload).toBeDefined();
    expect(result.payload.currency).toBeDefined();
  });
  it('always includes options in payload', () => {
    const result = buildAIContext(baseQuote, 'qualsiasi cosa');
    expect(result.payload.options).toBeDefined();
  });
});
