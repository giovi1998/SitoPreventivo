import { z } from 'zod';
import { FLYER_TEMPLATES_BY_SECTOR_LAYOUT, heroBoxMmForLayout } from '../flyer/templateCatalog';
import { DECORATIVE_PATTERN_IDS } from '../decorations/patterns';
import { aiStatsSchema } from '../aiStats';
import { FONT_SCALE_DEFAULT, FONT_SCALE_MAX, FONT_SCALE_MIN, hexColorSchema } from './shared';

export const FLYER_SIZES = ['A6', 'A5', 'A4', 'Letter', 'Square'] as const;
export type FlyerSize = (typeof FLYER_SIZES)[number];

export const FLYER_ORIENTATIONS = ['portrait', 'landscape'] as const;
export type FlyerOrientation = (typeof FLYER_ORIENTATIONS)[number];

export const FLYER_LAYOUTS = ['classic', 'centered', 'split', 'magazine'] as const;
export type FlyerLayout = (typeof FLYER_LAYOUTS)[number];

export const FLYER_TONES = ['formale', 'giovanile', 'tecnico'] as const;
export type FlyerTone = (typeof FLYER_TONES)[number];

// Millimeter dimensions per size × orientation. Square is orientation-agnostic.
export const FLYER_SIZE_MM: Record<FlyerSize, Record<FlyerOrientation | 'square', { w: number; h: number }>> = {
  A6: {
    portrait: { w: 105, h: 148 },
    landscape: { w: 148, h: 105 },
    square: { w: 105, h: 148 },
  },
  A5: {
    portrait: { w: 148, h: 210 },
    landscape: { w: 210, h: 148 },
    square: { w: 148, h: 210 },
  },
  A4: {
    portrait: { w: 210, h: 297 },
    landscape: { w: 297, h: 210 },
    square: { w: 210, h: 297 },
  },
  Letter: {
    portrait: { w: 216, h: 279 },
    landscape: { w: 279, h: 216 },
    square: { w: 216, h: 279 },
  },
  Square: {
    portrait: { w: 210, h: 210 },
    landscape: { w: 210, h: 210 },
    square: { w: 210, h: 210 },
  },
};

// Resolve physical dimensions honouring size + orientation.
// Square ignores orientation: it's always 210×210mm.
export function getFlyerDimensions(flyer: Flyer): { w: number; h: number } {
  if (flyer.size === 'Square') return FLYER_SIZE_MM.Square.square;
  return FLYER_SIZE_MM[flyer.size][flyer.orientation];
}

// Print-ready bleed in mm (applied to all 4 sides).
export const FLYER_BLEED_MM = 3;

// AI copy length limits (chars). Larger than the spec's `headline` zod
// constraint of 200 to allow the AI to provide its full context for
// refine operations; the field-level zod still caps the saved value.
export const FLYER_BRIEF_MAX = 500;
export const FLYER_HEADLINE_MAX = 200;
export const FLYER_SUBHEADLINE_MAX = 300;
export const FLYER_BODY_MAX = 2000;
export const FLYER_CTA_LABEL_MAX = 50;

// Hero image: max 5MB raw, 4000×4000px, 500KB after compression.
export const FLYER_HERO_MAX_RAW_BYTES = 5_000_000;
export const FLYER_HERO_MAX_DIMENSION = 4000;
export const FLYER_HERO_MAX_AFTER_COMPRESS = 500_000;

export const flyerContentSchema = z.object({
  headline: z.string().max(FLYER_HEADLINE_MAX).default(''),
  subheadline: z.string().max(FLYER_SUBHEADLINE_MAX).default(''),
  body: z.string().max(FLYER_BODY_MAX).default(''),
  cta: z.object({
    label: z.string().max(FLYER_CTA_LABEL_MAX).default(''),
    url: z.string().default(''),
  }).default({ label: '', url: '' }),
  heroImage: z.string().nullable().default(null),
  qrPayload: z.string().default(''),
  qrLabel: z.string().default(''),
});
export type FlyerContent = z.infer<typeof flyerContentSchema>;

export const flyerLayoutEnumSchema = z.enum(FLYER_LAYOUTS);
export const flyerSizeEnumSchema = z.enum(FLYER_SIZES);
export const flyerOrientationEnumSchema = z.enum(FLYER_ORIENTATIONS);
export const flyerToneEnumSchema = z.enum(FLYER_TONES);

export const flyerStyleSchema = z.object({
  bgColor: hexColorSchema.default('#FFFFFF'),
  textColor: hexColorSchema.default('#1a1a2e'),
  accentColor: hexColorSchema.default('#01696F'),
  layout: flyerLayoutEnumSchema.default('classic'),
  fontFamily: z.string().default('Inter'),
  fontScale: z.number().min(FONT_SCALE_MIN).max(FONT_SCALE_MAX).default(FONT_SCALE_DEFAULT),
});
export type FlyerStyle = z.infer<typeof flyerStyleSchema>;

