import { z } from 'zod';

export const DiscountType = z.enum(['percentage', 'absolute', 'none']);
export type DiscountType = z.infer<typeof DiscountType>;

export const TaxType = z.enum(['vat']);
export type TaxType = z.infer<typeof TaxType>;

export const SelectionType = z.enum(['single', 'multi']);
export type SelectionType = z.infer<typeof SelectionType>;

export const ItemCategory = z.enum(['service', 'product', 'fee', 'discount', 'other']);
export type ItemCategory = z.infer<typeof ItemCategory>;

export const ItemUnit = z.enum(['hour', 'day', 'piece', 'package', 'fixed', 'month']);
export type ItemUnit = z.infer<typeof ItemUnit>;

export const QuoteStatus = z.enum(['draft', 'sent', 'accepted', 'rejected', 'archived']);
export type QuoteStatus = z.infer<typeof QuoteStatus>;

export const ImportSourceType = z.enum(['pdf', 'manual', 'api']);
export type ImportSourceType = z.infer<typeof ImportSourceType>;

export const ParserType = z.enum(['pdfjs', 'docling', 'other']);
export type ParserType = z.infer<typeof ParserType>;

export const AttachmentType = z.enum(['technical', 'commercial', 'legal', 'other']);
export type AttachmentType = z.infer<typeof AttachmentType>;

export const DocumentTemplateId = z.enum(['minimal', 'corporate', 'creative']);
export type DocumentTemplateId = z.infer<typeof DocumentTemplateId>;

const discountSchema = z.object({
  type: DiscountType,
  value: z.number().min(0),
});

const taxSchema = z.object({
  type: TaxType,
  rate: z.number().min(0).max(100),
});

const itemTotalSchema = z.object({
  net: z.number().min(0),
  tax: z.number().min(0),
  gross: z.number().min(0),
});

const itemMetadataSchema = z.object({
  sourcePage: z.number().int().positive().optional(),
  sourceLine: z.number().int().positive().optional(),
});

const itemSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  description: z.string().default(''),
  category: ItemCategory,
  unit: ItemUnit,
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: discountSchema,
  tax: taxSchema,
  total: itemTotalSchema,
  metadata: itemMetadataSchema.optional(),
});
export type QuoteItem = z.infer<typeof itemSchema>;

const optionSummarySchema = z.object({
  subtotalNet: z.number().min(0),
  discountsTotal: z.number().min(0),
  taxTotal: z.number().min(0),
  totalNet: z.number().min(0),
  totalGross: z.number().min(0),
});

const optionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  description: z.string().default(''),
  isDefault: z.boolean().default(false),
  selectionType: SelectionType,
  items: z.array(itemSchema),
  summary: optionSummarySchema,
});
export type QuoteOption = z.infer<typeof optionSchema>;

const issuerSchema = z.object({
  name: z.string().default(''),
  vatNumber: z.string().nullable().default(null),
  taxCode: z.string().nullable().default(null),
  address: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  website: z.string().nullable().default(null),
  logoUrl: z.string().nullable().default(null),
});

const clientSchema = z.object({
  name: z.string().default(''),
  contactPerson: z.string().nullable().default(null),
  address: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  vatNumber: z.string().nullable().default(null),
  taxCode: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

const projectSchema = z.object({
  title: z.string().default(''),
  code: z.string().default(''),
  description: z.string().default(''),
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
});

const importSourceSchema = z.object({
  type: ImportSourceType,
  fileName: z.string().nullable().default(null),
  pages: z.array(z.number().int().positive()).default([]),
  parsedAt: z.string().nullable().default(null),
  parser: ParserType,
  confidence: z.number().min(0).max(1).default(0),
});

const paymentScheduleItemSchema = z.object({
  label: z.string(),
  dueDaysFromIssue: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
  notes: z.string().default(''),
});

const paymentTermsSchema = z.object({
  paymentMethod: z.string().default(''),
  paymentSchedule: z.array(paymentScheduleItemSchema).default([]),
  latePaymentInterest: z.string().default(''),
  iban: z.string().nullable().default(null),
  bic: z.string().nullable().default(null),
});

const legalClauseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string().min(1),
  language: z.string().default('it'),
});

const attachmentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  url: z.string(),
  description: z.string().default(''),
  type: AttachmentType,
});

const notesSchema = z.object({
  internal: z.string().default(''),
  clientVisible: z.string().default(''),
});

const uiPreferencesSchema = z.object({
  templateId: DocumentTemplateId,
  accentColor: z.string().default('#01696F'),
  fontFamily: z.string().default('Inter'),
  showLogo: z.boolean().default(true),
  showTotalsPerOption: z.boolean().default(true),
  showGlobalTotals: z.boolean().default(true),
});

