// Zod schemas validazione body (split da handler.ts).
import { z } from 'zod';
export const passwordSchema = z.string()
  .min(12, 'Password: minimo 12 caratteri')
  .max(100)
  .regex(/[A-Z]/, 'Password: deve contenere una maiuscola')
  .regex(/[a-z]/, 'Password: deve contenere una minuscola')
  .regex(/[0-9]/, 'Password: deve contenere un numero')
  .regex(/[^A-Za-z0-9]/, 'Password: deve contenere un carattere speciale');

export const RegisterSchema = z.object({
  email: z.string().email('Email non valida'),
  password: passwordSchema,
  username: z.string().min(2, 'Username: minimo 2 caratteri').max(50),
  gender: z.string().optional(),
  role: z.string().optional(),
  tokenLimit: z.number().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

export const ChangePasswordSchema = z.object({
  email: z.string().email('Email non valida'),
  oldPassword: z.string().min(1, 'Vecchia password richiesta'),
  newPassword: passwordSchema,
});

export const TokenLimitSchema = z.object({
  email: z.string().email('Email non valida'),
  tokenLimit: z.number().positive('tokenLimit deve essere positivo'),
});

export const TrackTokensSchema = z.object({
  email: z.string().email('Email non valida'),
  tokens: z.number().positive('tokens deve essere positivo'),
  // TB-023: costo USD opzionale (backward compatible)
  costUsd: z.number().min(0).optional(),
});

export const RedeemCodeSchema = z.object({
  email: z.string().email('Email non valida'),
  code: z.string().min(1, 'Codice richiesto').max(50),
});

export const DocumentCountSchema = z.object({
  email: z.string().email('Email non valida'),
  delta: z.number().int().min(-100).max(100).optional().default(1),
});

export const GenerateCodeSchema = z.object({
  adminEmail: z.string().email('Email non valida'),
  package: z.enum(['starter', 'apertura', 'presenza', 'custom']),
});

export const UnlockUserSchema = z.object({
  adminEmail: z.string().email('Email non valida'),
  userEmail: z.string().email('Email utente non valida'),
});

export const QuoteBodySchema = z.object({
  email: z.string().email('Email non valida'),
  quote: z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    client: z.string().optional(),
    date: z.string().optional(),
    intro: z.string().optional(),
    color: z.string().optional(),
    vat: z.number().optional(),
    status: z.string().optional(),
    owner: z.string().optional(),
    options: z.array(z.any()).optional(),
    clauses: z.array(z.any()).optional(),
    isTemplate: z.boolean().optional(),
    pdfUrl: z.string().optional(),
    documentTheme: z.string().optional(),
  }),
});

export const qrPayloadDataSchema = z.object({
  type: z.enum(['url', 'text', 'email', 'phone', 'vcard', 'wifi', 'sms']),
  payload: z.string(),
});

export const qrStyleDataSchema = z.object({
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).optional(),
  fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  size: z.number().min(128).max(2048).optional(),
  margin: z.number().min(0).max(16).optional(),
  logoOverlay: z.string().nullable().optional(),
  dotStyle: z.enum(['square', 'rounded', 'dots']).optional(),
});

export const qrDocumentSchema = z.object({
  id: z.string().min(1),
  documentType: z.literal('qrCode'),
  title: z.string().default(''),
  data: qrPayloadDataSchema,
  style: qrStyleDataSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Business card / logo / flyer payloads are stored opaquely as
// jsonb. We validate the discriminated key + id + title at the
// boundary and trust the schema on the client (documentSchemas.ts)
// for the deep shape. This keeps the API surface small and avoids
// duplicating the Zod tree for nested card/grid style fields.
// .passthrough() keeps flat client fields (builder/front/content) so
// extractDocumentData can nest them under jsonb `data` if `data` is
// missing. Without passthrough Zod strips unknown keys → data:null in prod.
export const genericDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().default(''),
  data: z.any().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();
export const businessCardDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('businessCard'),
});
export const logoDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('logo'),
});
// Phase 3: flyer schema is now live. Same opaque-jsonb treatment as
// the card / logo handlers.
export const flyerDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('flyer'),
});

