import { describe, it, expect } from 'vitest';
import { detectRelevantFields, buildAIContext, detectToolIntent } from '../context';

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

describe('detectToolIntent', () => {
  it('detects sconto → apply_discount', () => {
    expect(detectToolIntent('Applica sconto 10%')).toBe('apply_discount');
  });
  it('detects margine → adjust_margin', () => {
    expect(detectToolIntent('Ricalcola margine 30%')).toBe('adjust_margin');
  });
  it('detects duplica → duplicate_option', () => {
    expect(detectToolIntent('Duplica opzione 1')).toBe('duplicate_option');
  });
  it('detects ricalcola → recalculate_totals', () => {
    expect(detectToolIntent('Ricalcola totali')).toBe('recalculate_totals');
  });
  it('returns null for unrelated prompt', () => {
    expect(detectToolIntent('ciao')).toBeNull();
  });
});
