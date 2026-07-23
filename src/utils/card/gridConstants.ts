/**
 * Shared grid proportions for the business card preview and export.
 *
 * Centralising these values ensures that the browser preview (CSS Grid via
 * `.card-preview-side.grid-mode`) and the SVG/PDF/PNG export stay pixel-
 * proportional. Any future adjustment to padding/gap should be made here and
 * will propagate to both renderers.
 */
export const GRID_REF_HEIGHT = 340; // px, matches CARD_PREVIEW_REF_WIDTH-derived height
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