const globalTotalsSchema = z.object({
  currency: z.string().default('EUR'),
  subtotalNet: z.number().min(0),
  optionsSelected: z.array(z.string()).default([]),
  discountsTotal: z.number().min(0),
  taxTotal: z.number().min(0),
  totalNet: z.number().min(0),
  totalGross: z.number().min(0),
  roundingAdjustment: z.number().default(0),
});

export const quoteSchema = z.object({
  version: z.string().default('1.0'),
  quoteId: z.string(),
  status: QuoteStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
  validUntil: z.string(),
  currency: z.string().default('EUR'),
  locale: z.string().default('it-IT'),
  issuer: issuerSchema,
  client: clientSchema,
  project: projectSchema,
  importSource: importSourceSchema.optional(),
  options: z.array(optionSchema),
  globalTotals: globalTotalsSchema,
  paymentTerms: paymentTermsSchema,
  legalClauses: z.array(legalClauseSchema).default([]),
  notes: notesSchema,
  attachments: z.array(attachmentSchema).default([]),
  uiPreferences: uiPreferencesSchema,
});

export type PremiumQuote = z.infer<typeof quoteSchema>;

function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function calculateItemTotal(
  quantity: number,
  unitPrice: number,
  discountType: DiscountType,
  discountValue: number,
  taxRate: number
): { net: number; tax: number; gross: number } {
  const grossPrice = quantity * unitPrice;
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = grossPrice * (discountValue / 100);
  } else if (discountType === 'absolute') {
    discountAmount = Math.min(discountValue, grossPrice);
  }
  const net = Math.round((grossPrice - discountAmount) * 100) / 100;
  const tax = Math.round(net * (taxRate / 100) * 100) / 100;
  const gross = Math.round((net + tax) * 100) / 100;
  return { net, tax, gross };
}

export function calculateOptionSummary(items: QuoteItem[]): {
  subtotalNet: number;
  discountsTotal: number;
  taxTotal: number;
  totalNet: number;
  totalGross: number;
} {
  const subtotalNet = items.reduce((s, i) => s + i.total.net, 0);
  const discountsTotal = items.reduce((s, i) => {
    const gross = i.quantity * i.unitPrice;
    if (i.discount.type === 'percentage') {
      return s + gross * (i.discount.value / 100);
    }
    if (i.discount.type === 'absolute') {
      return s + i.discount.value;
    }
    return s;
  }, 0);
  const taxTotal = items.reduce((s, i) => s + i.total.tax, 0);
  const totalNet = items.reduce((s, i) => s + i.total.net, 0);
  const totalGross = items.reduce((s, i) => s + i.total.gross, 0);
  return { subtotalNet, discountsTotal, taxTotal, totalNet, totalGross };
}

export function calculateGlobalTotals(options: QuoteOption[], selectedOptionIds: string[]): z.infer<typeof globalTotalsSchema> {
  const selected = options.filter((o) => selectedOptionIds.includes(o.id));
  const subtotalNet = selected.reduce((s, o) => s + o.summary.subtotalNet, 0);
  const discountsTotal = selected.reduce((s, o) => s + o.summary.discountsTotal, 0);
  const taxTotal = selected.reduce((s, o) => s + o.summary.taxTotal, 0);
  const totalNet = selected.reduce((s, o) => s + o.summary.totalNet, 0);
  const totalGross = selected.reduce((s, o) => s + o.summary.totalGross, 0);
  return {
    currency: 'EUR',
    subtotalNet,
    optionsSelected: selectedOptionIds,
    discountsTotal,
    taxTotal,
    totalNet,
    totalGross,
    roundingAdjustment: 0,
  };
}

export function recalculateQuote(quote: PremiumQuote): PremiumQuote {
  const options = quote.options.map((opt) => {
    const items = opt.items.map((item) => ({
      ...item,
      total: calculateItemTotal(
        item.quantity,
        item.unitPrice,
        item.discount.type,
        item.discount.value,
        item.tax.rate
      ),
    }));
    return {
      ...opt,
      items,
      summary: calculateOptionSummary(items),
    };
  });
  const globalTotals = calculateGlobalTotals(options, quote.globalTotals.optionsSelected);
  return { ...quote, options, globalTotals, updatedAt: new Date().toISOString() };
}

