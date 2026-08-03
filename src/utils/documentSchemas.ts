// Thin facade — the implementation was split into per-document modules
// under src/utils/schemas/ (pure code move, no logic changes):
//   shared.ts  documentTypeSchema/DocumentType, FONT_SCALE_*, GIOVANNI_PERSONAL_URL
//   qr.ts      QR schemas + factories + mergeQrWithDefaults
//   card.ts    business card schemas, grid presets, factories, mergeCardWithDefaults
//   logo.ts    logo schemas + factories + mergeLogoWithDefaults
//   flyer.ts   flyer schemas + factories + mergeFlyerWithDefaults
//   social.ts  social pack schemas + createEmptySocialPack
// This file re-exports the exact public API the monolith had, so no
// import site needs to change. `hexColorSchema` (schemas/shared.ts)
// stays module-internal, as it was before the split.

export * from './schemas/qr';
export * from './schemas/card';
export * from './schemas/logo';
export * from './schemas/flyer';
export * from './schemas/social';
export * from './schemas/website';

export {
  documentTypeSchema,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  FONT_SCALE_DEFAULT,
  GIOVANNI_PERSONAL_URL,
} from './schemas/shared';
export type { DocumentType } from './schemas/shared';
