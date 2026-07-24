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
  reorderOptions,
  removeEmptyItems,
  mergeDuplicateItems,
  roundPrices,
  calculateAnnualCost,
  checkConsistency,
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

  it('reorderOptions preserves isDefault (bug #6)', () => {
    const q = createEmptyQuote();
    let updated = addEmptyOption(q);
    updated = addEmptyOption(updated);
    updated = addEmptyOption(updated);
    // Set 2nd option as default, 1st and 3rd as not default
    updated.options[0].isDefault = false;
    updated.options[1].isDefault = true;
    updated.options[2].isDefault = false;
    updated.globalTotals.optionsSelected = [updated.options[1].id];

    const result = reorderOptions(updated, 'price_asc');
    // The 2nd option should still be default after reorder
    const defaultOpt = result.quote.options.find((o) => o.isDefault);
    expect(defaultOpt?.id).toBe(updated.options[1].id);
    // optionsSelected should preserve original selection
    expect(result.quote.globalTotals.optionsSelected).toContain(updated.options[1].id);
  });

  it('removeEmptyItems removes items with zero quantity or price', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    withOpt.options[0].items.push({
      id: 'empty1', label: 'Zero qty', description: '', category: 'service', unit: 'fixed',
      quantity: 0, unitPrice: 100, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 }, total: { net: 0, tax: 0, gross: 0 },
    });
    withOpt.options[0].items.push({
      id: 'empty2', label: 'Zero price', description: '', category: 'service', unit: 'fixed',
      quantity: 1, unitPrice: 0, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 }, total: { net: 0, tax: 0, gross: 0 },
    });
    const result = removeEmptyItems(withOpt);
    expect(result.changes).toContain('Rimossi');
    expect(result.quote.options[0].items.length).toBeLessThan(withOpt.options[0].items.length);
  });

  it('mergeDuplicateItems does NOT merge items with different tax rates (bug #11)', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    withOpt.options[0].items.push({
      id: 'i1', label: 'Service', description: '', category: 'service', unit: 'fixed',
      quantity: 1, unitPrice: 100, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 }, total: { net: 100, tax: 22, gross: 122 },
    });
    withOpt.options[0].items.push({
      id: 'i2', label: 'Service', description: '', category: 'service', unit: 'fixed',
      quantity: 1, unitPrice: 100, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 4 }, total: { net: 100, tax: 4, gross: 104 },
    });
    const result = mergeDuplicateItems(withOpt);
    // Should NOT merge because tax rates differ
    expect(result.quote.options[0].items.length).toBe(2);
  });

  it('roundPrices with nearest=0 is a no-op (bug #9)', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    withOpt.options[0].items.push({
      id: 'i1', label: 'Service', description: '', category: 'service', unit: 'fixed',
      quantity: 1, unitPrice: 123, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 }, total: { net: 123, tax: 27.06, gross: 150.06 },
    });
    const result = roundPrices(withOpt, 0);
    // nearest=0 should not change prices (no NaN, no crash)
    expect(result.quote.options[0].items[0].unitPrice).toBe(123);
  });

  it('calculateAnnualCost is idempotent (bug #10)', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    withOpt.options[0].items.push({
      id: 'monthly', label: 'Manutenzione', description: '', category: 'service', unit: 'month',
      quantity: 1, unitPrice: 50, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 }, total: { net: 50, tax: 11, gross: 61 },
    });
    const first = calculateAnnualCost(withOpt);
    const second = calculateAnnualCost(first.quote);
    // Second call should NOT add another annual row
    const annualItems = second.quote.options[0].items.filter((i) => i.label.includes('12 mesi'));
    expect(annualItems.length).toBe(1);
  });

  it('adjustMargin with >=100% is clamped (bug #8)', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    withOpt.options[0].items.push({
      id: 'i1', label: 'Service', description: '', category: 'service', unit: 'fixed',
      quantity: 1, unitPrice: 100, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 }, total: { net: 100, tax: 22, gross: 122 },
    });
    const result = adjustMargin(withOpt, 150);
    // Should not produce NaN or Infinity
    const price = result.quote.options[0].items[0].unitPrice;
    expect(Number.isFinite(price)).toBe(true);
    expect(Number.isNaN(price)).toBe(false);
  });

  it('checkConsistency detects inconsistent totals', () => {
    const q = createEmptyQuote();
    const withOpt = addEmptyOption(q);
    withOpt.options[0].items.push({
      id: 'i1', label: 'Service', description: '', category: 'service', unit: 'fixed',
      quantity: 1, unitPrice: 100, discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 },
      total: { net: 999, tax: 22, gross: 122 },  // inconsistent net
    });
    const result = checkConsistency(withOpt);
    expect(result.changes).toContain('incoerenze');
  });
});