export const generatedImageDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('generatedImage'),
});

// TB-028: website builder — stesso trattamento opaque-jsonb (data contiene
// html/css/js/brief/pagesHtml). Senza questo, ogni save website → 400
// "Invalid discriminator value" (regressione 2026-08-13 prod).
export const websiteDocumentSchema = genericDocumentSchema.extend({
  documentType: z.literal('website'),
});

export const DocumentBodySchema = z.object({
  email: z.string().email('Email non valida'),
  document: z.discriminatedUnion('documentType', [
    qrDocumentSchema,
    businessCardDocumentSchema,
    logoDocumentSchema,
    flyerDocumentSchema,
    generatedImageDocumentSchema,   // <-- ADD THIS
    websiteDocumentSchema,
  ]),
});

export const UserSettingsSchema = z.object({
  email: z.string().email('Email non valida'),
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  profession: z.string().optional(),
  defaultColor: z.string().optional(),
  defaultVat: z.number().optional(),
  logoUrl: z.string().optional(),
  onboardingDone: z.boolean().optional(),
  documentTheme: z.string().optional(),
  // Phase 7, onboarding step 5 preference. Optional, no transform.
  // Accepts one of: 'editor' | 'qr' | 'card' | 'flyer' | 'logo'. Other
  // values are rejected by the regex to keep the column clean.
  // Phase 3 added 'flyer' to the allowlist.
  preferredDocumentType: z
    .string()
    .regex(/^(editor|qr|card|flyer|logo)$/, 'Tipo documento non valido')
    .optional(),
});

export const MAX_LOG_MSG = 2000;
export const VALID_CUSTOMER_STATUS = new Set(['new', 'researching', 'researched', 'building', 'done', 'rejected']);
export const VALID_CUSTOMER_SOURCES = new Set(['manual', 'intake']);

export const CustomerSocialSchema = z.object({
  platform: z.string().max(50).default(''),
  url: z.string().max(300).default(''),
});

export const CreateCustomerSchema = z.object({
  adminEmail: z.string().email(),
  businessName: z.string().min(1).max(255),
  ownerName: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  activity: z.string().optional(),
  mood: z.string().max(1000).optional(),
  target: z.string().optional(),
  preferredColors: z.string().optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  socials: z.array(CustomerSocialSchema).optional(),
  font: z.string().max(50).optional(),
  package: z.string().max(50).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().max(255).optional(),
  googleMapsUrl: z.string().max(500).optional(),
});

export const UpdateCustomerSchema = z.object({
  adminEmail: z.string().email(),
  businessName: z.string().min(1).max(255).optional(),
  ownerName: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  activity: z.string().optional(),
  mood: z.string().max(1000).optional(),
  target: z.string().optional(),
  preferredColors: z.string().optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  socials: z.array(CustomerSocialSchema).optional(),
  font: z.string().max(50).optional(),
  package: z.string().max(50).optional(),
  status: z.string().max(30).optional(),
  logoUrl: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().max(255).optional(),
  googleMapsUrl: z.string().max(500).optional(),
  // TB-029 fase 3: A/B testing prompt per cliente {promptName: label}
  promptLabels: z.record(z.string(), z.string().min(1).max(50)).optional(),
  // TB-030 guard anti-loop: true = il PATCH viene dal sync (website→customer),
  // non ri-triggerare il sync customer→website. Mai persistito.
  skipSync: z.boolean().optional(),
});

export const AutoBuildSchema = z.object({
  adminEmail: z.string().email(),
  autoGenerate: z.boolean().optional(),
});

export const IntakeSchema = z.object({
  businessName: z.string().min(1).max(255),
  ownerName: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  activity: z.string().optional(),
  mood: z.string().max(1000).optional(),
  target: z.string().optional(),
  preferredColors: z.string().optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  webAnswers: z.record(z.string(), z.unknown()).optional(),
  package: z.string().max(50).optional(),
  sourceRef: z.string().max(100).optional(),
});

export const VALID_INTAKE_STATUS = new Set(['new', 'in_progress', 'done', 'rejected']);

