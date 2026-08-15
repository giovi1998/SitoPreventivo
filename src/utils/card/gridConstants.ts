/**
 * Shared grid proportions for the business card preview and export.
 *
 * Centralising these values ensures that the browser preview (CSS Grid via
 * `.card-preview-side.grid-mode`) and the SVG/PDF/PNG export stay pixel-
 * proportional. Any future adjustment to padding/gap should be made here and
 * will propagate to both renderers.
 */

/**
 * THE single reference frame shared by preview and export.
 * Matches the preview surface: CARD_PREVIEW_REF_WIDTH=640 logical px wide,
 * 640×55/85 = 414 tall on the eu-85x55 preset. Every export size expressed
 * as "logical px on the preview" must be scaled by pxH/CARD_REF.h (height)
 * or pxW/CARD_REF.w (width) — never by the legacy /340, /512 denominators,
 * which made the export render ~22% larger than the preview.
 */
export const CARD_REF = { w: 640, h: 414 } as const;

export const GRID_REF_HEIGHT = CARD_REF.h; // legacy alias, kept for existing imports
export const GRID_PAD_REF = 16; // px, outer padding of the grid area
export const GRID_GAP_REF = 4; // px, gap between grid cells
export const GRID_TEXT_PAD_X_REF = 10; // px, horizontal cell padding for text
export const GRID_TEXT_PAD_Y_REF = 6; // px, vertical cell padding for text
export const GRID_PHOTO_BORDER_REF = 2; // px, border around photo/logo cells

/**
 * Scale a reference pixel value to export coordinates for a card of height `pxH`.
 */
export function gridScale(pxH: number, refValue: number): number {
  return Math.max(1, Math.round(pxH * (refValue / GRID_REF_HEIGHT)));
}
