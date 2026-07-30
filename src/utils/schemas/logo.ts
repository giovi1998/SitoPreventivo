import { z } from 'zod';
import { aiStatsSchema } from '../aiStats';
import { hexColorSchema } from './shared';

export const logoIconTypeSchema = z.enum(['none', 'shape', 'monogram', 'lucide']);
export type LogoIconType = z.infer<typeof logoIconTypeSchema>;

export const logoIconShapeSchema = z.enum(['circle', 'square', 'rounded', 'hex']);
export type LogoIconShape = z.infer<typeof logoIconShapeSchema>;

export const logoLayoutSchema = z.enum(['horizontal', 'vertical', 'stacked']);
export type LogoLayout = z.infer<typeof logoLayoutSchema>;

export const LOGO_SECTORS = ['tech', 'food', 'fashion', 'professionista'] as const;
export type LogoSector = (typeof LOGO_SECTORS)[number];

export const logoDecorativeElementSchema = z.enum(['underline', 'dotRing', 'topAccent']);
export type LogoDecorativeElement = z.infer<typeof logoDecorativeElementSchema>;

export const logoBuilderSchema = z.object({
  primaryText: z.string().max(50).default(''),
  tagline: z.string().max(50).default(''),
  iconType: logoIconTypeSchema.default('none'),
  iconGlyph: z.string().max(20).default(''),
  iconShape: logoIconShapeSchema.default('circle'),
  primaryColor: hexColorSchema.default('#01696F'),
  secondaryColor: hexColorSchema.default('#1a1a2e'),
  fontFamily: z.string().default('Inter'),
  layout: logoLayoutSchema.default('horizontal'),
  icons: z.array(z.string()).default([]),
  // Spec v2.1 (Nano Banana): AI-generated background image (base64 PNG, nullable).
  // Rendered behind the SVG text/icon. Stays optional: a logo without
  // background is transparent SVG like v1.
  backgroundImage: z.string().nullable().default(null),
  // Spec v2.2 (Rich Render): solid brand background behind everything.
  // Mutually exclusive with backgroundImage at the UI level; in SVG the
  // image wins and the solid color is rendered underneath it.
  backgroundColor: z.string().nullable().default(null),
  // Spec v2.2: primaryText fill uses a primary→secondary gradient.
  gradientFill: z.boolean().default(false),
  // Spec v2.2: optional SVG decorative elements (underline, dot ring, top accent).
  decorativeElements: z.array(logoDecorativeElementSchema).default([]),
  // Spec v2.2 (Nano-Banana): reasoning-driven prompt used by Gemini image generation.
  imagePrompt: z.string().max(600).nullable().default(null),
  // Spec v2.3 (Text controls): readability + positioning for the SVG
  // text overlay, especially important against AI-generated photo
  // backgrounds. 'none' preserves the pre-v2.3 rendering exactly.
  textBackdrop: z.enum(['none', 'pill', 'band']).default('none'),
  textColorMode: z.enum(['auto', 'light', 'dark']).default('auto'),
  textOffsetX: z.number().min(-60).max(60).default(0),
  textOffsetY: z.number().min(-60).max(60).default(0),
  textScale: z.number().min(0.7).max(1.5).default(1),
  // Spec v2.3.1: offset indipendente per il sottotitolo (tagline), così
  // titolo e sottotitolo si possono spostare separatamente invece di
  // muoversi sempre insieme con textOffsetX/Y.
  taglineOffsetX: z.number().min(-60).max(60).default(0),
  taglineOffsetY: z.number().min(-60).max(60).default(0),
  textPosition: z.enum(['overlay', 'above', 'below']).default('overlay'),
});
export type LogoBuilder = z.infer<typeof logoBuilderSchema>;

export const logoEditsSchema = z.object({
  primaryText: z.string().default(''),
  primaryColor: hexColorSchema.default('#01696F'),
  secondaryColor: hexColorSchema.default('#1a1a2e'),
});
export type LogoEdits = z.infer<typeof logoEditsSchema>;

