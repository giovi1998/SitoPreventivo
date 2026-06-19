import { describe, it, expect } from 'vitest';
import {
  recalculateTotals,
  calculateVat,
  applyDiscount,
  adjustMargin,
  duplicateOption,
  splitQuoteByOption,
  mergeOptions,
  validateQuoteTool,
} from '../quoteTools';
import { createEmptyQuote, addEmptyOption, addEmptyItem } from '../quoteSchema';

describe('quoteTools', () => {
  it('recalculateTotals', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    const result = recalculateTotals(withOpt);
    expect(result.changes).toContain('ricalcolati');
    expect(result.quote.globalTotals.totalNet).toBe(0);
  });

  it('calculateVat', () => {
    expect(calculateVat(1000, 22)).toBe(220);
    expect(calculateVat(0, 22)).toBe(0);
  });

  it('applyDiscount percentage on all', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    const withItem = addEmptyItem(withOpt, withOpt.options[0].id);
    withItem.options[0].items[0].unitPrice = 100;
    withItem.options[0].items[0].quantity = 1;

    const result = applyDiscount(withItem, { type: 'percentage', value: 10, scope: 'all' });
    expect(result.quote.options[0].items[0].discount.type).toBe('percentage');
    expect(result.quote.options[0].items[0].discount.value).toBe(10);
    expect(result.changes).toContain('10%');
  });

  it('applyDiscount absolute', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    const result = applyDiscount(withOpt, { type: 'absolute', value: 50, scope: 'all' });
    expect(result.changes).toContain('€50');
  });

  it('duplicateOption', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    const result = duplicateOption(withOpt, withOpt.options[0].id);
    expect(result.quote.options).toHaveLength(2);
    expect(result.quote.options[1].label).toContain('(copia)');
  });

  it('splitQuoteByOption', () => {
    const q = createEmptyQuote();
    let updated = addEmptyOption(q);
    updated = addEmptyOption(updated);
    const ids = [updated.options[1].id];
    const result = splitQuoteByOption(updated, ids);
    expect(result.quote.options).toHaveLength(1);
  });

  it('mergeOptions requires at least 2', () => {
    const q = createEmptyQuote();
    let updated = addEmptyOption(q);
    updated = addEmptyOption(updated);
    const ids = updated.options.map((o) => o.id);
    const result = mergeOptions(updated, ids);
    expect(result.quote.options).toHaveLength(1);
    expect(result.quote.options[0].label).toContain('unificata');
  });

  it('validateQuoteTool', () => {
    const q = createEmptyQuote();
    const result = validateQuoteTool(q);
    expect(result.changes).toContain('valido');
  });

  it('adjustMargin', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    withOpt.options[0].items.push({
      id: 'test_item',
      label: 'Costo test',
      description: '',
      category: 'service',
      unit: 'fixed',
      quantity: 1,
      unitPrice: 100,
      discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 },
      total: { net: 100, tax: 22, gross: 122 },
    });
    const result = adjustMargin(withOpt, 30);
    expect(result.changes).toContain('30%');
  });
});
