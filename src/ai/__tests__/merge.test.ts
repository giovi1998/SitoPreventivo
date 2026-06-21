import { describe, it, expect } from 'vitest';
import { mergeAIResponse } from '../merge';
import { createEmptyQuote, addEmptyOption, addEmptyItem } from '../../utils/quoteSchema';

describe('mergeAIResponse', () => {
  it('returns same quote with empty changes when no modifications', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, {});
    expect(result.changes).toHaveLength(0);
    expect(result.quote.quoteId).toBe(q.quoteId);
  });

  it('does NOT update updatedAt when there are no changes (regression for "Modifiche applicate" false positive)', () => {
    const q = createEmptyQuote();
    const originalUpdatedAt = q.updatedAt;
    const result = mergeAIResponse(q, {});
    expect(result.changes).toHaveLength(0);
    expect(result.quote.updatedAt).toBe(originalUpdatedAt);
  });

  it('does update updatedAt when there ARE changes', () => {
    const q = createEmptyQuote();
    const originalUpdatedAt = new Date(Date.now() - 1000).toISOString();
    const q2 = { ...q, updatedAt: originalUpdatedAt };
    const result = mergeAIResponse(q2, { project: { title: 'Nuovo' } });
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.quote.updatedAt).not.toBe(originalUpdatedAt);
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

  it('new AI item without quantity/unitPrice gets safe defaults (bug #7: NaN)', () => {
    const withOpt = addEmptyOption(createEmptyQuote());
    const base = addEmptyItem(withOpt, withOpt.options[0].id);
    const optId = base.options[0].id;
    const result = mergeAIResponse(base, {
      options: [
        {
          id: optId,
          label: base.options[0].label,
          description: base.options[0].description,
          isDefault: true,
          selectionType: 'single',
          items: [
            ...base.options[0].items.map((i) => ({ id: i.id, label: i.label })),
            { id: 'new-item', label: 'Nuova voce' },
          ],
        },
      ],
    });
    const newItem = result.quote.options[0].items.find((i) => i.id === 'new-item');
    expect(newItem).toBeDefined();
    expect(newItem!.quantity).toBe(1);
    expect(newItem!.unitPrice).toBe(0);
    expect(Number.isNaN(newItem!.total.net)).toBe(false);
    expect(Number.isNaN(newItem!.total.gross)).toBe(false);
  });

  it('merges legalClauses with "content" field (AI variant of "body")', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, {
      legalClauses: [
        { id: 'cl-1', title: 'Condizioni Generali', content: 'Testo della clausola' },
      ],
    });
    expect(result.quote.legalClauses[0].title).toBe('Condizioni Generali');
    expect(result.quote.legalClauses[0].body).toBe('Testo della clausola');
  });

  it('merges notes as plain string (AI variant)', () => {
    const q = createEmptyQuote();
    const result = mergeAIResponse(q, {
      notes: 'I prezzi non includono l\'IVA',
    });
    expect(result.quote.notes.clientVisible).toBe('I prezzi non includono l\'IVA');
  });
});
