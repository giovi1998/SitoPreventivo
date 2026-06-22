import { z } from 'zod';

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido (formato #RRGGBB)');

export const aiCardInputSchema = z.object({
  front: z.object({
    name: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    photoUrl: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    layout: z.enum(['centered', 'left', 'split']).optional(),
  }).optional(),

  back: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    vatNumber: z.string().optional(),
    socials: z.array(z.object({
      platform: z.string(),
      url: z.string(),
    })).optional(),
    qrPayload: z.string().optional(),
    qrLabel: z.string().optional(),
  }).optional(),

  style: z.object({
    sizePreset: z.enum(['eu-85x55', 'us-89x51', 'square-65x65']).optional(),
    bgColor: hexColorSchema.optional(),
    textColor: hexColorSchema.optional(),
    accentColor: hexColorSchema.optional(),
    fontFamily: z.string().optional(),
    borderStyle: z.enum(['none', 'thin', 'accent-strip-left', 'accent-strip-bottom']).optional(),
  }).optional(),

  grid: z.object({
    cols: z.number().min(2).max(8).optional(),
    rows: z.number().min(2).max(8).optional(),
    elements: z.object({
      photo: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
      name: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
      title: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
      company: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
      qr: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
      contacts: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
      socials: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
    }).optional(),
  }).optional(),
});

export type AICardInput = z.infer<typeof aiCardInputSchema>;
