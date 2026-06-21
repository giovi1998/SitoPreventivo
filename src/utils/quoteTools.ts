import type { PremiumQuote, QuoteItem, QuoteOption, DiscountType } from './quoteSchema';
import {
  calculateItemTotal,
  calculateOptionSummary,
  calculateGlobalTotals,
  recalculateQuote,
  validateQuote,
} from './quoteSchema';

export interface ToolResult {
  quote: PremiumQuote;
  changes: string;
}

function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function recalculateTotals(quote: PremiumQuote): ToolResult {
  return { quote: recalculateQuote(quote), changes: 'Totali ricalcolati per tutte le opzioni.' };
}

export function calculateVat(amount: number, rate: number): number {
  return Math.round(amount * (rate / 100) * 100) / 100;
}

export interface ApplyDiscountArgs {
  type: DiscountType;
  value: number;
  scope: 'all' | 'option' | 'item';
  targetId?: string;
}

export function applyDiscount(quote: PremiumQuote, args: ApplyDiscountArgs): ToolResult {
  const { type, value, scope, targetId } = args;
  let options = quote.options;

  if (scope === 'item' && targetId) {
    options = options.map((opt) => ({
      ...opt,
      items: opt.items.map((item) =>
        item.id === targetId
          ? {
              ...item,
              discount: { type, value },
              total: calculateItemTotal(item.quantity, item.unitPrice, type, value, item.tax.rate),
            }
          : item
      ),
    }));
  } else if (scope === 'option' && targetId) {
    options = options.map((opt) => {
      if (opt.id !== targetId) return opt;
      return {
        ...opt,
        items: opt.items.map((item) => ({
          ...item,
          discount: { type, value },
          total: calculateItemTotal(item.quantity, item.unitPrice, type, value, item.tax.rate),
        })),
      };
    });
  } else {
    options = options.map((opt) => ({
      ...opt,
      items: opt.items.map((item) => ({
        ...item,
        discount: { type, value },
        total: calculateItemTotal(item.quantity, item.unitPrice, type, value, item.tax.rate),
      })),
    }));
  }

  options = options.map((opt) => ({
    ...opt,
    summary: calculateOptionSummary(opt.items),
  }));
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  const scopeLabel = scope === 'all' ? 'tutti gli elementi' : `elemento ${targetId}`;
  const desc = type === 'percentage' ? `${value}%` : `€${value}`;

  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: `Sconto del ${desc} applicato a ${scopeLabel}.`,
  };
}

export function adjustMargin(quote: PremiumQuote, targetMarginPercent: number): ToolResult {
  const clampedMargin = Math.max(0, Math.min(99, targetMarginPercent));
  const options = quote.options.map((opt) => {
    const totalCost = opt.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (totalCost === 0) return opt;
    const targetTotal = totalCost / (1 - clampedMargin / 100);
    const multiplier = targetTotal / totalCost;

    return {
      ...opt,
      items: opt.items.map((item) => {
        const newUnitPrice = Math.round(item.unitPrice * multiplier * 100) / 100;
        return {
          ...item,
          unitPrice: newUnitPrice,
          total: calculateItemTotal(item.quantity, newUnitPrice, item.discount.type, item.discount.value, item.tax.rate),
        };
      }),
      summary: calculateOptionSummary(opt.items),
    };
  });

  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: `Margine adjusted al ${clampedMargin}% (richiesto ${targetMarginPercent}%, clampato a [0,99]). Prezzi unitari modificati proporzionalmente.`,
  };
}

export function duplicateOption(quote: PremiumQuote, optionId: string): ToolResult {
  const target = quote.options.find((o) => o.id === optionId);
  if (!target) return { quote, changes: `Opzione ${optionId} non trovata.` };

  const newOpt: QuoteOption = {
    ...target,
    id: generateId('opt'),
    label: `${target.label} (copia)`,
    isDefault: false,
    items: target.items.map((item) => ({
      ...item,
      id: generateId('item'),
    })),
  };

  const options = [...quote.options, newOpt];
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: `Opzione "${target.label}" duplicata come "${newOpt.label}".`,
  };
}

