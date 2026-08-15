import { z } from 'zod';
import { hasElementContent, type GridElementKey } from '../card/gridElements';
import { DECORATIVE_PATTERN_IDS, type DecorativePatternId } from '../decorations/patterns';
import { aiStatsSchema } from '../aiStats';
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  GIOVANNI_PERSONAL_URL,
  hexColorSchema,
} from './shared';

export const businessCardSizePresetSchema = z.enum(['eu-85x55', 'us-89x51', 'square-65x65']);
export type BusinessCardSizePreset = z.infer<typeof businessCardSizePresetSchema>;

// Phase 2.3: layout frontali espansi con nuovi template selezionabili.
// v2.16: 'right-balanced' derives from the Giovanni card audit: photo on the
// right but not full-height, tighter text band, paired with a balanced back.
export const businessCardLayoutSchema = z.enum([
  'centered', 'left', 'split', 'right', 'right-balanced', 'top', 'bottom', 'minimal', 'photo-circle', 'compact',
]);
export type BusinessCardLayout = z.infer<typeof businessCardLayoutSchema>;

export const businessCardBorderStyleSchema = z.enum(['none', 'thin', 'accent-strip-left', 'accent-strip-bottom']);
export type BusinessCardBorderStyle = z.infer<typeof businessCardBorderStyleSchema>;

export const businessCardQrSizeSchema = z.enum(['small', 'medium', 'large']);
export type BusinessCardQrSize = z.infer<typeof businessCardQrSizeSchema>;

// Phase 2.2 REQ-D01 + AI Assist unification: set sicuro di font
// mostrati nel selettore UI (allineato a SHARED_FONT_FAMILIES in
// AiFontPicker). Card importate con altri font restano valide (schema
// stringa libera); il selettore mostra "Personalizzato" senza
// sovrascriverle.
export const SAFE_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Source Sans 3',
  'DM Sans',
  'Figtree',
  'Plus Jakarta Sans',
  'Oswald',
  'Raleway',
  'Georgia',
  'Times New Roman',
  'Playfair Display',
  'Merriweather',
  'Courier New',
] as const;
export type SafeFontFamily = (typeof SAFE_FONT_FAMILIES)[number];
export function isSafeFontFamily(value: string): value is SafeFontFamily {
  const base = value.split(',')[0]?.trim() || value;
  return (SAFE_FONT_FAMILIES as readonly string[]).includes(base)
    || (SAFE_FONT_FAMILIES as readonly string[]).includes(value);
}

// Phase 2.2 REQ-E02: dimensione QR in flexbox-mode (px). In grid-mode
// la dimensione deriva dalla cella della griglia.
export const QR_SIZE_PX: Record<BusinessCardQrSize, number> = {
  small: 84,
  medium: 120,
  large: 160,
};

export const SIZE_PRESETS_MM: Record<BusinessCardSizePreset, { w: number; h: number }> = {
  'eu-85x55': { w: 85, h: 55 },
  'us-89x51': { w: 89, h: 51 },
  'square-65x65': { w: 65, h: 65 },
};

export const BLEED_MM = 3;
export const CARD_A4_PAGE_MM = { w: 210, h: 297 };
// Layout 10-up A4: 5 colonne × 2 righe su A4 LANDSCAPE (297×210mm).
// Le card sono ruotate 90° (senso orario) nel PDF: il lato lungo
// (cardW=85) diventa verticale, il lato corto (cardH=55) orizzontale.
// Il raster PNG viene ruotato 90° nel canvas pipeline (vedi
// renderCardSideDataUrl con `rotate: true`). Il GAP coincide con il
// BLEED condiviso: 5×55+4×3=287<297 e 2×85+3=173<210. Vedi fix
// "10-up A4 landscape rotation" in cardGenerator.ts.
export const CARD_A4_COLS = 5;
export const CARD_A4_ROWS = 2;
export const CARD_A4_GAP_MM = 3;
export const CARD_A4_MARGIN_MM = 10;

