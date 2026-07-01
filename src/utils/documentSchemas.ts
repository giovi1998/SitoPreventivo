import { z } from 'zod';

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
    data: { type: 'url', payload: 'https://webdeveloperca.netlify.app/' },
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
    grid: input.grid
      ? { ...(base.grid || gridPresetLeft()), ...input.grid, elements: { ...((base.grid || gridPresetLeft()).elements), ...(input.grid.elements || {}) } }
      : base.grid,
    backGrid: input.backGrid
      ? { ...(base.backGrid || gridPresetBackDefault()), ...input.backGrid, elements: { ...((base.backGrid || gridPresetBackDefault()).elements), ...(input.backGrid.elements || {}) } }
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

export const businessCardLayoutSchema = z.enum(['centered', 'left', 'split']);
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

// Phase 2.2 REQ-D01: set sicuro di font mostrati nel selettore UI.
// Card importate con altri font restano valide (lo schema usa stringa
// libera); il selettore mostra l'opzione corrente come "Personalizzato"
// senza sovrascriverla.
export const SAFE_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Georgia',
  'Times New Roman',
  'Courier New',
] as const;
export type SafeFontFamily = (typeof SAFE_FONT_FAMILIES)[number];
export function isSafeFontFamily(value: string): value is SafeFontFamily {
  return (SAFE_FONT_FAMILIES as readonly string[]).includes(value);
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

export const cardGridElementSchema = z.object({
  x: z.number().min(0).max(8),
  y: z.number().min(0).max(8),
  w: z.number().min(0).max(8),
  h: z.number().min(0).max(8),
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
  }),
});
export type CardGrid = z.infer<typeof cardGridSchema>;

export function gridPresetLeft(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      photo: { x: 0, y: 0, w: 1, h: 4 },
      name: { x: 1, y: 0, w: 3, h: 1 },
      title: { x: 1, y: 1, w: 3, h: 1 },
      company: { x: 1, y: 2, w: 2, h: 1 },
      logo: { x: 3, y: 2, w: 1, h: 2 },
    },
  };
}

export function gridPresetCentered(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      photo: { x: 1, y: 0, w: 2, h: 1 },
      name: { x: 0, y: 1, w: 4, h: 1 },
      title: { x: 0, y: 2, w: 4, h: 1 },
      company: { x: 0, y: 3, w: 3, h: 1 },
      logo: { x: 3, y: 3, w: 1, h: 1 },
    },
  };
}

export function gridPresetSplit(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      name: { x: 0, y: 0, w: 4, h: 1 },
      title: { x: 0, y: 1, w: 4, h: 1 },
      contacts: { x: 0, y: 2, w: 2, h: 2 },
      qr: { x: 2, y: 2, w: 1, h: 2 },
      logo: { x: 3, y: 2, w: 1, h: 2 },
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
      photo: { x: 0, y: 0, w: 2, h: 4 },
      name: { x: 2, y: 0, w: 2, h: 1 },
      title: { x: 2, y: 1, w: 2, h: 1 },
      company: { x: 2, y: 2, w: 2, h: 1 },
      logo: { x: 2, y: 3, w: 2, h: 1 },
    },
  };
}

export function gridPresetBackDefault(): CardGrid {
  return {
    cols: 4,
    rows: 4,
    elements: {
      contacts: { x: 0, y: 0, w: 3, h: 4 },
      qr: { x: 3, y: 0, w: 1, h: 2 },
      socials: { x: 3, y: 2, w: 1, h: 2 },
    },
  };
}

// Phase 2.2 REQ-E03: init-from-layout. Deriva la griglia iniziale dal
// layout flexbox corrente così che attivare il master switch NON sposti
// visivamente gli elementi. Per il retro usa sempre gridPresetBackDefault.
// `filterByContent` rimuove gli elementi vuoti (es. `logo` se non c'è
// logoUrl), così l'utente non vede "riserve" inutili nella griglia.
export function deriveGridFromLayout(
  card: BusinessCard,
  side: 'front' | 'back',
): CardGrid {
  if (side === 'back') {
    return filterGridElementsByContent(gridPresetBackDefault(), card, 'back');
  }
  const preset =
    card.front.layout === 'centered'
      ? gridPresetCentered()
      : card.front.layout === 'split'
        ? gridPresetFrontSplit() // fix: include `photo` (gridPresetSplit non l'ha)
        : gridPresetLeft();
  return filterGridElementsByContent(preset, card, 'front');
}

