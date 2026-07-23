import { z } from 'zod';
import { hasElementContent, type GridElementKey } from './card/gridElements';
import { FLYER_TEMPLATES_BY_SECTOR_LAYOUT, heroBoxMmForLayout } from './flyer/templateCatalog';
import { DECORATIVE_PATTERN_IDS, type DecorativePatternId } from './decorations/patterns';

export const documentTypeSchema = z.enum(['quote', 'qrCode', 'businessCard', 'flyer', 'logo']);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const qrDataTypeSchema = z.enum(['url', 'text', 'email', 'phone', 'vcard', 'wifi', 'sms']);
export type QrDataType = z.infer<typeof qrDataTypeSchema>;

export const qrErrorCorrectionSchema = z.enum(['L', 'M', 'Q', 'H']);
export type QrErrorCorrection = z.infer<typeof qrErrorCorrectionSchema>;

export const qrDotStyleSchema = z.enum(['square', 'rounded', 'dots']);
export type QrDotStyle = z.infer<typeof qrDotStyleSchema>;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido (formato #RRGGBB)');

export const qrStyleSchema = z.object({
  errorCorrection: qrErrorCorrectionSchema.default('M'),
  fgColor: hexColorSchema.default('#000000'),
  bgColor: hexColorSchema.default('#FFFFFF'),
  size: z.number().min(128).max(2048).default(512),
  margin: z.number().min(0).max(16).default(2),
  logoOverlay: z.string().nullable().default(null),
  dotStyle: qrDotStyleSchema.default('rounded'),
});
export type QrStyle = z.infer<typeof qrStyleSchema>;

export const qrCodeDataSchema = z.object({
  type: qrDataTypeSchema,
  payload: z.string(),
});
export type QrCodeData = z.infer<typeof qrCodeDataSchema>;

export const qrCodeSchema = z.object({
  documentType: z.literal('qrCode'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  title: z.string().default(''),
  data: qrCodeDataSchema,
  style: qrStyleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type QRCode = z.infer<typeof qrCodeSchema>;

export function createEmptyQrCode(): QRCode {
  const now = new Date().toISOString();
  return {
    documentType: 'qrCode',
    id: `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'QR Code',
    data: { type: 'url', payload: '' },
    style: {
      errorCorrection: 'M',
      fgColor: '#000000',
      bgColor: '#FFFFFF',
      size: 512,
      margin: 2,
      logoOverlay: null,
      dotStyle: 'rounded',
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createGiovanniQrTemplate(): QRCode {
  return {
    ...createEmptyQrCode(),
    title: 'QR personale, Giovanni',
    data: { type: 'url', payload: GIOVANNI_PERSONAL_URL },
  };
}

export function createDocumentFromQrCode(qr: QRCode, userEmail: string): QRCode & { userEmail: string } {
  return { ...qr, userEmail, updatedAt: new Date().toISOString() };
}

// Defensive merge: a QR loaded from DB / Collection might be missing
// nested fields (legacy save, schema drift, partial JSON). Spreading
// `createEmptyQrCode()` first and the input second ensures all
// required fields have a defined value before render. Used by
// QREditor and any consumer that re-hydrates a saved QR.
export function mergeQrWithDefaults(input: Partial<QRCode> | null | undefined): QRCode {
  const base = createEmptyQrCode();
  if (!input) return base;
  return {
    ...base,
    ...input,
    data: { ...base.data, ...(input.data || {}) },
    style: { ...base.style, ...(input.style || {}) },
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

// Phase 2.2 REQ-D04: scala globale del testo della card (1 = default).
// Range ridotto (0.7–1.5) per evitare layout che rompono la card.
export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 1.5;
export const FONT_SCALE_STEP = 0.05;
export const FONT_SCALE_DEFAULT = 1;

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

// v2.16: balanced right preset. Photo is prominent but not full-height; the
// left text band has more breathing room and the bottom-right cell is left
// empty so the layout does not feel crowded. Derived from the Giovanni card
// audit (card_1784802983118_70ojhd).
export function gridPresetRightBalanced(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      name: { x: 0, y: 0, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      title: { x: 0, y: 1, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      company: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      logo: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'center' },
      photo: { x: 2, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
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
    const hasSocials = card.back.socials.some((s) => s.platform && s.url);
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
  if (!grid) return false;
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
  }).default(() => ({ pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null } })),
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
    },
    grid: gridPresetLeft(),
    backGrid: gridPresetBackDefault(),
    createdAt: now,
    updatedAt: now,
  };
}

export const GIOVANNI_PERSONAL_URL = 'https://giovannicidu.vercel.app';

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
  const base: BusinessCard = {
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
      // v2.16: use the balanced right preset derived from the Giovanni card audit.
      layout: 'right-balanced',
      // v2.8.1: the template includes custom front/back grids, so grid-mode
      // must be active from the start. Otherwise preview and export derive
      // from the flexbox layout and ignore the custom grids.
      useGrid: true,
    },
    back: {
      ...createEmptyCard().back,
      phone,
      email,
      website: GIOVANNI_PERSONAL_URL,
      qrPayload: '',
      qrLabel: 'Scansiona per il mio sito',
      servicesLabel: 'Servizi che offro',
      qrSize: 'medium',
      coverImageUrl: null,
      // v2.8.1: grid-mode attivo per usare il backGrid custom del template.
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
      accentColor: '#01696F',
      fontFamily: 'Inter',
      borderStyle: 'accent-strip-left',
      // v2.17 (REQ-CTRL-003): nuove card neutre — il sizing è per-elemento
      // (placement.scale); fontScale resta un campo legacy per i documenti
      // esistenti.
      fontScale: 1,
    },
  };
  // Derive grids from the chosen layout so the template stays in sync with the
  // preset factories. Empty cells (company, in this case) are filtered out.
  return {
    ...base,
    grid: deriveGridFromLayout(base, 'front'),
    backGrid: deriveGridFromLayout(base, 'back'),
  };
}

// ─── LOGO (Phase 4) ───────────────────────────────────────

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

// ─── FLYER (Phase 3) ──────────────────────────────────

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
  }).default(() => ({ pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null } })),
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

// ─── SOCIAL PACK (Phase 12) ──────────────────────────────────
// Cross-module AI: 3 social post coordinati col documento sorgente (card o flyer).
export const socialPlatformSchema = z.enum(['instagram', 'facebook', 'linkedin']);
export const socialToneSchema = z.enum(['professional', 'casual', 'promotional']);
export const socialPostSchema = z.object({
  platform: socialPlatformSchema,
  caption: z.string().max(2000).default(''),
  hashtags: z.array(z.string().max(40)).max(10).default([]),
  tone: socialToneSchema,
});
export const socialPackSchema = z.object({
  documentType: z.literal('socialPack'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  title: z.string().default(''),
  posts: z.array(socialPostSchema).length(3),
  sourceDocumentId: z.string().optional(),
  sourceDocumentType: z.enum(['card', 'flyer']).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SocialPlatform = z.infer<typeof socialPlatformSchema>;
export type SocialTone = z.infer<typeof socialToneSchema>;
export type SocialPost = z.infer<typeof socialPostSchema>;
export type SocialPack = z.infer<typeof socialPackSchema>;

export function createEmptySocialPack(sourceId?: string, sourceType?: 'card' | 'flyer'): SocialPack {
  const now = new Date().toISOString();
  return {
    documentType: 'socialPack',
    id: `social_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Social Pack',
    posts: [
      { platform: 'instagram', caption: '', hashtags: [], tone: 'casual' },
      { platform: 'facebook', caption: '', hashtags: [], tone: 'promotional' },
      { platform: 'linkedin', caption: '', hashtags: [], tone: 'professional' },
    ],
    sourceDocumentId: sourceId,
    sourceDocumentType: sourceType,
    createdAt: now,
    updatedAt: now,
  };
}
