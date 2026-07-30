// Facade: the card SVG renderer is split into focused modules —
// `frontSvg.ts` (buildFrontSvg), `backSvg.ts` (buildBackSvg),
// `fontEmbed.ts` (Google Fonts @import / base64 embedding) and
// `svgShared.ts` (fs, svgFontFamily, wrap, debug boxes, BuildSvgOptions).
// This file re-exports the exact public API it had before the split so no
// import site changes, and keeps `buildCardSvg` (front/back composition +
// font import + rotation wrapper) here.
import type { BusinessCard } from '../documentSchemas';
import { buildSvgFontImport } from './fontEmbed';
import { buildFrontSvg } from './frontSvg';
import { buildBackSvg } from './backSvg';
import type { BuildSvgOptions } from './svgShared';

export {
  fs,
  svgFontFamily,
  isLightColor,
  wrapTextAtWhitespace,
  extractQrInner,
  escapeXml,
} from './svgShared';
export type { BuildSvgOptions } from './svgShared';
export {
  GOOGLE_FONTS_BASE,
  FONT_TO_GOOGLE_URL,
  buildSvgFontImport,
  buildEmbeddedFontImport,
} from './fontEmbed';
export { buildFrontSvg } from './frontSvg';
export { buildBackSvg } from './backSvg';

/**
 * Build a standalone SVG representation of one side of the card at the given pixel dimensions.
 */
export function buildCardSvg(
  card: BusinessCard,
  side: 'front' | 'back',
  pxW: number,
  pxH: number,
  opts: BuildSvgOptions = {},
): string {
  const rotate = opts.rotate ?? 0;
  const fontImport = opts.embeddedFontCss || buildSvgFontImport(card.style.fontFamily || 'Inter');
  const inner = side === 'front' ? buildFrontSvg(card, pxW, pxH, opts) : buildBackSvg(card, pxW, pxH, opts);
  const head = fontImport ? `${fontImport}${inner}` : inner;
  if (rotate === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${pxW} ${pxH}" width="${pxW}" height="${pxH}">${head}</svg>`;
  }
  const outW = rotate === 90 || rotate === 270 ? pxH : pxW;
  const outH = rotate === 90 || rotate === 270 ? pxW : pxH;
  const tx = rotate === 90 ? pxH : rotate === 180 ? pxW : 0;
  const ty = rotate === 180 ? pxH : rotate === 270 ? pxW : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${outW} ${outH}" width="${outW}" height="${outH}">${fontImport}<g transform="translate(${tx} ${ty}) rotate(${rotate})">${inner}</g></svg>`;
}
