import { describe, it, expect } from 'vitest';
import {
  createEmptyQuote,
  migrateFromLegacy,
  validateQuote,
  recalculateQuote,
  calculateItemTotal,
  calculateOptionSummary,
  calculateGlobalTotals,
  addEmptyOption,
  addEmptyItem,
  toLegacyFormat,
} from '../quoteSchema';

describe('quoteSchema', () => {
  it('createEmptyQuote produces valid quote', () => {
    const q = createEmptyQuote();
    const result = validateQuote(q);
    expect(result.success).toBe(true);
    expect(q.quoteId).toMatch(/^quote_/);
    expect(q.status).toBe('draft');
    expect(q.version).toBe('1.0');
  });

  it('calculateItemTotal basic', () => {
    const t = calculateItemTotal(10, 80, 'none', 0, 22);
    expect(t.net).toBe(800);
    expect(t.tax).toBe(176);
    expect(t.gross).toBe(976);
  });

  it('calculateItemTotal with percentage discount', () => {
    const t = calculateItemTotal(10, 80, 'percentage', 10, 22);
    expect(t.net).toBe(720);
    expect(t.tax).toBe(158.4);
    expect(t.gross).toBe(878.4);
  });

  it('calculateItemTotal with absolute discount', () => {
    const t = calculateItemTotal(10, 80, 'absolute', 100, 22);
    expect(t.net).toBe(700);
    expect(t.tax).toBe(154);
    expect(t.gross).toBe(854);
  });

  it('migrateFromLegacy preserves data', () => {
    const legacy = {
      id: 'OLD-001',
      title: 'Test',
      client: 'Cliente SPA',
      contact: 'Mario Rossi',
      status: 'bozza',
      date: '2026-06-01',
      owner: 'Azienda S.r.l.',
      intro: 'Realizzazione sito web',
      note: 'Note interne',
      vat: 22,
      color: '#2563EB',
      options: [
        { id: 'o1', title: 'Base', description: 'Opzione base', oneTimeCost: 1000, monthlyCost: 50, includesMaintenance: true },
      ],
      clauses: [
        { id: 'c1', title: 'Validità', body: '30 giorni' },
      ],
    };

    const q = migrateFromLegacy(legacy);
    expect(q.quoteId).toBe('OLD-001');
    expect(q.project.title).toBe('Test');
    expect(q.client.name).toBe('Cliente SPA');
    expect(q.client.contactPerson).toBe('Mario Rossi');
    expect(q.issuer.name).toBe('Azienda S.r.l.');
    expect(q.project.description).toBe('Realizzazione sito web');
    expect(q.notes.internal).toBe('Note interne');
    expect(q.uiPreferences.accentColor).toBe('#2563EB');
    expect(q.legalClauses).toHaveLength(1);
    expect(q.legalClauses[0].title).toBe('Validità');
  });

  it('migrateFromLegacy converts costs correctly', () => {
    const legacy = {
      options: [
        { id: 'o1', title: 'Base', description: 'Piano base con manutenzione', oneTimeCost: 1500, monthlyCost: 100, includesMaintenance: true },
      ],
    };
    const q = migrateFromLegacy(legacy);
    expect(q.options).toHaveLength(1);
    expect(q.options[0].items).toHaveLength(2);
    const fixedItem = q.options[0].items.find((i) => i.unit === 'fixed');
    const monthlyItem = q.options[0].items.find((i) => i.unit === 'month');
    expect(fixedItem?.unitPrice).toBe(1500);
    expect(monthlyItem?.unitPrice).toBe(100);
    expect(monthlyItem?.quantity).toBe(12);
  });

  it('recalculateQuote updates totals', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    const withItem = addEmptyItem(withOpt, withOpt.options[0].id);
    const recalculated = recalculateQuote(withItem);
    expect(recalculated.globalTotals.totalNet).toBe(0);
    expect(recalculated.options[0].summary.totalNet).toBe(0);
  });

  it('addEmptyOption adds option', () => {
    const q = createEmptyQuote();
    const updated = addEmptyOption(q);
    expect(updated.options).toHaveLength(1);
    expect(updated.options[0].label).toBe('Nuova opzione');
  });

  it('toLegacyFormat round-trips', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    const legacy = toLegacyFormat(withOpt);
    expect(legacy.id).toBe(withOpt.quoteId);
    const migrated = migrateFromLegacy(legacy);
    expect(migrated.quoteId).toBe(withOpt.quoteId);
  });

  it('toLegacyFormat embeds _premium for lossless roundtrip', () => {
    const q = createEmptyQuote();
    q.project.title = 'Test roundtrip';
    q.paymentTerms.iban = 'IT60X0542811101000000123456';
    q.notes.clientVisible = 'Nota visibile al cliente';
    const withOpt = addEmptyOption(q);
    const legacy = toLegacyFormat(withOpt);
    expect(legacy._premium).toBeDefined();
    const migrated = migrateFromLegacy(legacy);
    expect(migrated.quoteId).toBe(withOpt.quoteId);
    expect(migrated.project.title).toBe('Test roundtrip');
    expect(migrated.paymentTerms.iban).toBe('IT60X0542811101000000123456');
    expect(migrated.notes.clientVisible).toBe('Nota visibile al cliente');
  });

  it('validateQuote rejects invalid status', () => {
    const q = createEmptyQuote();
    (q as any).status = 'invalid_status';
    const result = validateQuote(q);
    expect(result.success).toBe(false);
  });

  it('validateQuote accepts valid full quote', () => {
    const q = createEmptyQuote();
    q.options.push({
      id: 'opt_test',
      label: 'Test Option',
      description: 'Description',
      isDefault: true,
      selectionType: 'single',
      items: [{
        id: 'item_test',
        label: 'Item',
        description: '',
        category: 'service',
        unit: 'fixed',
        quantity: 1,
        unitPrice: 100,
        discount: { type: 'none', value: 0 },
        tax: { type: 'vat', rate: 22 },
        total: { net: 100, tax: 22, gross: 122 },
      }],
      summary: { subtotalNet: 100, discountsTotal: 0, taxTotal: 22, totalNet: 100, totalGross: 122 },
    });
    q.globalTotals = {
      currency: 'EUR', subtotalNet: 100, optionsSelected: ['opt_test'],
      discountsTotal: 0, taxTotal: 22, totalNet: 100, totalGross: 122, roundingAdjustment: 0,
    };
    const result = validateQuote(q);
    expect(result.success).toBe(true);
  });
});
