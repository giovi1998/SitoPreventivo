import type { PremiumQuote, QuoteOption } from '../../utils/quoteSchema';

type CompactOption = Pick<QuoteOption, 'id' | 'label' | 'description' | 'isDefault' | 'selectionType'> & {
  items: CompactItem[];
};

type CompactItem = {
  id: string;
  label: string;
  description: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: { type: string; value: number };
  tax: { type: string; rate: number };
};

function compactOptions(options: QuoteOption[]): CompactOption[] {
  return options.map((o) => ({
    id: o.id,
    label: o.label,
    description: o.description,
    isDefault: o.isDefault,
    selectionType: o.selectionType,
    items: o.items.map((i) => ({
      id: i.id,
      label: i.label,
      description: i.description,
      category: i.category,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: { ...i.discount },
      tax: { ...i.tax },
    })),
  }));
}

function detectRelevantFields(prompt: string): Set<string> {
  const lower = prompt.toLowerCase();
  const fields = new Set<string>();

  const rules: [string, string[]][] = [
    ['project', ['titolo', 'title', 'progetto', 'project', 'nome del progetto']],
    ['client', ['cliente', 'client', 'nominativo', 'azienda']],
    ['issuer', ['emittente', 'issuer', 'mittente', 'vostro']],
    ['options', ['opzione', 'option', 'prezzo', 'prezzo', 'costo', 'opzioni']],
    ['legalClauses', ['clausol', 'clause', 'condizioni', 'legale', 'faq']],
    ['paymentTerms', ['pagamento', 'payment', 'iban', 'bic', 'acconto', 'saldo', 'tranche', 'scadenze']],
    ['notes', ['nota', 'note', 'interno']],
    ['uiPreferences', ['colore', 'color', 'tema', 'theme', 'font', 'template']],
    ['status', ['stato', 'status', 'bozza', 'inviato']],
    ['validUntil', ['valido', 'scadenza', 'valid']],
  ];

  for (const [field, keywords] of rules) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        fields.add(field);
        break;
      }
    }
  }

  if (lower.includes('sconto') || lower.includes('margine') || lower.includes('arrotonda') ||
      lower.includes('ricalcola') || lower.includes('riordina') || lower.includes('duplica') ||
      lower.includes('rimuovi') || lower.includes('unisci') || lower.includes('verifica') ||
      lower.includes('controlla') || lower.includes('annuale')) {
    fields.add('options');
  }

  return fields;
}

export interface AIContext {
  payload: Record<string, unknown>;
  relevantFields: string[];
}

export function buildAIContext(quote: PremiumQuote, userPrompt: string): AIContext {
  const fields = detectRelevantFields(userPrompt);
  const payload: Record<string, unknown> = {};

  if (fields.has('project')) payload.project = quote.project;
  if (fields.has('client')) payload.client = quote.client;
  if (fields.has('issuer')) payload.issuer = quote.issuer;
  if (fields.has('legalClauses')) payload.legalClauses = quote.legalClauses;
  if (fields.has('paymentTerms')) payload.paymentTerms = quote.paymentTerms;
  if (fields.has('notes')) payload.notes = quote.notes;
  if (fields.has('uiPreferences')) payload.uiPreferences = quote.uiPreferences;
  if (fields.has('status')) payload.status = quote.status;
  if (fields.has('validUntil')) payload.validUntil = quote.validUntil;
  payload.currency = quote.currency;
  payload.locale = quote.locale;

  payload.options = compactOptions(quote.options);

  const relevantFields = Array.from(fields).length > 0
    ? Array.from(fields)
    : ['options', 'project', 'client', 'legalClauses', 'paymentTerms', 'uiPreferences', 'notes'];

  return { payload, relevantFields };
}

export function detectToolIntent(prompt: string): string | null {
  const lower = prompt.toLowerCase();

  if (lower.includes('sconto') || lower.includes('discount')) return 'apply_discount';
  if (lower.includes('margine') || lower.includes('margin')) return 'adjust_margin';
  if (lower.includes('duplica') || lower.includes('duplicate') || lower.includes('copia')) return 'duplicate_option';
  if (lower.includes('ricalcola') || lower.includes('recalculate')) return 'recalculate_totals';
  if (lower.includes('riordina') || lower.includes('reorder') || lower.includes('ordina')) return 'reorder_options';
  if (lower.includes('rimuovi') && (lower.includes('vuot') || lower.includes('zero'))) return 'remove_empty_items';
  if (lower.includes('unisci') && (lower.includes('duplicat') || lower.includes('doppie'))) return 'merge_duplicate_items';
  if (lower.includes('arrotonda') || lower.includes('round')) return 'round_prices';
  if (lower.includes('annuale') || lower.includes('annual') || lower.includes('yearly')) return 'calculate_annual_cost';
  if (lower.includes('verific') || lower.includes('consist') || lower.includes('coeren')) return 'check_consistency';
  if (lower.includes('valida') || lower.includes('validat') || lower.includes('controlla')) return 'validate_quote';

  return null;
}
