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