export const gridAlignHSchema = z.enum(['left', 'center', 'right']).optional();
export const gridAlignVSchema = z.enum(['top', 'center', 'bottom']).optional();

export const cardGridElementSchema = z.object({
  x: z.number().min(0).max(8),
  y: z.number().min(0).max(8),
  w: z.number().min(0).max(8),
  h: z.number().min(0).max(8),
  alignH: gridAlignHSchema,
  alignV: gridAlignVSchema,
  // TB-023: legacy alias for `placement` (kept for backwards compatibility
  // with cards saved before the generic placement field was introduced).
  photoPlacement: z.object({ x: z.number().min(-1).max(1).default(0), y: z.number().min(-1).max(1).default(0), scale: z.number().min(0.5).max(2).default(1) }).optional(),
  // v2.15: generic nudge/scale for any grid element (photo, QR, logo, etc.).
  // x,y ∈ [-1,1] map to ±half the cell dimension; scale ∈ [0.5,2].
  placement: z.object({ x: z.number().min(-1).max(1).default(0), y: z.number().min(-1).max(1).default(0), scale: z.number().min(0.5).max(2).default(1) }).optional(),
});
export type CardGridElement = z.infer<typeof cardGridElementSchema>;

export const cardGridSchema = z.object({
  cols: z.number().min(2).max(8),
  rows: z.number().min(2).max(8),
  elements: z.object({
    photo: cardGridElementSchema.optional(),
    name: cardGridElementSchema.optional(),
    title: cardGridElementSchema.optional(),
    company: cardGridElementSchema.optional(),
    logo: cardGridElementSchema.optional(),
    qr: cardGridElementSchema.optional(),
    contacts: cardGridElementSchema.optional(),
    socials: cardGridElementSchema.optional(),
    services: cardGridElementSchema.optional(),
  }),
});
export type CardGrid = z.infer<typeof cardGridSchema>;

export function gridPresetLeft(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      // v2.17: foto a sinistra (3/4 altezza) + logo sotto la foto,
      // testo a destra. Nessun overlap: photo occupa righe 0-2, logo riga 3.
      photo: { x: 0, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
      name: { x: 2, y: 0, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      title: { x: 2, y: 1, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 2, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      logo: { x: 0, y: 3, w: 2, h: 1, alignH: 'center', alignV: 'center' },
    },
  };
}

export function gridPresetCentered(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      photo: { x: 1, y: 0, w: 2, h: 1, alignH: 'center', alignV: 'center' },
      name: { x: 0, y: 1, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      title: { x: 0, y: 2, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      company: { x: 0, y: 3, w: 2, h: 1, alignH: 'center', alignV: 'center' },
      logo: { x: 2, y: 3, w: 2, h: 1, alignH: 'center', alignV: 'center' },
    },
  };
}

export function gridPresetSplit(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      name: { x: 0, y: 0, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      title: { x: 0, y: 1, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      contacts: { x: 0, y: 2, w: 2, h: 2, alignH: 'left', alignV: 'top' },
      qr: { x: 2, y: 2, w: 1, h: 2, alignH: 'center', alignV: 'center' },
      logo: { x: 3, y: 2, w: 1, h: 2, alignH: 'center', alignV: 'center' },
    },
  };
}

// Phase 2.2 fix: preset SPLIT per il FRONTE (foto a sinistra a tutta altezza,
// testo + logo a destra). gridPresetSplit() qui sopra NON include `photo` e
// contiene elementi del retro (contacts/qr), non adatto al fronte. Questo
// preset rispecchia il layout flexbox `split` del fronte, così init-from-layout
// (REQ-E03) e il preset "Diviso" non perdono la foto.
export function gridPresetFrontSplit(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      photo: { x: 0, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
      name: { x: 2, y: 0, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      title: { x: 2, y: 1, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 2, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      logo: { x: 0, y: 3, w: 2, h: 1, alignH: 'center', alignV: 'center' },
    },
  };
}

// Phase 2.3: nuovi preset frontali per dare più scelta all'utente.
export function gridPresetRight(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      name: { x: 0, y: 0, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      title: { x: 0, y: 1, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      logo: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      photo: { x: 2, y: 0, w: 2, h: 4, alignH: 'center', alignV: 'center' },
    },
  };
}

// v2.17: "business card professionale" — right-balanced rework. Name spans the
// full top row for strong hierarchy; photo is a centred square on the right
// (not full-height) so the left text band has clear breathing room; logo sits
// small in the bottom-left corner. Derived from the Giovanni card audit
// (card_1784802983118_70ojhd).
export function gridPresetRightBalanced(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      name: { x: 0, y: 0, w: 4, h: 1, alignH: 'left', alignV: 'center' },
      photo: { x: 2, y: 1, w: 2, h: 2, alignH: 'center', alignV: 'center' },
      title: { x: 0, y: 1, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      logo: { x: 0, y: 3, w: 1, h: 1, alignH: 'left', alignV: 'center' },
    },
  };
}

export function gridPresetTop(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      photo: { x: 0, y: 0, w: 4, h: 2, alignH: 'center', alignV: 'center' },
      name: { x: 0, y: 2, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      title: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 2, y: 3, w: 2, h: 1, alignH: 'right', alignV: 'center' },
      logo: { x: 1, y: 3, w: 2, h: 1, alignH: 'center', alignV: 'center' },
    },
  };
}

