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
    title: 'QR personale — Giovanni',
    data: { type: 'url', payload: 'https://webdeveloperca.netlify.app/' },
  };
}

export function createDocumentFromQrCode(qr: QRCode, userEmail: string): QRCode & { userEmail: string } {
  return { ...qr, userEmail, updatedAt: new Date().toISOString() };
}

export const businessCardSizePresetSchema = z.enum(['eu-85x55', 'us-89x51', 'square-65x65']);
export type BusinessCardSizePreset = z.infer<typeof businessCardSizePresetSchema>;

export const businessCardLayoutSchema = z.enum(['centered', 'left', 'split']);
export type BusinessCardLayout = z.infer<typeof businessCardLayoutSchema>;

export const businessCardBorderStyleSchema = z.enum(['none', 'thin', 'accent-strip-left', 'accent-strip-bottom']);
export type BusinessCardBorderStyle = z.infer<typeof businessCardBorderStyleSchema>;

export const SIZE_PRESETS_MM: Record<BusinessCardSizePreset, { w: number; h: number }> = {
  'eu-85x55': { w: 85, h: 55 },
  'us-89x51': { w: 89, h: 51 },
  'square-65x65': { w: 65, h: 65 },
};

export const BLEED_MM = 3;
export const CARD_A4_PAGE_MM = { w: 210, h: 297 };
export const CARD_A4_COLS = 5;
export const CARD_A4_ROWS = 2;
export const CARD_A4_GAP_MM = 5;
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
  }),
  back: z.object({
    phone: z.string().default(''),
    email: z.string().default(''),
    website: z.string().default(''),
    address: z.string().default(''),
    vatNumber: z.string().default(''),
    services: z.array(z.string().max(80)).max(8).default([]),
    socials: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
    qrPayload: z.string().default(''),
    qrLabel: z.string().default('Scansiona per visitare il sito'),
  }),
  style: z.object({
    sizePreset: businessCardSizePresetSchema.default('eu-85x55'),
    bgColor: hexColorSchema.default('#FFFFFF'),
    textColor: hexColorSchema.default('#1a1a2e'),
    accentColor: hexColorSchema.default('#01696F'),
    fontFamily: z.string().default('Inter'),
    borderStyle: businessCardBorderStyleSchema.default('accent-strip-left'),
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
    },
    back: {
      phone: '',
      email: '',
      website: '',
      address: '',
      vatNumber: '',
      services: [],
      socials: [],
      qrPayload: '',
      qrLabel: 'Scansiona per visitare il sito',
    },
    style: {
      sizePreset: 'eu-85x55',
      bgColor: '#FFFFFF',
      textColor: '#1a1a2e',
      accentColor: '#01696F',
      fontFamily: 'Inter',
      borderStyle: 'accent-strip-left',
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
    title: 'Bigliettino Giovanni — Web Developer',
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
