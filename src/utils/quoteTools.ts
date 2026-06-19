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
  const options = quote.options.map((opt) => {
    const totalCost = opt.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (totalCost === 0) return opt;
    const targetTotal = totalCost / (1 - targetMarginPercent / 100);
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
    changes: `Margine adjusted al ${targetMarginPercent}%. Prezzi unitari modificati proporzionalmente.`,
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
  const sorted = options.map((o, i) => ({ ...o, isDefault: i === 0 }));
  const globalTotals = calculateGlobalTotals(sorted, sorted.filter((o) => o.isDefault).map((o) => o.id));
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
      const key = `${item.label.toLowerCase()}_${item.unit}_${item.unitPrice}`;
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
  const options = quote.options.map((opt) => {
    const monthlyItem = opt.items.find((i) => i.unit === 'month');
    if (!monthlyItem || monthlyItem.quantity <= 0) return opt;
    const annualItem: QuoteItem = {
      ...monthlyItem,
      id: generateId('item'),
      label: `${monthlyItem.label} (12 mesi)`,
      quantity: 12,
      total: calculateItemTotal(12, monthlyItem.unitPrice, monthlyItem.discount.type, monthlyItem.discount.value, monthlyItem.tax.rate),
    };
    const items = [...opt.items, annualItem];
    return { ...opt, items, summary: calculateOptionSummary(items) };
  });
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return {
    quote: { ...quote, options, globalTotals, updatedAt: new Date().toISOString() },
    changes: 'Aggiunto costo annuale per voci mensili.',
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

export function generateSummary(quote: PremiumQuote): { quote: PremiumQuote; changes: string } {
  const opts = quote.options;
  const lines: string[] = [];
  lines.push(`Preventivo: ${quote.project?.title || 'Senza titolo'}`);
  lines.push(`Cliente: ${quote.client?.name || 'N/A'}`);
  lines.push(`Opzioni: ${opts.length}`);
  for (const opt of opts) {
    lines.push(`  - ${opt.label}: €${opt.summary?.totalGross?.toFixed(2) || '0'} (${opt.items.length} voci)`);
  }
  lines.push(`Totale: €${quote.globalTotals?.totalGross?.toFixed(2) || '0'}`);
  lines.push(`Stato: ${quote.status}`);
  lines.push(`Valido fino al: ${quote.validUntil || 'N/A'}`);
  return { quote, changes: lines.join('\n') };
}

export function enhanceDescriptionsPrompt(quote: PremiumQuote): { quote: PremiumQuote; changes: string } {
  const optCount = quote.options.length;
  const itemCount = quote.options.reduce((s, o) => s + o.items.length, 0);
  return {
    quote,
    changes: `Riscrivi tutte le descrizioni delle ${optCount} opzioni e delle ${itemCount} voci di costo in modo più professionale e persuasivo. Mantieni i dati numerici invariati. Usa un tono formale ma accessibile.`,
  };
}

export function translateQuotePrompt(quote: PremiumQuote, targetLang: string): { quote: PremiumQuote; changes: string } {
  const langNames: Record<string, string> = { en: 'inglese', es: 'spagnolo', fr: 'francese', de: 'tedesco', pt: 'portoghese' };
  return {
    quote,
    changes: `Traduci l'intero preventivo in ${langNames[targetLang] || targetLang}: titolo, descrizioni, clausole, note. Mantieni i numeri, le date e i nomi propri invariati.`,
  };
}

export type ToolName =
  | 'recalculate_totals'
  | 'apply_discount'
  | 'adjust_margin'
  | 'duplicate_option'
  | 'split_quote'
  | 'merge_options'
  | 'validate_quote'
  | 'reorder_options'
  | 'remove_empty_items'
  | 'merge_duplicate_items'
  | 'round_prices'
  | 'calculate_annual'
  | 'check_consistency'
  | 'generate_summary';

export interface ToolCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

export function executeTool(toolName: ToolName, args: Record<string, unknown>, quote: PremiumQuote): ToolResult {
  switch (toolName) {
    case 'recalculate_totals':
      return recalculateTotals(quote);
    case 'apply_discount':
      return applyDiscount(quote, args as unknown as ApplyDiscountArgs);
    case 'adjust_margin':
      return adjustMargin(quote, args.targetMargin as number);
    case 'duplicate_option':
      return duplicateOption(quote, args.optionId as string);
    case 'split_quote':
      return splitQuoteByOption(quote, args.optionIds as string[]);
    case 'merge_options':
      return mergeOptions(quote, args.optionIds as string[]);
    case 'validate_quote':
      return validateQuoteTool(quote);
    case 'reorder_options':
      return reorderOptions(quote, (args.sortBy as any) || 'price_asc');
    case 'remove_empty_items':
      return removeEmptyItems(quote);
    case 'merge_duplicate_items':
      return mergeDuplicateItems(quote);
    case 'round_prices':
      return roundPrices(quote, (args.nearest as number) || 5);
    case 'calculate_annual':
      return calculateAnnualCost(quote);
    case 'check_consistency':
      return checkConsistency(quote);
    case 'generate_summary':
      return generateSummary(quote);
    default:
      return { quote, changes: `Tool sconosciuto: ${toolName}. Nessuna modifica effettuata.` };
  }
}