export function gridPresetBottom(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      name: { x: 0, y: 0, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      title: { x: 0, y: 1, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      logo: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 2, y: 2, w: 2, h: 1, alignH: 'right', alignV: 'center' },
      photo: { x: 0, y: 3, w: 4, h: 1, alignH: 'center', alignV: 'center' },
    },
  };
}

export function gridPresetMinimal(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      name: { x: 0, y: 1, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      title: { x: 0, y: 2, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      company: { x: 0, y: 3, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      logo: { x: 1, y: 0, w: 2, h: 1, alignH: 'center', alignV: 'center' },
      photo: { x: 1, y: 0, w: 2, h: 1, alignH: 'center', alignV: 'center' },
    },
  };
}

export function gridPresetPhotoCircle(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      photo: { x: 1, y: 0, w: 2, h: 2, alignH: 'center', alignV: 'center' },
      name: { x: 0, y: 2, w: 4, h: 1, alignH: 'center', alignV: 'center' },
      title: { x: 0, y: 3, w: 3, h: 1, alignH: 'center', alignV: 'center' },
      company: { x: 3, y: 3, w: 1, h: 1, alignH: 'center', alignV: 'center' },
      logo: { x: 3, y: 3, w: 1, h: 1, alignH: 'center', alignV: 'center' },
    },
  };
}

export function gridPresetCompact(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      photo: { x: 0, y: 0, w: 1, h: 2, alignH: 'center', alignV: 'center' },
      logo: { x: 0, y: 2, w: 1, h: 2, alignH: 'center', alignV: 'center' },
      name: { x: 1, y: 0, w: 3, h: 1, alignH: 'left', alignV: 'center' },
      title: { x: 1, y: 1, w: 3, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 1, y: 2, w: 3, h: 1, alignH: 'left', alignV: 'center' },
    },
  };
}

export function gridPresetBackDefault(): CardGrid {
  // Label UI: "Default retro (contatti + QR + social)".
  // v2.13: socials MUST have their own cell — fallback into contacts
  // caused export overflow (no clip) and 3×3/debug mismatch.
  // QR takes right half (w:2), matching Giovanni template density.
  return {
    cols: 4,
    rows: 4,
    elements: {
      contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left', alignV: 'top' },
      services: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'top' },
      socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'top' },
      qr: { x: 2, y: 0, w: 2, h: 4, alignH: 'center', alignV: 'center' },
    },
  };
}

// v2.16: balanced back preset paired with gridPresetRightBalanced. QR is
// shorter (h:3) with the label underneath, leaving room for contacts/services/
// socials in the left column without the oversized empty bands of the default.
export function gridPresetBackBalanced(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left', alignV: 'top' },
      services: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'top' },
      socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'top' },
      qr: { x: 2, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
    },
  };
}