export function createEmptyQuote(overrides?: Partial<PremiumQuote>): PremiumQuote {
  const now = new Date().toISOString();
  const base: PremiumQuote = {
    version: '1.0',
    quoteId: generateId('quote'),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: 'EUR',
    locale: 'it-IT',
    issuer: {
      name: '',
      vatNumber: null,
      taxCode: null,
      address: '',
      email: '',
      phone: '',
      website: null,
      logoUrl: null,
    },
    client: {
      name: '',
      contactPerson: null,
      address: '',
      email: '',
      phone: '',
      vatNumber: null,
      taxCode: null,
      notes: null,
    },
    project: {
      title: '',
      code: '',
      description: '',
      startDate: null,
      endDate: null,
    },
    options: [],
    globalTotals: {
      currency: 'EUR',
      subtotalNet: 0,
      optionsSelected: [],
      discountsTotal: 0,
      taxTotal: 0,
      totalNet: 0,
      totalGross: 0,
      roundingAdjustment: 0,
    },
    paymentTerms: {
      paymentMethod: '',
      paymentSchedule: [],
      latePaymentInterest: '',
      iban: null,
      bic: null,
    },
    legalClauses: [],
    notes: {
      internal: '',
      clientVisible: '',
    },
    attachments: [],
    uiPreferences: {
      templateId: 'corporate',
      accentColor: '#01696F',
      fontFamily: 'Inter',
      showLogo: true,
      showTotalsPerOption: true,
      showGlobalTotals: true,
    },
  };
  return { ...base, ...overrides };
}

export function addEmptyOption(quote: PremiumQuote): PremiumQuote {
  const opt: QuoteOption = {
    id: generateId('opt'),
    label: 'Nuova opzione',
    description: '',
    isDefault: quote.options.length === 0,
    selectionType: 'single',
    items: [],
    summary: { subtotalNet: 0, discountsTotal: 0, taxTotal: 0, totalNet: 0, totalGross: 0 },
  };
  return recalculateQuote({ ...quote, options: [...quote.options, opt] });
}

export function addEmptyItem(quote: PremiumQuote, optionId: string): PremiumQuote {
  const options = quote.options.map((opt) => {
    if (opt.id !== optionId) return opt;
    const item: QuoteItem = {
      id: generateId('item'),
      label: 'Nuova riga',
      description: '',
      category: 'service',
      unit: 'hour',
      quantity: 1,
      unitPrice: 0,
      discount: { type: 'none', value: 0 },
      tax: { type: 'vat', rate: 22 },
      total: { net: 0, tax: 0, gross: 0 },
    };
    return { ...opt, items: [...opt.items, item] };
  });
  return recalculateQuote({ ...quote, options });
}

interface LegacyOption {
  id: string;
  title: string;
  description: string;
  oneTimeCost?: number;
  monthlyCost?: number;
  includesMaintenance?: boolean;
}

interface LegacyClause {
  id: string;
  title: string;
  body: string;
}

interface LegacyQuote {
  id?: string;
  title?: string;
  client?: string;
  contact?: string;
  status?: string;
  date?: string;
  owner?: string;
  intro?: string;
  note?: string;
  vat?: number;
  color?: string;
  options?: LegacyOption[];
  clauses?: LegacyClause[];
  isTemplate?: boolean;
  isGlobal?: boolean;
  profession?: string;
  _premium?: Record<string, unknown>;
}

function mapLegacyStatus(s: string): QuoteStatus {
  const map: Record<string, QuoteStatus> = {
    'bozza': 'draft',
    'inviato': 'sent',
    'accettato': 'accepted',
    'rifiutato': 'rejected',
    'archiviato': 'archived',
  };
  return map[s.toLowerCase()] || 'draft';
}

