export { computeFlyerLayout, magazineColumnCount, debugPlanSummary } from './layoutEngine';
export type { FlyerCopyBudget } from './budgets';
export { getFlyerCopyBudget } from './budgets';
export { renderFlyerSvg, buildFlyerSvg } from './svgRenderer';
export type { SvgRenderOptions } from './svgRenderer';
export { generateFlyerPdf } from './pdfExport';
export type { FlyerExportOptions } from './pdfExport';
export { generateFlyerPng } from './pngExport';
export {
  createFlyerTemplate,
  getSectorLabel,
  getLayoutLabel,
  getSizeLabel,
  FLYER_SECTORS,
} from './templateFactory';
export { validateLayoutPlan, isDensitySafe } from './validation';
export {
  type FlyerElementId,
  type MmRect,
  type FittedTextBlock,
  type FlyerLayoutWarning,
  type FlyerDensity,
  type FlyerLayoutPlan,
  FONT_SIZE_BOUNDS,
  SAFE_AREA_INSET_MM,
  GAP_MM,
  QR_MIN_MM,
  QR_MAX_MM_RATIO,
  HERO_HEIGHT_RATIO,
  FOOTER_H_MM,
  FOOTER_SAFE_GAP_MM,
  buildPageRects,
  normalizeContent,
  hasQrUrl,
  isCtaValid,
  emptyFitted,
  estimateTextHeight,
  wrapTextToLines,
  classDensity,
  clamp,
  rectsOverlap,
  rectInside,
  mm,
} from './geometry';
export { fitText, fitBodyText, approxCharsPerLine } from './textFit';
export { FLYER_TEMPLATES_BY_SECTOR_LAYOUT, heroBoxMmForLayout } from './templateCatalog';
export type { FlyerTemplatePreset } from './templateCatalog';
export { inlineQrSvg, escapeXmlAttr, escapeHtml, safeHex } from './qrRenderer';