// Phase 2.2 REQ-E03: init-from-layout. Deriva la griglia iniziale dal
// layout flexbox corrente così che attivare il master switch NON sposti
// visivamente gli elementi. Per il retro usa sempre gridPresetBackDefault,
// tranne quando il fronte è 'right-balanced' (accoppiato al back bilanciato).
// `filterByContent` rimuove gli elementi vuoti (es. `logo` se non c'è
// logoUrl), così l'utente non vede "riserve" inutili nella griglia.
// Phase 2.3: lookup table per tutti i layout frontali supportati.
// Esportata per l'invariante di registrazione preset (REQ-TEST-004).
export const FRONT_GRID_PRESETS: Record<BusinessCardLayout, () => CardGrid> = {
  centered: gridPresetCentered,
  left: gridPresetLeft,
  split: gridPresetFrontSplit,
  right: gridPresetRight,
  'right-balanced': gridPresetRightBalanced,
  top: gridPresetTop,
  bottom: gridPresetBottom,
  minimal: gridPresetMinimal,
  'photo-circle': gridPresetPhotoCircle,
  compact: gridPresetCompact,
};

export function deriveGridFromLayout(
  card: BusinessCard,
  side: 'front' | 'back',
): CardGrid {
  if (side === 'back') {
    const backPreset = card.front.layout === 'right-balanced'
      ? gridPresetBackBalanced()
      : gridPresetBackDefault();
    return filterGridElementsByContent(backPreset, card, 'back');
  }
  const presetFn = FRONT_GRID_PRESETS[card.front.layout] ?? gridPresetLeft;
  return filterGridElementsByContent(presetFn(), card, 'front');
}

/**
 * Garantisce la grid mode su una card generata: se ha un layout ma nessuna
 * grid, deriva la grid dal layout e setta useGrid su entrambi i lati.
 * Senza questo la preview usa il fallback legacy non centrato mentre
 * l'export deriva la grid → preview ≠ export (bug visivo auto-build
 * 2026-08-13). Card già in grid restano invariate.
 */
export function ensureCardGrid(card: BusinessCard): BusinessCard {
  if (card.front.useGrid && hasGridElements('front', card)) return card;
  // Attenzione: `{}` (AI che risponde con grid vuota) NON è nullish →
  // `??` la terrebbe e la preview resterebbe in legacy. Si guarda il
  // contenuto, non la presenza.
  const grid = hasGridElements('front', card) ? card.grid : deriveGridFromLayout(card, 'front');
  const withFront = { ...card, grid };
  return {
    ...withFront,
    front: { ...card.front, useGrid: true },
    back: { ...card.back, useGrid: true },
    backGrid: hasGridElements('back', withFront) ? withFront.backGrid : deriveGridFromLayout(withFront, 'back'),
  };
}

function filterGridElementsByContent(
  grid: CardGrid,
  card: BusinessCard,
  side: 'front' | 'back',
): CardGrid {
  const els: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const [key, rect] of Object.entries(grid.elements)) {
    if (rect && hasElementContent(key as GridElementKey, card, side)) {
      els[key] = rect;
    }
  }
  // v2.8: back-side fallback — quando non ci sono contatti veri (phone/
  // email/etc vuoti) ma ci sono socials, mantieni comunque la cella
  // `contacts` dal preset così i socials hanno un container nel grid
  // (il fallback {!grid.elements.socials && socialsContent} in
  // BackPreview renderizza i socials dentro contacts).
  if (side === 'back' && !els.contacts && grid.elements.contacts) {
    const hasSocials = (card.back?.socials ?? []).some((s) => s.platform && s.url);
    if (hasSocials) {
      els.contacts = grid.elements.contacts;
    }
  }
  return { cols: grid.cols, rows: grid.rows, elements: els as CardGrid['elements'] };
}

