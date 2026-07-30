import { z } from 'zod';

// Shared helpers/types used across the per-document schema modules.
// Split out of src/utils/documentSchemas.ts (pure code move, no logic
// changes). The facade re-exports only the symbols that were public
// before the split; `hexColorSchema` stays module-internal.

export const documentTypeSchema = z.enum(['quote', 'qrCode', 'businessCard', 'flyer', 'logo', 'generatedImage']);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido (formato #RRGGBB)');

// Phase 2.2 REQ-D04: scala globale del testo della card (1 = default).
// Range ridotto (0.7–1.5) per evitare layout che rompono la card.
export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 1.5;
export const FONT_SCALE_STEP = 0.05;
export const FONT_SCALE_DEFAULT = 1;

export const GIOVANNI_PERSONAL_URL = 'https://giovannicidu.vercel.app';
