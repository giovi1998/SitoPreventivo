import { z } from 'zod';
import { aiStatsSchema } from '../aiStats';

export const websiteStyleSchema = z.enum(['modern', 'minimal', 'corporate', 'creative', 'brutalist']);
export type WebsiteStyle = z.infer<typeof websiteStyleSchema>;

export const websiteBriefSchema = z.object({
  businessName: z.string().min(1, 'Nome attività richiesto').max(100),
  sector: z.string().max(50).default(''),
  description: z.string().min(1, 'Descrizione richiesta').max(1000),
  tone: z.string().max(50).default(''),
  target: z.string().max(200).default(''),
  pages: z.string().max(300).default('index'),
  preferredColors: z.string().max(200).default(''),
  font: z.string().max(50).default(''),
  cta: z.string().max(100).default(''),
  sections: z.string().max(300).default('hero, chi_siamo, contatti'),
  features: z.string().max(300).default(''),
  contacts: z.string().max(300).default(''),
  social: z.string().max(300).default(''),
  notes: z.string().max(500).default(''),
});
export type WebsiteBrief = z.infer<typeof websiteBriefSchema>;

export const websiteSchema = z.object({
  documentType: z.literal('website'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  customerId: z.string().optional(),
  title: z.string().default(''),
  brief: websiteBriefSchema.default({
    businessName: '',
    sector: '',
    description: '',
    tone: '',
    target: '',
    pages: 'index',
    preferredColors: '',
    font: '',
    cta: '',
    sections: 'hero, chi_siamo, contatti',
    features: '',
    contacts: '',
    social: '',
    notes: '',
  }),
  briefContext: z.string().optional(),
  logoUrl: z.string().nullable().default(null),
  images: z.array(z.string()).default([]),
  html: z.string().default(''),
  css: z.string().default(''),
  js: z.string().default(''),
  framework: z.literal('vanilla').default('vanilla'),
  style: websiteStyleSchema.default('modern'),
  pages: z.array(z.string()).default(['index']),
  source: z.enum(['ai', 'manual']).default('ai'),
  aiStats: aiStatsSchema.optional(),
  autoGeneratePending: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Website = z.infer<typeof websiteSchema>;

const BRIEF_DEFAULTS: WebsiteBrief = {
  businessName: '',
  sector: '',
  description: '',
  tone: '',
  target: '',
  pages: 'index',
  preferredColors: '',
  font: '',
  cta: '',
  sections: 'hero, chi_siamo, contatti',
  features: '',
  contacts: '',
  social: '',
  notes: '',
};

export function createEmptyWebsite(): Website {
  const now = new Date().toISOString();
  return {
    documentType: 'website',
    id: `website_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    brief: { ...BRIEF_DEFAULTS },
    logoUrl: null,
    images: [],
    html: '',
    css: '',
    js: '',
    framework: 'vanilla',
    style: 'modern',
    pages: ['index'],
    source: 'ai',
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeWebsiteWithDefaults(input: Partial<Website> | null | undefined): Website {
  const base = createEmptyWebsite();
  if (!input) return base;
  return {
    ...base,
    ...input,
    brief: { ...BRIEF_DEFAULTS, ...(input.brief || {}) },
  };
}