export const logoSchema = z.object({
  documentType: z.literal('logo'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  title: z.string().default(''),
  source: z.enum(['builder', 'ai']).default('builder'),
  builder: logoBuilderSchema,
  brief: z.string().default(''),
  concepts: z.array(z.string()).default([]),
  selected: z.number().int().min(-1).default(-1),
  edits: logoEditsSchema.default({
    primaryText: '',
    primaryColor: '#01696F',
    secondaryColor: '#1a1a2e',
  }),
  aiStats: aiStatsSchema.optional(),
  briefContext: z.string().optional(),
  autoGeneratePending: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Logo = z.infer<typeof logoSchema>;

export function createEmptyLogo(): Logo {
  const now = new Date().toISOString();
  return {
    documentType: 'logo',
    id: `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    source: 'builder',
    builder: {
      primaryText: '',
      tagline: '',
      iconType: 'none',
      iconGlyph: '',
      iconShape: 'circle',
      primaryColor: '#01696F',
      secondaryColor: '#1a1a2e',
      fontFamily: 'Inter',
      layout: 'horizontal',
      icons: [],
      backgroundImage: null,
      backgroundColor: null,
      gradientFill: false,
      decorativeElements: [],
      imagePrompt: null,
      textBackdrop: 'none',
      textColorMode: 'auto',
      textOffsetX: 0,
      textOffsetY: 0,
      textScale: 1,
      taglineOffsetX: 0,
      taglineOffsetY: 0,
      textPosition: 'overlay',
    },
    brief: '',
    concepts: [],
    selected: -1,
    edits: {
      primaryText: '',
      primaryColor: '#01696F',
      secondaryColor: '#1a1a2e',
    },
    createdAt: now,
    updatedAt: now,
  };
}

interface LogoTemplatePreset {
  primaryText: string;
  tagline: string;
  iconType: LogoIconType;
  iconGlyph: string;
  iconShape: LogoIconShape;
  primaryColor: string;
  secondaryColor: string;
  layout: LogoLayout;
}

const LOGO_TEMPLATE_PRESETS: Record<LogoSector, LogoTemplatePreset> = {
  tech: {
    primaryText: 'CodeLab',
    tagline: 'Build better software',
    iconType: 'lucide',
    iconGlyph: 'cpu',
    iconShape: 'rounded',
    primaryColor: '#01696F',
    secondaryColor: '#0F172A',
    layout: 'horizontal',
  },
  food: {
    primaryText: 'Trattoria del Borgo',
    tagline: 'Cucina di stagione',
    iconType: 'lucide',
    iconGlyph: 'utensils',
    iconShape: 'circle',
    primaryColor: '#B45309',
    secondaryColor: '#1F2937',
    layout: 'stacked',
  },
  fashion: {
    primaryText: 'Atelier',
    tagline: 'Sartoria su misura',
    iconType: 'lucide',
    iconGlyph: 'scissors',
    iconShape: 'square',
    primaryColor: '#111827',
    secondaryColor: '#7C3AED',
    layout: 'vertical',
  },
  professionista: {
    primaryText: 'Studio Medico',
    tagline: 'Dott. Rossi',
    iconType: 'lucide',
    iconGlyph: 'stethoscope',
    iconShape: 'rounded',
    primaryColor: '#0F766E',
    secondaryColor: '#1F2937',
    layout: 'horizontal',
  },
};

export function createLogoTemplate(sector: LogoSector): Logo {
  const now = new Date().toISOString();
  const preset = LOGO_TEMPLATE_PRESETS[sector];
  return {
    documentType: 'logo',
    id: `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `Logo ${sector}`,
    source: 'builder',
    builder: {
      ...preset,
      fontFamily: 'Inter',
      icons: [],
      backgroundImage: null,
      backgroundColor: null,
      gradientFill: false,
      decorativeElements: [],
      imagePrompt: null,
      textBackdrop: 'none',
      textColorMode: 'auto',
      textOffsetX: 0,
      textOffsetY: 0,
      textScale: 1,
      taglineOffsetX: 0,
      taglineOffsetY: 0,
      textPosition: 'overlay',
    },
    brief: '',
    concepts: [],
    selected: -1,
    edits: {
      primaryText: '',
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// Defensive merge for logos. Same pattern as cards. A saved logo
// from the Collection might be missing the `builder` field, which
// is the only nested object that gets read by the editor and the
// SVG generator. Without the merge, opening a partial logo
// crashes the editor at `builder.layout` (or any other builder.X).
export function mergeLogoWithDefaults(input: Partial<Logo> | null | undefined): Logo {
  const base = createEmptyLogo();
  if (!input) return base;
  return {
    ...base,
    ...input,
    builder: { ...base.builder, ...(input.builder || {}) },
  };
}
