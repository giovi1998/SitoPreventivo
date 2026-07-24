import { z } from 'zod';
import {
  DiscountType,
  TaxType,
  ItemCategory,
  ItemUnit,
  SelectionType,
  QuoteStatus,
  DocumentTemplateId,
} from '../utils/quoteSchema';

const aiDiscountSchema = z.object({
  type: DiscountType,
  value: z.number().min(0),
}).optional();

const aiTaxSchema = z.object({
  type: TaxType,
  rate: z.number().min(0).max(100),
}).optional();

const aiItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  description: z.string().optional(),
  category: ItemCategory.optional(),
  unit: ItemUnit.optional(),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().min(0).optional(),
  discount: aiDiscountSchema,
  tax: aiTaxSchema,
});

const aiOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  selectionType: SelectionType.optional(),
  items: z.array(aiItemSchema).optional(),
});

const aiProjectSchema = z.object({
  title: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

const aiClientSchema = z.object({
  name: z.string().optional(),
  contactPerson: z.string().nullable().optional(),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  vatNumber: z.string().nullable().optional(),
  taxCode: z.string().nullable().optional(),
});

const aiIssuerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  vatNumber: z.string().nullable().optional(),
  taxCode: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
});

const aiLegalClauseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  language: z.string().optional(),
}).refine(
  (data) => data.body !== undefined || data.content !== undefined,
  { message: 'legalClause deve avere almeno "body" o "content"' }
);

const aiPaymentTermsSchema = z.object({
  paymentMethod: z.string().optional(),
  method: z.string().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  latePaymentInterest: z.string().optional(),
  deposit: z.number().min(0).max(100).optional(),
  dueDays: z.number().int().positive().optional(),
  notes: z.string().optional(),
  paymentSchedule: z.array(z.object({
    label: z.string(),
    dueDaysFromIssue: z.number().int().positive(),
    percentage: z.number().min(0).max(100),
    notes: z.string().optional(),
  })).optional(),
});

const aiUiPreferencesSchema = z.object({
  templateId: DocumentTemplateId.optional(),
  accentColor: z.string().optional(),
  fontFamily: z.string().optional(),
  showLogo: z.boolean().optional(),
  showTotalsPerOption: z.boolean().optional(),
  showGlobalTotals: z.boolean().optional(),
  logoUrl: z.string().optional(),
});

const aiNotesSchema = z.union([
  z.string(),
  z.object({
    internal: z.string().optional(),
    clientVisible: z.string().optional(),
  }),
]);

export const aiInputQuoteSchema = z.object({
  version: z.string().optional(),
  quoteId: z.string().optional(),
  status: QuoteStatus.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  validUntil: z.string().optional(),
  currency: z.string().optional(),
  locale: z.string().optional(),
  issuer: aiIssuerSchema.optional(),
  client: aiClientSchema.optional(),
  project: aiProjectSchema.optional(),
  options: z.array(aiOptionSchema).optional(),
  paymentTerms: aiPaymentTermsSchema.optional(),
  legalClauses: z.array(aiLegalClauseSchema).optional(),
  notes: aiNotesSchema.optional(),
  uiPreferences: aiUiPreferencesSchema.optional(),
});
