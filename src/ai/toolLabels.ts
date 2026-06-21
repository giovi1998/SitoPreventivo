/**
 * Italian user-friendly labels for AI tool calls.
 * Hides technical tool names from the user.
 */

export const TOOL_LABELS: Record<string, string> = {
  apply_discount: 'Applica sconto',
  adjust_margin: 'Ricalcola margine',
  duplicate_option: 'Duplica opzione',
  recalculate_totals: 'Ricalcola totali',
  reorder_options: 'Riordina opzioni',
  remove_empty_items: 'Rimuovi voci vuote',
  merge_duplicate_items: 'Unisci voci duplicate',
  round_prices: 'Arrotonda prezzi',
  calculate_annual_cost: 'Calcola costo annuale',
  check_consistency: 'Verifica coerenza',
  validate_quote: 'Valida preventivo',
};

function pct(v: unknown): string {
  if (typeof v !== 'number' || !isFinite(v)) return '';
  return `${v}%`;
}

function eur(v: unknown): string {
  if (typeof v !== 'number' || !isFinite(v)) return '';
  return `${v}€`;
}

function scopeLabel(scope: unknown, targetId: unknown): string {
  if (scope === 'all') return 'su tutte le opzioni';
  if (scope === 'option') return `sull'opzione ${targetId || ''}`.trim();
  if (scope === 'item') return `sulla voce ${targetId || ''}`.trim();
  return '';
}

function sortLabel(s: unknown): string {
  if (s === 'price_asc') return 'prezzo crescente';
  if (s === 'price_desc') return 'prezzo decrescente';
  if (s === 'name') return 'nome';
  return String(s ?? '');
}

export function formatToolCall(name: string, args: Record<string, unknown> = {}): string {
  switch (name) {
    case 'apply_discount': {
      const t = args.type === 'percentage' ? pct(args.value) : eur(args.value);
      const scope = scopeLabel(args.scope, args.targetId);
      return `Sconto ${t}${scope ? ' ' + scope : ''}`.trim();
    }
    case 'adjust_margin': {
      const m = pct(args.targetMarginPercent);
      return `Ricalcolo margine target ${m}`.trim();
    }
    case 'duplicate_option': {
      return `Duplica opzione ${args.optionId ?? ''}`.trim();
    }
    case 'recalculate_totals': {
      return 'Ricalcolo totali';
    }
    case 'reorder_options': {
      return `Riordino opzioni per ${sortLabel(args.sortBy)}`.trim();
    }
    case 'remove_empty_items': {
      return 'Rimozione voci vuote';
    }
    case 'merge_duplicate_items': {
      return 'Unione voci duplicate';
    }
    case 'round_prices': {
      const n = eur(args.nearest);
      return `Arrotondamento prezzi a ${n}`.trim();
    }
    case 'calculate_annual_cost': {
      return 'Calcolo costo annuale';
    }
    case 'check_consistency': {
      return 'Verifica coerenza';
    }
    case 'validate_quote': {
      return 'Validazione preventivo';
    }
    default: {
      return name;
    }
  }
}

export function formatToolResult(result: string | undefined, name: string): string {
  if (!result) return 'OK';
  const trimmed = result.trim();
  if (!trimmed || trimmed === 'OK') return 'OK';
  if (/modif/i.test(trimmed)) return trimmed;
  if (/rimuov|elimin/i.test(trimmed)) return trimmed;
  return `${trimmed} (${name})`;
}