export function splitQuoteByOption(quote: PremiumQuote, optionIds: string[]): ToolResult {
  const keptOptions = quote.options.filter((o) => optionIds.includes(o.id));
  if (keptOptions.length === 0)
    return { quote, changes: 'Nessuna opzione selezionata per lo split.' };

  const removedIds = quote.options.filter((o) => !optionIds.includes(o.id)).map((o) => o.id);
  const globalTotals = calculateGlobalTotals(keptOptions, optionIds);
  return {
    quote: {
      ...quote,
      options: keptOptions,
      globalTotals,
      updatedAt: new Date().toISOString(),
    },
    changes: `Rimosse ${removedIds.length} opzioni. Mantenute: ${keptOptions.map((o) => o.label).join(', ')}.`,
  };
}

export function mergeOptions(quote: PremiumQuote, optionIds: string[]): ToolResult {
  if (optionIds.length < 2) return { quote, changes: 'Servono almeno 2 opzioni per unirle.' };

  const toMerge = quote.options.filter((o) => optionIds.includes(o.id));
  const keep = quote.options.filter((o) => !optionIds.includes(o.id));

  const allItems: QuoteItem[] = toMerge.flatMap((o) => o.items);
  const mergedOption: QuoteOption = {
    id: generateId('opt'),
    label: `Opzione unificata (${toMerge.length})`,
    description: toMerge.map((o) => o.label).join(' + '),
    isDefault: false,
    selectionType: 'single',
    items: allItems.map((item) => ({
      ...item,
      id: generateId('item'),
    })),
    summary: calculateOptionSummary(allItems),
  };

  const options = [...keep, mergedOption];
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: `Unite ${toMerge.length} opzioni in "${mergedOption.label}".`,
  };
}

export function validateQuoteTool(quote: PremiumQuote): ToolResult {
  const result = validateQuote(quote);
  if (result.success) {
    return { quote, changes: 'Il preventivo è valido. Nessun problema trovato.' };
  }
  const issues = result.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  return {
    quote,
    changes: `Trovati ${result.error.issues.length} problemi di validazione:\n${issues}`,
  };
}

export function reorderOptions(quote: PremiumQuote, sortBy: 'price_asc' | 'price_desc' | 'name'): ToolResult {
  const options = [...quote.options];
  if (sortBy === 'price_asc') {
    options.sort((a, b) => (a.summary?.totalGross || 0) - (b.summary?.totalGross || 0));
  } else if (sortBy === 'price_desc') {
    options.sort((a, b) => (b.summary?.totalGross || 0) - (a.summary?.totalGross || 0));
  } else {
    options.sort((a, b) => a.label.localeCompare(b.label));
  }
  // Preserve original isDefault (bug #6): only set isDefault on first sorted option
  // if NO option was previously default. Otherwise keep the original default.
  const originalDefaultIds = new Set(quote.options.filter((o) => o.isDefault).map((o) => o.id));
  const originalSelectedIds = quote.globalTotals.optionsSelected;
  const sorted = options.map((o, i) => ({
    ...o,
    isDefault: originalDefaultIds.size > 0
      ? o.isDefault
      : i === 0,
  }));
  const globalTotals = calculateGlobalTotals(
    sorted,
    originalSelectedIds.length > 0
      ? originalSelectedIds.filter((id) => sorted.some((o) => o.id === id))
      : sorted.filter((o) => o.isDefault).map((o) => o.id)
  );
  return {
    quote: { ...quote, options: sorted, globalTotals, updatedAt: new Date().toISOString() },
    changes: `Opzioni riordinate per ${sortBy === 'price_asc' ? 'prezzo crescente' : sortBy === 'price_desc' ? 'prezzo decrescente' : 'nome'}.`,
  };
}

export function removeEmptyItems(quote: PremiumQuote): ToolResult {
  let removed = 0;
  const options = quote.options.map((opt) => {
    const before = opt.items.length;
    const items = opt.items.filter((item) => item.quantity > 0 && item.unitPrice > 0);
    removed += before - items.length;
    return { ...opt, items, summary: calculateOptionSummary(items) };
  });
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: removed > 0 ? `Rimossi ${removed} voci con costo o quantità zero.` : 'Nessuna voce vuota trovata.',
  };
}

