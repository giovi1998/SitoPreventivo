import { describe, it, expect } from 'vitest';
import { mergeAIResponse } from '../merge';
import { createEmptyQuote, addEmptyOption } from '../../utils/quoteSchema';

describe('mergeAIResponse', () => {
  it('returns same quote with empty changes when no modifications', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, {});
    expect(result.changes).toHaveLength(0);
    expect(result.quote.quoteId).toBe(q.quoteId);
  });

  it('updates project title', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, { project: { title: 'Nuovo Titolo' } });
    expect(result.changes).toContain('Titolo progetto: "Nuovo Titolo"');
    expect(result.quote.project.title).toBe('Nuovo Titolo');
  });

  it('updates client name', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, { client: { name: 'Cliente SPA' } });
    expect(result.changes).toContain('Cliente: "Cliente SPA"');
    expect(result.quote.client.name).toBe('Cliente SPA');
  });

  it('updates option label', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    const optId = withOpt.options[0].id;
    const result = mergeAIResponse(withOpt, {
      options: [{ id: optId, label: 'Opzione Premium' }],
    });
    const updatedOpt = result.quote.options.find(o => o.id === optId);
    expect(updatedOpt?.label).toBe('Opzione Premium');
  });

  it('updates legal clauses', () => {
    const q = createEmptyQuote();
    q.legalClauses = [{ id: 'c1', title: 'Titolo', body: 'Testo', language: 'it' }];
    const result = mergeAIResponse(q, { legalClauses: [{ id: 'c1', title: 'Nuovo Titolo', body: 'Nuovo Testo' }] });
    expect(result.quote.legalClauses[0].title).toBe('Nuovo Titolo');
  });

  it('updates payment terms', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, { paymentTerms: { paymentMethod: 'carta di credito', iban: 'IT123' } });
    expect(result.quote.paymentTerms.paymentMethod).toBe('carta di credito');
    expect(result.quote.paymentTerms.iban).toBe('IT123');
  });

  it('updates status and validUntil', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, { status: 'sent', validUntil: '2027-01-01' });
    expect(result.quote.status).toBe('sent');
    expect(result.quote.validUntil).toBe('2027-01-01');
  });

  it('updates notes', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, { notes: { internal: 'Nota interna', clientVisible: 'Nota cliente' } });
    expect(result.quote.notes.internal).toBe('Nota interna');
    expect(result.quote.notes.clientVisible).toBe('Nota cliente');
  });

  it('updates uiPreferences accentColor', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, { uiPreferences: { accentColor: '#FF0000' } });
    expect(result.quote.uiPreferences.accentColor).toBe('#FF0000');
  });
});