export function migrateFromLegacy(legacy: LegacyQuote): PremiumQuote {
  if (legacy._premium) {
    try { return legacy._premium as unknown as PremiumQuote; }
    catch { /* fall through to legacy migration */ }
  }

  const now = new Date().toISOString();
  const vatRate = legacy.vat ?? 22;

  const options: QuoteOption[] = (legacy.options || []).map((opt, i) => {
    const items: QuoteItem[] = [];
    if (opt.oneTimeCost && opt.oneTimeCost > 0) {
      items.push({
        id: generateId('item'),
        label: 'Sviluppo / Costo una tantum',
        description: opt.description || '',
        category: 'service',
        unit: 'fixed',
        quantity: 1,
        unitPrice: opt.oneTimeCost,
        discount: { type: 'none', value: 0 },
        tax: { type: 'vat', rate: vatRate },
        total: calculateItemTotal(1, opt.oneTimeCost, 'none', 0, vatRate),
      });
    }
    if (opt.monthlyCost && opt.monthlyCost > 0) {
      items.push({
        id: generateId('item'),
        label: opt.includesMaintenance ? 'Manutenzione mensile' : 'Canone mensile',
        description: opt.includesMaintenance ? 'Manutenzione e hosting inclusi' : '',
        category: 'service',
        unit: 'month',
        quantity: 12,
        unitPrice: opt.monthlyCost,
        discount: { type: 'none', value: 0 },
        tax: { type: 'vat', rate: vatRate },
        total: calculateItemTotal(12, opt.monthlyCost, 'none', 0, vatRate),
      });
    }
    if (items.length === 0) {
      items.push({
        id: generateId('item'),
        label: 'Voce',
        description: '',
        category: 'service',
        unit: 'fixed',
        quantity: 1,
        unitPrice: 0,
        discount: { type: 'none', value: 0 },
        tax: { type: 'vat', rate: vatRate },
        total: { net: 0, tax: 0, gross: 0 },
      });
    }
    const summary = calculateOptionSummary(items);
    return {
      id: String(opt.id ?? '') || generateId('opt'),
      label: opt.title || `Opzione ${i + 1}`,
      description: opt.description || '',
      isDefault: i === 0,
      selectionType: 'single',
      items,
      summary,
    };
  });

  const globalTotals = calculateGlobalTotals(options, options.filter((o) => o.isDefault).map((o) => o.id));

  const legalClauses: PremiumQuote['legalClauses'] = (legacy.clauses || []).map((c) => ({
    id: c.id || generateId('clause'),
    title: c.title,
    body: c.body,
    language: 'it',
  }));

  return {
    version: '0.9',
    quoteId: legacy.id || generateId('quote'),
    status: legacy.status ? mapLegacyStatus(legacy.status) : 'draft',
    createdAt: legacy.date ? new Date(legacy.date).toISOString() : now,
    updatedAt: now,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: 'EUR',
    locale: 'it-IT',
    issuer: {
      name: legacy.owner || '',
      vatNumber: null,
      taxCode: null,
      address: '',
      email: '',
      phone: '',
      website: null,
      logoUrl: null,
    },
    client: {
      name: legacy.client || '',
      contactPerson: legacy.contact || null,
      address: '',
      email: '',
      phone: '',
      vatNumber: null,
      taxCode: null,
      notes: null,
    },
    project: {
      title: legacy.title || '',
      code: '',
      description: legacy.intro || '',
      startDate: null,
      endDate: null,
    },
    options,
    globalTotals,
    paymentTerms: {
      paymentMethod: 'bonifico bancario',
      paymentSchedule: [
        { label: 'Acconto', dueDaysFromIssue: 7, percentage: 50, notes: '' },
        { label: 'Saldo', dueDaysFromIssue: 30, percentage: 50, notes: '' },
      ],
      latePaymentInterest: '',
      iban: null,
      bic: null,
    },
    legalClauses,
    notes: {
      internal: legacy.note || '',
      clientVisible: '',
    },
    attachments: [],
    uiPreferences: {
      templateId: 'corporate',
      accentColor: legacy.color || '#01696F',
      fontFamily: 'Inter',
      showLogo: false,
      showTotalsPerOption: true,
      showGlobalTotals: true,
    },
  };
}

export function validateQuote(data: unknown) {
  return quoteSchema.safeParse(data);
}

export function toLegacyFormat(quote: PremiumQuote): LegacyQuote {
  return {
    id: quote.quoteId,
    title: quote.project.title,
    client: quote.client.name,
    contact: quote.client.contactPerson || undefined,
    status: quote.status.charAt(0).toUpperCase() + quote.status.slice(1),
    date: quote.createdAt.slice(0, 10),
    owner: quote.issuer.name,
    intro: quote.project.description,
    note: quote.notes.internal,
    vat: quote.options[0]?.items[0]?.tax.rate ?? 22,
    color: quote.uiPreferences.accentColor,
    options: quote.options.map((opt) => ({
      id: opt.id,
      title: opt.label,
      description: opt.description,
      oneTimeCost: opt.items.find((i) => i.unit === 'fixed')?.unitPrice,
      monthlyCost: opt.items.find((i) => i.unit === 'month')?.unitPrice,
      includesMaintenance: opt.items.some((i) => i.label.toLowerCase().includes('manutenzione')),
    })),
    clauses: quote.legalClauses.map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
    })),
    isGlobal: (quote as any).isGlobal,
    profession: (quote as any).profession,
    _premium: quote as unknown as Record<string, unknown>,
  };
}