export function mergeDuplicateItems(quote: PremiumQuote): ToolResult {
  let merged = 0;
  const options = quote.options.map((opt) => {
    const seen = new Map<string, QuoteItem>();
    const items: QuoteItem[] = [];
    for (const item of opt.items) {
      // Key includes label, unit, unitPrice, tax rate (bug #11: different tax rates
      // must NOT be merged because the total would be wrong).
      const key = `${item.label.toLowerCase()}_${item.unit}_${item.unitPrice}_${item.tax.rate}`;
      if (seen.has(key)) {
        const existing = seen.get(key)!;
        const newQty = existing.quantity + item.quantity;
        const newTotal = calculateItemTotal(newQty, existing.unitPrice, existing.discount.type, existing.discount.value, existing.tax.rate);
        seen.set(key, { ...existing, quantity: newQty, total: newTotal });
        merged++;
      } else {
        seen.set(key, item);
        items.push(item);
      }
    }
    return { ...opt, items, summary: calculateOptionSummary(items) };
  });
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: merged > 0 ? `Unite ${merged} voci duplicate.` : 'Nessuna voce duplicata trovata.',
  };
}

export function roundPrices(quote: PremiumQuote, nearest: number = 5): ToolResult {
  if (!Number.isFinite(nearest) || nearest <= 0) {
    return { quote, changes: `Arrotondamento non valido: nearest=${nearest}. Nessuna modifica effettuata.` };
  }
  const options = quote.options.map((opt) => ({
    ...opt,
    items: opt.items.map((item) => {
      const rounded = Math.round(item.unitPrice / nearest) * nearest;
      return {
        ...item,
        unitPrice: rounded,
        total: calculateItemTotal(item.quantity, rounded, item.discount.type, item.discount.value, item.tax.rate),
      };
    }),
    summary: calculateOptionSummary(opt.items),
  }));
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: `Prezzi arrotondati al multiplo di €${nearest}.`,
  };
}

export function calculateAnnualCost(quote: PremiumQuote): ToolResult {
  let added = 0;
  const options = quote.options.map((opt) => {
    const items = [...opt.items];
    const monthlyItems = opt.items.filter(
      (i) => i.unit === 'month' && i.quantity > 0 && !i.label.includes('(12 mesi)'),
    );
    for (const monthlyItem of monthlyItems) {
      const annualLabel = `${monthlyItem.label} (12 mesi)`;
      const alreadyExists = items.some((i) => i.label === annualLabel);
      if (alreadyExists) continue;
      const annualItem: QuoteItem = {
        ...monthlyItem,
        id: generateId('item'),
        label: annualLabel,
        quantity: 12,
        total: calculateItemTotal(12, monthlyItem.unitPrice, monthlyItem.discount.type, monthlyItem.discount.value, monthlyItem.tax.rate),
      };
      items.push(annualItem);
      added++;
    }
    return { ...opt, items, summary: calculateOptionSummary(items) };
  });
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: added > 0 ? `Aggiunti ${added} costi annuali per voci mensili.` : 'Nessun nuovo costo annuale da aggiungere.',
  };
}

export function checkConsistency(quote: PremiumQuote): ToolResult {
  const issues: string[] = [];
  for (const opt of quote.options) {
    const recalc = calculateOptionSummary(opt.items);
    if (Math.abs(recalc.totalNet - (opt.summary?.totalNet || 0)) > 0.01) {
      issues.push(`Opzione "${opt.label}": totale NET non coerente (attuale ${opt.summary?.totalNet}, calcolato ${recalc.totalNet})`);
    }
    for (const item of opt.items) {
      const expected = calculateItemTotal(item.quantity, item.unitPrice, item.discount.type, item.discount.value, item.tax.rate);
      if (Math.abs(expected.net - (item.total?.net || 0)) > 0.01) {
        issues.push(`Voce "${item.label}": totali non coerenti`);
      }
    }
  }
  if (issues.length > 0) {
    const fixed = recalculateQuote(quote);
    return {
      quote: fixed,
      changes: `Trovate ${issues.length} incoerenze, totali ricalcolati:\n${issues.join('\n')}`,
    };
  }
  return { quote, changes: 'Tutti i totali sono coerenti.' };
}

export type ToolName =
  | 'recalculate_totals'
  | 'apply_discount'
  | 'adjust_margin'
  | 'duplicate_option'
  | 'split_quote'
  | 'merge_options'
  | 'reorder_options'
  | 'remove_empty_items'
  | 'merge_duplicate_items'
  | 'round_prices'
  | 'calculate_annual_cost'
  | 'check_consistency';

export interface ToolCall {
  tool: ToolName;
  args: Record<string, unknown>;
}
