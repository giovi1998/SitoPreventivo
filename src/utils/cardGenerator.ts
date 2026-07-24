// Compatibility barrel: re-exports the public card utility API from
// focused submodules under `src/utils/card/`. This preserves existing
// imports from `src/utils/cardGenerator` while the implementation lives
// in smaller, testable modules.
export {
  buildCardSvg,
  buildFrontSvg,
  buildBackSvg,
  buildEmbeddedFontImport,
  buildSvgFontImport,
  fs,
  escapeXml,
  extractQrInner,
} from './card/svgRenderer';
export { generateCardPDF } from './card/pdfExport';
export { generateCardPng, renderCardSideDataUrl, buildMinimalPng, resolveToBase64DataUrl } from './card/pngExport';
export { compressImage, loadImage, type CompressImageOptions } from './card/imageCompress';
export { resolveCardQrPayload, getEffectiveQrPayload } from './card/qrPayload';
export {
  computePageCardEntries,
  getCardDimensionsMm,
  type PageLayout,
  type PageCardEntry,
} from './card/pdfLayout';
export {
  SIZE_PRESETS_MM,
  BLEED_MM,
  CARD_A4_COLS,
  CARD_A4_ROWS,
  CARD_A4_GAP_MM,
  CARD_A4_MARGIN_MM,
} from './documentSchemas';