function filterGridElementsByContent(
  grid: CardGrid,
  card: BusinessCard,
  side: 'front' | 'back',
): CardGrid {
  const els: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const [key, rect] of Object.entries(grid.elements)) {
    if (rect && hasElementContent(key, card, side)) {
      els[key] = rect;
    }
  }
  return { cols: grid.cols, rows: grid.rows, elements: els as CardGrid['elements'] };
}

// Phase 2.2 REQ-E01: true se il lato ha almeno un elemento grid con
// contenuto. Usato per decidere se renderizzare in grid-mode
// (isGridMode = showGrid && hasGridElements).
export function hasGridElements(side: 'front' | 'back', card: BusinessCard): boolean {
  const grid = side === 'back' ? card.backGrid : card.grid;
  if (!grid) return false;
  for (const [key, rect] of Object.entries(grid.elements)) {
    if (rect && hasElementContent(key, card, side)) return true;
  }
  return false;
}

function hasElementContent(
  key: string,
  card: BusinessCard,
  side: 'front' | 'back',
): boolean {
  if (side === 'front') {
    if (key === 'photo') return !!card.front.photoUrl;
    if (key === 'logo') return !!card.front.logoUrl;
    if (key === 'name') return card.front.name.trim().length > 0;
    if (key === 'title') return card.front.title.trim().length > 0;
    if (key === 'company') return card.front.company.trim().length > 0;
    return false;
  }
  // back
  if (key === 'contacts') {
    return !!(
      card.back.phone.trim() ||
      card.back.email.trim() ||
      card.back.website.trim() ||
      card.back.address.trim() ||
      card.back.vatNumber.trim()
    );
  }
  if (key === 'qr') {
    return !!(card.back.qrPayload.trim() || card.back.website.trim());
  }
  if (key === 'socials') {
    return card.back.socials.some((s) => s.platform && s.url);
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
    // Phase 2.2 REQ-A02: come sopra, per il retro. Indipendente dal front
    // (l'utente può avere grid-mode attivo solo su uno dei due lati).
    useGrid: z.boolean().default(false),
  }),
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
      useGrid: false,
    },
    style: {
      sizePreset: 'eu-85x55',
      bgColor: '#FFFFFF',
      textColor: '#1a1a2e',
      accentColor: '#01696F',
      fontFamily: 'Inter',
      borderStyle: 'accent-strip-left',
      fontScale: 1,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export const GIOVANNI_PERSONAL_URL = 'https://webdeveloperca.netlify.app/';

// ─── Logo SVG trasparente per Giovanni (generato via builder inline) ───────
// Lo costruiamo qui (non importando logoGenerator per evitare circular dep).
// Lo sfondo è trasparente: nessun <rect> di background. I moduli del
// path lucide "terminal" sono presi da lucideIconPaths.ts (import user zod).
const GIOVANNI_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">
  <rect x="14" y="38" width="84" height="84" rx="14" fill="#01696F"/>
  <g transform="translate(14 38) scale(3.5)" stroke="#FFFFFF" stroke-width="0.571" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="m4 17 6-6-6-6"/>
    <path d="M12 19h6"/>
  </g>
  <text x="110" y="78" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="700" fill="#1a1a2e">WebdevCA</text>
  <text x="110" y="100" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="400" fill="#01696F" letter-spacing="1">Web Developer</text>
</svg>`;

function giovanniLogoDataUri(): string {
  // Data URI con SFONDO TRASPARENTE (niente bgcolor nel SVG)
  // USIAMO encodeURIComponent per evitare problemi con btoa in SSR
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GIOVANNI_LOGO_SVG);
}

export function createGiovanniCardTemplate(): BusinessCard {
  return {
    ...createEmptyCard(),
    title: 'Bigliettino Giovanni, Web Developer',
    front: {
      ...createEmptyCard().front,
      name: 'GIOVANNI CIDU',
      title: 'Web Developer',
      company: 'HPE CDS',
      photoUrl: '/giovanni-photo.jpg',
      logoUrl: giovanniLogoDataUri(),
      layout: 'split',
    },
    back: {
      ...createEmptyCard().back,
      phone: 'XXXXX',
      email: 'XXXXX',
      website: GIOVANNI_PERSONAL_URL,
      qrPayload: GIOVANNI_PERSONAL_URL,
      qrLabel: 'Scansiona per visitare il mio sito',
      servicesLabel: 'Servizi che offro',
      qrSize: 'medium',
      socials: [
        { platform: 'LinkedIn', url: 'XXXXX' },
        { platform: 'GitHub', url: 'XXXXX' },
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
      fontScale: 1,
    },
    grid: {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 2, h: 4 },
        name: { x: 2, y: 0, w: 2, h: 1 },
        title: { x: 2, y: 1, w: 2, h: 1 },
        company: { x: 2, y: 2, w: 2, h: 1 },
        logo: { x: 2, y: 3, w: 1, h: 1 },
      },
    },
    backGrid: gridPresetBackDefault(),
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
    builder: { ...preset, fontFamily: 'Inter' },
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
    },
    createdAt: now,
    updatedAt: now,
  };
}

export const FLYER_SECTORS = ['ristorante', 'evento', 'salone', 'negozio'] as const;
export type FlyerSector = (typeof FLYER_SECTORS)[number];

interface FlyerTemplatePreset {
  title: string;
  size: FlyerSize;
  orientation: FlyerOrientation;
  layout: FlyerLayout;
  bgColor: string;
  textColor: string;
  accentColor: string;
  /** Picsum.photos seed for the hero image. Empty string = no hero. */
  imageSeed: string;
  headline: string;
  subheadline: string;
  body: string;
  cta: { label: string; url: string };
  qrLabel: string;
}

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
 * 16 template presets (4 settori × 4 layout). Hero image via
 * `picsum.photos/seed/{seed}/W/H` (free, no API key, CORS-enabled, stable
 * per seed). Centered / split templates can opt out of the hero (empty
 * seed) when the layout doesn't need it.
 */
const FLYER_TEMPLATES_BY_SECTOR_LAYOUT: Record<FlyerSector, Record<FlyerLayout, FlyerTemplatePreset>> = {
  ristorante: {
    classic: {
      title: 'Cena di Degustazione · Trattoria del Borgo',
      size: 'A5', orientation: 'portrait', layout: 'classic',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: 'ristorante-classic',
      headline: 'Cena di Degustazione',
      subheadline: 'Venerdì 15 agosto · ore 20:30',
      body: 'Menu di 5 portate dello chef Marco Bianchi, in abbinamento a 3 vini del territorio selezionati dal sommelier Anna Verdi.\n\nPosti limitati, prenotazione obbligatoria entro mercoledì 13 agosto. Coperto 45€, bevande escluse.',
      cta: { label: 'Prenota un Tavolo', url: '' },
      qrLabel: 'Scansiona per il menù completo',
    },
    centered: {
      title: 'Sapori d\'Autunno · Trattoria del Borgo',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: 'ristorante-centered',
      headline: 'Sapori d\'Autunno',
      subheadline: 'Nuova stagione, nuovi piatti',
      body: 'Dal 1 ottobre ti aspettano 4 nuovi piatti firmati dalla chef Anna Rossi: zucca, tartufo, castagne e funghi porcini.\n\nPrenota il tuo tavolo per la serata di apertura del 1 ottobre, drink di benvenuto offerto.',
      cta: { label: 'Scopri il Menù', url: '' },
      qrLabel: 'Prenota online',
    },
    split: {
      title: 'Trattoria del Borgo · Cucina di stagione',
      size: 'A4', orientation: 'portrait', layout: 'split',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: 'ristorante-split',
      headline: 'Trattoria del Borgo',
      subheadline: 'Cucina di stagione, ingredienti locali',
      body: 'Piatti della tradizione sarda rivisitati con materie prime del territorio a km 0.\n\nAperti a pranzo e cena, chiusi il lunedì. Via Roma 12, Cagliari. Tel. 070 123456.',
      cta: { label: 'Vieni a Trovarci', url: '' },
      qrLabel: 'Scansiona per la mappa',
    },
    magazine: {
      title: 'Menù della Settimana · Trattoria del Borgo',
      size: 'A4', orientation: 'portrait', layout: 'magazine',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: '',
      headline: 'Menù della Settimana',
      subheadline: 'Dal 10 al 16 agosto',
      body: 'Lunedì: Tagliatelle al ragù bianco di vitello e limone.\nMartedì: Risotto allo zafferano e midollo rosso.\nMercoledì: Tagliata di manzo con rucola e grana.',
      cta: { label: 'Prenota', url: '' },
      qrLabel: 'Menù completo online',
    },
  },
  evento: {
    classic: {
      title: 'Sagra di Paese 2026',
      size: 'A5', orientation: 'portrait', layout: 'classic',
      bgColor: '#FFFFFF', textColor: '#0F172A', accentColor: '#0F766E',
      imageSeed: 'evento-classic',
      headline: 'Sagra di Paese 2026',
      subheadline: '15, 16, 17 agosto · Piazza del Popolo',
      body: 'Tre serate di festa con cucina tipica, musica dal vivo, balli sardi e spettacoli per bambini ogni sera alle 21:30.\n\nIngresso gratuito, apertura stand gastronomici ore 19:00, chiusura ore 01:00. Parcheggio gratuito in via Garibaldi.',
      cta: { label: 'Scopri il Programma', url: '' },
      qrLabel: 'Programma completo online',
    },
    centered: {
      title: 'Festa di San Giovanni',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFFFFF', textColor: '#0F172A', accentColor: '#0F766E',
      imageSeed: 'evento-centered',
      headline: 'Festa di San Giovanni',
      subheadline: '24 giugno · Centro Storico',
      body: 'Fiaccolata per le vie del centro, concerto della banda cittadina in piazza Costituzione e gran finale con i fuochi d\'artificio a mezzanotte.\n\nApertura stand gastronomici ore 19:30, degustazione del coccoi fresco e pani pintau.',
      cta: { label: 'Guarda il Programma', url: '' },
      qrLabel: 'Mappa della festa',
    },
    split: {
      title: 'Notte Bianca · Centro Città',
      size: 'A4', orientation: 'portrait', layout: 'split',
      bgColor: '#FFFFFF', textColor: '#0F172A', accentColor: '#0F766E',
      imageSeed: 'evento-split',
      headline: 'Notte Bianca',
      subheadline: 'Sabato 5 luglio · Centro Città',
      body: 'Negozi aperti fino a mezzanotte, musica in 5 piazze, dj set finale in piazza Duomo alle 23:30.\n\nIngresso libero, parcheggio gratuito in via Roma, navetta ogni 15 minuti dalle 21:00.',
      cta: { label: 'Vedi la Mappa', url: '' },
      qrLabel: 'Mappa dei punti',
    },
    magazine: {
      title: 'Programma del Week-End',
      size: 'A4', orientation: 'portrait', layout: 'magazine',
      bgColor: '#FFFFFF', textColor: '#0F172A', accentColor: '#0F766E',
      imageSeed: '',
      headline: 'Programma del Week-End',
      subheadline: '5, 6, 7 luglio',
      body: 'Venerdì 5 · Notte Bianca, musica e negozi aperti fino a mezzanotte.\nSabato 6 · Mercatino artigianale in piazza e concerto jazz alle 21:00.\nDomenica 7 · Spettacolo per bambini alle 17:00 e cinema sotto le stelle alle 21:30.',
      cta: { label: 'Vedi gli Orari', url: '' },
      qrLabel: 'Orari completi online',
    },
  },
  salone: {
    classic: {
      title: 'Salone Bellezza · Promo Estate',
      size: 'A5', orientation: 'portrait', layout: 'classic',
      bgColor: '#FFF1F2', textColor: '#1F2937', accentColor: '#E11D48',
      imageSeed: 'salone-classic',
      headline: 'Promo Estate -20%',
      subheadline: 'Valido fino al 30 agosto',
      body: 'Taglio, piega e colore a prezzo speciale per tutta l\'estate. Trattamento cheratina incluso per i capelli colorati.\n\nPrenota il tuo appuntamento con i nostri stilisti esperti, oltre 15 anni di esperienza nel settore.',
      cta: { label: 'Prenota Ora', url: '' },
      qrLabel: 'Prenota online',
    },
    centered: {
      title: 'Nuova Apertura · Salone Centro',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFF1F2', textColor: '#1F2937', accentColor: '#E11D48',
      imageSeed: 'salone-centered',
      headline: 'Nuova Apertura',
      subheadline: '15 settembre · Salone Centro',
      body: 'Apre il nostro nuovo spazio in centro: 200mq dedicati a taglio, colore, trattamenti viso e massaggi.\n\nPrenota la tua visita gratuita con consulenza personalizzata per il tuo tipo di capelli.',
      cta: { label: 'Prenota Visita', url: '' },
      qrLabel: 'Prenota online',
    },
    split: {
      title: 'Salone Bellezza · Promo Weekend',
      size: 'A6', orientation: 'landscape', layout: 'split',
      bgColor: '#0F172A', textColor: '#F8FAFC', accentColor: '#E11D48',
      imageSeed: 'salone-split',
      headline: 'Saldi -20%',
      subheadline: 'Solo questo weekend',
      body: 'Taglio + piega + colore a 45€ invece di 56€.\nSu prenotazione, posti limitati, vieni sabato o domenica.',
      cta: { label: 'Prenota', url: '' },
      qrLabel: 'Prenota online',
    },
    magazine: {
      title: 'I Nostri Servizi · Salone Bellezza',
      size: 'A4', orientation: 'portrait', layout: 'magazine',
      bgColor: '#FFF1F2', textColor: '#1F2937', accentColor: '#E11D48',
      imageSeed: '',
      headline: 'I Nostri Servizi',
      subheadline: 'Dal 2010 a Cagliari',
      body: 'Taglio & Piega: classico, moderno, sposa, bambino.\nColore: balayage, meches, tinta, decolorazione.\nTrattamenti: cheratina, impacco ristrutturante, anticrespo.',
      cta: { label: 'Prenota', url: '' },
      qrLabel: 'Lista prezzi completa',
    },
  },
  negozio: {
    classic: {
      title: 'Boutique · Saldi di Stagione',
      size: 'A5', orientation: 'portrait', layout: 'classic',
      bgColor: '#FFFFFF', textColor: '#111827', accentColor: '#7C3AED',
      imageSeed: 'negozio-classic',
      headline: 'Saldi di Stagione',
      subheadline: 'Fino al -50% · 1-30 del mese',
      body: 'Migliaia di articoli scontati: abbigliamento, calzature e accessori uomo, donna e bambino.\n\nAcquisti in boutique e online con spedizione gratuita sopra i 50€. Resi gratuiti entro 30 giorni.',
      cta: { label: 'Vedi il Catalogo', url: '' },
      qrLabel: 'Scansiona per il catalogo',
    },
    centered: {
      title: 'Apertura Nuovo Store',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFFFFF', textColor: '#111827', accentColor: '#7C3AED',
      imageSeed: 'negozio-centered',
      headline: 'Apertura Nuovo Store',
      subheadline: 'Via Roma 23 · 20 settembre ore 18:00',
      body: 'Apre il nostro nuovo punto vendita: 300mq di collezione autunno/inverno, drink di benvenuto e sconto 10% a tutti i presenti all\'inaugurazione.\n\nApertura dal lunedì al sabato 9:30-19:30, domenica chiuso. Parcheggio convenzionato in via Manno.',
      cta: { label: 'Vieni all\'Apertura', url: '' },
      qrLabel: 'Mappa e orari',
    },
    split: {
      title: 'Boutique · Outlet -50%',
      size: 'A4', orientation: 'portrait', layout: 'split',
      bgColor: '#FFFFFF', textColor: '#111827', accentColor: '#7C3AED',
      imageSeed: 'negozio-split',
      headline: 'Outlet -50%',
      subheadline: 'Collezione primavera/estate',
      body: 'Migliaia di capi a metà prezzo: t-shirt, camicie, jeans, gonne, vestiti e accessori.\n\nSolo per questa settimana, fino ad esaurimento scorte. Taglie disponibili dalla S alla XXL.',
      cta: { label: 'Vedi l\'Outlet', url: '' },
      qrLabel: 'Lista outlet online',
    },
    magazine: {
      title: 'Le Nostre Categorie · Boutique',
      size: 'A4', orientation: 'portrait', layout: 'magazine',
      bgColor: '#FFFFFF', textColor: '#111827', accentColor: '#7C3AED',
      imageSeed: '',
      headline: 'Le Nostre Categorie',
      subheadline: 'Boutique · Autunno/Inverno 2026',
      body: 'Donna: abiti, gonne, top, maglioni, giacche, accessori.\nUomo: camicie, polo, felpe, giacche, pantaloni, scarpe.\nBambino: magliette, felpe, jeans, gonne, scarpe.',
      cta: { label: 'Vedi il Catalogo', url: '' },
      qrLabel: 'Catalogo online',
    },
  },
};

/**
 * Build a rich flyer from a (sector, layout) combination. The layout
 * is optional: if omitted, the sector's default layout is used (see
 * FLYER_SECTOR_DEFAULT_LAYOUT). The hero image is a stable picsum.photos
 * URL so the same template always renders the same photo. The image is
 * stored as a plain HTTPS string (not base64): the preview uses CSS
 * `background: url(...)` which accepts HTTP URLs, and the PDF/PNG
 * generators pass the URL to pdfmake / the Image element respectively.
 * Picsum.photos has CORS enabled so pdfmake can fetch it client-side.
 */
export function createFlyerTemplate(sector: FlyerSector, layout?: FlyerLayout): Flyer {
  const now = new Date().toISOString();
  const useLayout = layout ?? FLYER_SECTOR_DEFAULT_LAYOUT[sector];
  const tpl = FLYER_TEMPLATES_BY_SECTOR_LAYOUT[sector][useLayout];
  const heroImage = tpl.imageSeed
    ? `https://picsum.photos/seed/${tpl.imageSeed}/800/600`
    : null;
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