export const flyerSchema = z.object({
  documentType: z.literal('flyer'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  title: z.string().default(''),
  size: flyerSizeEnumSchema.default('A5'),
  orientation: flyerOrientationEnumSchema.default('portrait'),
  content: flyerContentSchema,
  style: flyerStyleSchema,
  // TB-023: pattern decorativo SVG dietro i contenuti del volantino
  decorations: z.object({
    pattern: z.enum(DECORATIVE_PATTERN_IDS).nullable().default(null),
    opacity: z.number().min(0).max(1).default(0.2),
    palette: z.object({
      primary: hexColorSchema.default('#01696F'),
      secondary: hexColorSchema.default('#E11D48'),
      accent: hexColorSchema.nullable().default(null),
    }),
    // CON-PD-002: se true, il merge AI NON può modificare la decorazione.
    userLocked: z.boolean().default(false),
  }).default(() => ({ pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false })),
  aiStats: aiStatsSchema.optional(),
  briefContext: z.string().optional(),
  autoGeneratePending: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Flyer = z.infer<typeof flyerSchema>;

export function createEmptyFlyer(): Flyer {
  const now = new Date().toISOString();
  return {
    documentType: 'flyer',
    id: `flyer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    size: 'A5',
    orientation: 'portrait',
    content: {
      headline: '',
      subheadline: '',
      body: '',
      cta: { label: '', url: '' },
      heroImage: null,
      qrPayload: '',
      qrLabel: '',
    },
    style: {
      bgColor: '#FFFFFF',
      textColor: '#1a1a2e',
      accentColor: '#01696F',
      layout: 'classic',
      fontFamily: 'Inter',
      fontScale: FONT_SCALE_DEFAULT,
    },
    decorations: {
      pattern: null,
      opacity: 0.2,
      palette: { primary: '#01696F', secondary: '#E11D48', accent: null },
      userLocked: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export const FLYER_SECTORS = ['ristorante', 'evento', 'salone', 'negozio'] as const;
export type FlyerSector = (typeof FLYER_SECTORS)[number];

// Default layout per sector: which variant the editor loads first when
// the user clicks a sector button. Each sector exposes 4 layout variants
// (classic / centered / split / magazine) loaded via the "Varia layout"
// row in the editor.
export const FLYER_SECTOR_DEFAULT_LAYOUT: Record<FlyerSector, FlyerLayout> = {
  ristorante: 'classic',
  evento: 'centered',
  salone: 'split',
  negozio: 'magazine',
};

/**
 * 16 template presets are defined in src/utils/flyer/templateCatalog.ts
 * and imported here so that documentSchemas.ts keeps the same public API.
 */

/**
 * Build a rich flyer from a (sector, layout) combination. The layout
 * is optional: if omitted, the sector's default layout is used (see
 * FLYER_SECTOR_DEFAULT_LAYOUT). The hero image is a stable picsum.photos
 * URL so the same template always renders the same photo. The image W/H
 * matches the hero box aspect for that layout, so preserveAspectRatio
 * slicing wastes as little of the source image as possible.
 */
export function createFlyerTemplate(sector: FlyerSector, layout?: FlyerLayout): Flyer {
  const now = new Date().toISOString();
  const useLayout = layout ?? FLYER_SECTOR_DEFAULT_LAYOUT[sector];
  const tpl = FLYER_TEMPLATES_BY_SECTOR_LAYOUT[sector][useLayout];
  let heroImage: string | null = null;
  if (tpl.imageSeed) {
    const box = heroBoxMmForLayout(useLayout, getFlyerDimensions({ ...createEmptyFlyer(), size: tpl.size, orientation: tpl.orientation }));
    // ~4 px per mm (≈100 dpi). If the smaller side falls below 200px,
    // scale both proportionally so the aspect ratio is preserved (a flat
    // Math.max per side would distort the crop ratio for tiny boxes like
    // the centered hero strip).
    let pxW = Math.round(box.w * 4);
    let pxH = Math.round(box.h * 4);
    const smaller = Math.min(pxW, pxH);
    if (smaller < 200) {
      const k = 200 / smaller;
      pxW = Math.round(pxW * k);
      pxH = Math.round(pxH * k);
    }
    heroImage = `https://picsum.photos/seed/${tpl.imageSeed}/${pxW}/${pxH}`;
  }
  return {
    documentType: 'flyer',
    id: `flyer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: tpl.title,
    size: tpl.size,
    orientation: tpl.orientation,
    content: {
      headline: tpl.headline,
      subheadline: tpl.subheadline,
      body: tpl.body,
      cta: { ...tpl.cta },
      heroImage,
      qrPayload: '',
      qrLabel: tpl.qrLabel,
    },
    style: {
      bgColor: tpl.bgColor,
      textColor: tpl.textColor,
      accentColor: tpl.accentColor,
      layout: tpl.layout,
      fontFamily: 'Inter',
      fontScale: FONT_SCALE_DEFAULT,
    },
    decorations: {
      pattern: null,
      opacity: 0.2,
      palette: { primary: tpl.accentColor, secondary: tpl.textColor, accent: null },
      userLocked: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// Defensive merge: same rationale as mergeQrWithDefaults / mergeCardWithDefaults.
// A saved flyer from the Collection might be missing nested `content` or
// `style` fields (legacy save, partial data, schema drift across phases).
// Without this guard, opening a partial flyer from collection crashed the
// editor at the first read of `flyer.content.X` or `flyer.style.layout`.
export function mergeFlyerWithDefaults(input: Partial<Flyer> | null | undefined): Flyer {
  const base = createEmptyFlyer();
  if (!input) return base;
  return {
    ...base,
    ...input,
    content: {
      ...base.content,
      ...(input.content || {}),
      cta: { ...base.content.cta, ...((input.content && input.content.cta) || {}) },
    },
    style: { ...base.style, ...(input.style || {}) },
  };
}