// Phase 2.2 REQ-E01: true se il lato ha almeno un elemento grid con
// contenuto. Usato per decidere se renderizzare in grid-mode
// (isGridMode = useGrid && hasGridElements).
export function hasGridElements(side: 'front' | 'back', card: BusinessCard): boolean {
  const grid = side === 'back' ? card.backGrid : card.grid;
  // L'AI può salvare `grid: {}` (senza elements): non è nullish ma è
  // vuota — senza la guard su elements questa funzione crashava.
  if (!grid?.elements) return false;
  for (const [key, rect] of Object.entries(grid.elements)) {
    if (rect && hasElementContent(key as GridElementKey, card, side)) return true;
  }
  return false;
}

export const businessCardSchema = z.object({
  documentType: z.literal('businessCard'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  title: z.string().default(''),
    front: z.object({
    name: z.string().default(''),
    title: z.string().default(''),
    company: z.string().default(''),
    photoUrl: z.string().nullable().default(null),
    logoUrl: z.string().nullable().default(null),
    // Spec v2.4: AI-generated cover/background image for the front side.
    // Stored as base64 data URL. Rendered full-bleed behind text/photo.
    coverImageUrl: z.string().nullable().default(null),
    logoBackground: z.enum(['none', 'card']).default('none'),
    layout: businessCardLayoutSchema.default('left'),
    // Phase 2.2 REQ-A02: separa "grid-mode attivo" (rende la preview via
    // CSS Grid) dal toggle delle "linee guida" (overlay puramente visivo).
    // Default false = le card esistenti continuano a renderizzare in
    // flexbox finché l'utente non sposta un elemento nel grid editor.
    useGrid: z.boolean().default(false),
  }),
  back: z.object({
    phone: z.string().default(''),
    email: z.string().default(''),
    website: z.string().default(''),
    address: z.string().default(''),
    vatNumber: z.string().default(''),
    services: z.array(z.string().max(80)).max(8).default([]),
    // Phase 2.2 REQ-F02: heading editabile sopra la lista servizi nel
    // retro. Se vuoto, nessun heading viene mostrato.
    servicesLabel: z.string().max(40).default('Servizi'),
    socials: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
    qrPayload: z.string().default(''),
    qrLabel: z.string().default('Scansiona per visitare il sito'),
    // Phase 2.2 REQ-E02: dimensione QR in flexbox-mode. In grid-mode
    // la dimensione deriva dalla cella.
    qrSize: businessCardQrSizeSchema.default('medium'),
    // Spec v2.4: AI-generated cover/background image for the back side.
    coverImageUrl: z.string().nullable().default(null),
    // Phase 2.2 REQ-A02: come sopra, per il retro. Indipendente dal front
    // (l'utente può avere grid-mode attivo solo su uno dei due lati).
    useGrid: z.boolean().default(false),
  }),
  decorations: z.object({
    // TB-023: pattern decorativo SVG dietro i contenuti della card
    pattern: z.enum(DECORATIVE_PATTERN_IDS).nullable().default(null),
    opacity: z.number().min(0).max(1).default(0.2),
    palette: z.object({
      primary: hexColorSchema.default('#01696F'),
      secondary: hexColorSchema.default('#E11D48'),
      accent: hexColorSchema.nullable().default(null),
    }),
    // CON-PD-002: se true, il merge AI NON può modificare pattern/palette/
    // opacity (l'utente ha bloccato la scelta manuale).
    userLocked: z.boolean().default(false),
  }).default(() => ({ pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false })),
  style: z.object({
    sizePreset: businessCardSizePresetSchema.default('eu-85x55'),
    bgColor: hexColorSchema.default('#FFFFFF'),
    textColor: hexColorSchema.default('#1a1a2e'),
    accentColor: hexColorSchema.default('#01696F'),
    fontFamily: z.string().default('Inter'),
    borderStyle: businessCardBorderStyleSchema.default('accent-strip-left'),
    // Phase 2.2 REQ-D04: scala globale del testo della card (0.7–1.5,
    // default 1). Applicata come CSS variable `--card-font-scale`.
    fontScale: z.number().min(FONT_SCALE_MIN).max(FONT_SCALE_MAX).default(FONT_SCALE_DEFAULT),
  }),
  grid: cardGridSchema.optional(),
  backGrid: cardGridSchema.optional(),
  aiStats: aiStatsSchema.optional(),
  // TB-027 auto-build: brief cliente in chiaro (Attività:/Referente:/…)
  // letto dagli orchestratori AI per contestualizzare la generazione.
  briefContext: z.string().optional(),
  // TB-027 auto-build: true finché la bozza non ha completato la generazione AI.
  autoGeneratePending: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BusinessCard = z.infer<typeof businessCardSchema>;

export function createEmptyCard(): BusinessCard {
  const now = new Date().toISOString();
  return {
    documentType: 'businessCard',
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    front: {
      name: '',
      title: '',
      company: '',
      photoUrl: null,
      logoUrl: null,
      coverImageUrl: null,
      logoBackground: 'none',
      layout: 'left',
      useGrid: false,
    },
    back: {
      phone: '',
      email: '',
      website: '',
      address: '',
      vatNumber: '',
      services: [],
      servicesLabel: 'Servizi',
      socials: [],
      qrPayload: '',
      qrLabel: 'Scansiona per visitare il sito',
      qrSize: 'medium',
      coverImageUrl: null,
      useGrid: false,
    },
    style: {
      sizePreset: 'eu-85x55',
      bgColor: '#FFFFFF',
      textColor: '#1a1a2e',
      accentColor: '#01696F',
      fontFamily: 'Inter',
      borderStyle: 'accent-strip-left',
      fontScale: FONT_SCALE_DEFAULT,
    },
    decorations: {
      pattern: null,
      opacity: 0.2,
      palette: { primary: '#01696F', secondary: '#E11D48', accent: null },
      userLocked: false,
    },
    grid: gridPresetLeft(),
    backGrid: gridPresetBackDefault(),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Logo SVG trasparente per Giovanni (generato via builder inline) ───────
// Lo costruiamo qui (non importando logoGenerator per evitare circular dep).
// Lo sfondo è trasparente: nessun <rect> di background. I moduli del
// path lucide "terminal" sono presi da lucideIconPaths.ts (import user zod).
// v2.11: content centered in viewBox so object-fit:contain places the
// visual logo in the middle of the grid cell (not left-heavy empty right).
const GIOVANNI_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140">
  <rect x="24" y="28" width="84" height="84" rx="14" fill="#01696F"/>
  <g transform="translate(24 28) scale(3.5)" stroke="#FFFFFF" stroke-width="0.571" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="m4 17 6-6-6-6"/>
    <path d="M12 19h6"/>
  </g>
  <text x="124" y="72" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="700" fill="#1a1a2e">WebdevCA</text>
  <text x="124" y="96" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="400" fill="#01696F" letter-spacing="1">Web Developer</text>
</svg>`;

function giovanniLogoDataUri(): string {
  // Data URI con SFONDO TRASPARENTE (niente bgcolor nel SVG)
  // USIAMO encodeURIComponent per evitare problemi con btoa in SSR
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GIOVANNI_LOGO_SVG);
}

export function createGiovanniCardTemplate(): BusinessCard {
  const phone = '35180008042';
  const email = 'webdevcaglian@gmail.com';
  const linkedInUrl = 'https://www.linkedin.com/in/giovanni-cidu-16162b212';
  return {
    ...createEmptyCard(),
    title: 'Bigliettino Giovanni, Web Developer',
    front: {
      ...createEmptyCard().front,
      name: 'GIOVANNI CIDU',
      title: 'Web Developer',
      company: '',
      photoUrl: '/giovanni-photo.jpg',
      logoUrl: giovanniLogoDataUri(),
      coverImageUrl: null,
      // v2.8.3: layout split come nel JSON utente; foto a sinistra a tutta
      // altezza, testo e logo a destra.
      layout: 'split',
      // v2.8.1: il template include griglie custom front/back, quindi il
      // master switch griglia deve essere attivo fin dall'inizio.
      useGrid: true,
    },
    back: {
      ...createEmptyCard().back,
      phone,
      email,
      website: GIOVANNI_PERSONAL_URL,
      qrPayload: '',
      qrLabel: 'Scansiona per il mio sito',
      services: ['Sviluppo Web Frontend', 'Sviluppo Backend', 'Consulenza Tecnica'],
      servicesLabel: 'Servizi che offro',
      qrSize: 'medium',
      coverImageUrl: null,
      useGrid: true,
      socials: [
        { platform: 'LinkedIn', url: linkedInUrl },
        { platform: 'GitHub', url: 'https://github.com/GiovanniCidu' },
      ],
    },
    style: {
      ...createEmptyCard().style,
      sizePreset: 'eu-85x55',
      bgColor: '#FFFFFF',
      textColor: '#1a1a2e',
      // v2.8.3: navy scelto dall'utente nel JSON.
      accentColor: '#1e3a5f',
      fontFamily: 'Inter',
      borderStyle: 'accent-strip-left',
      fontScale: 1.05,
    },
    grid: {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 2, h: 4, alignH: 'center', alignV: 'center' },
        // v2.8.3: name ancorato al fondo della riga 0 così nome+titolo
        // formano un blocco compatto.
        name: { x: 2, y: 0, w: 2, h: 1, alignH: 'center', alignV: 'bottom' },
        title: { x: 2, y: 1, w: 2, h: 1, alignH: 'center', alignV: 'top' },
        logo: { x: 2, y: 2, w: 2, h: 2, alignH: 'center', alignV: 'center' },
      },
    },
    backGrid: {
      cols: 4,
      rows: 4,
      elements: {
        // v2.8.3: distribuzione verticale bilanciata della colonna sinistra —
        // contatti in alto, servizi al centro (2 righe per label + 3 voci),
        // social in basso; QR metà destra a tutta altezza.
        contacts: { x: 0, y: 0, w: 2, h: 1, alignH: 'left', alignV: 'top' },
        services: { x: 0, y: 1, w: 2, h: 2, alignH: 'left', alignV: 'center' },
        socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'center' },
        qr: { x: 2, y: 0, w: 2, h: 4, alignH: 'center', alignV: 'center' },
      },
    },
  };
}

// Defensive merge for business cards. Same rationale as
// `mergeQrWithDefaults`: a saved card from the Collection might be
// missing nested fields (legacy save, partial data, schema drift
// across phases 0-2). Without this, opening a partial card from
// collection crashed the editor with "Cannot read properties of
// undefined (reading 'layout')" at the first read of `card.front.X`
// in cardGenerator / CardPreview / CardEditor. The merge ensures
// `front`, `back`, and `style` are always full objects before the
// component tree touches them.
//
// `grid` and `backGrid` are optional in the schema (only present
// when useGrid is true on that side), so we only merge them when
// the input has them.
export function mergeCardWithDefaults(input: Partial<BusinessCard> | null | undefined): BusinessCard {
  const base = createEmptyCard();
  if (!input) return base;
  return {
    ...base,
    ...input,
    front: { ...base.front, ...(input.front || {}) },
    back: { ...base.back, ...(input.back || {}) },
    style: { ...base.style, ...(input.style || {}) },
    // Prefer the saved grid elements as-is. Do NOT re-inject empty cells from
    // base presets (e.g. services) — that recreated ghost collision blockers
    // and made export/preview diverge after reopen from Collection.
    grid: input.grid
      ? {
          cols: input.grid.cols ?? base.grid!.cols,
          rows: input.grid.rows ?? base.grid!.rows,
          elements: { ...(input.grid.elements || {}) },
        }
      : base.grid,
    backGrid: input.backGrid
      ? {
          cols: input.backGrid.cols ?? base.backGrid!.cols,
          rows: input.backGrid.rows ?? base.backGrid!.rows,
          elements: { ...(input.backGrid.elements || {}) },
        }
      : base.backGrid,
  };
}
