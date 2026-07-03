import {
  SIZE_PRESETS_MM,
  CARD_A4_COLS,
  CARD_A4_ROWS,
  CARD_A4_GAP_MM,
  CARD_A4_MARGIN_MM,
} from '../documentSchemas';
import type { BusinessCard } from '../documentSchemas';

export interface PageCardEntry {
  x: number; // mm top-left X on the A4 page (trim, no bleed)
  y: number; // mm top-left Y on the A4 page (trim, no bleed)
  w: number; // mm trim width (= cardW)
  h: number; // mm trim height (= cardH)
}

export interface PageLayout {
  entries: PageCardEntry[];
  pageOrientation: 'portrait' | 'landscape';
}

export function getCardDimensionsMm(card: BusinessCard): { w: number; h: number } {
  return SIZE_PRESETS_MM[card.style.sizePreset];
}

// Build a 2×5 (10-up) tile grid. `entry.w/h` are the trim dimensions
// (cardW × cardH). Bleed is NOT doubled per card: the GAP between tiles
// is the shared bleed (= CARD_A4_GAP_MM = BLEED_MM). The bg rect drawn
// underneath extends BLEED_MM/2 outward into the gap/page margin so the
// final cut line sits at the gap midpoint with proper bleed on both
// sides. Page is chosen adaptively: portrait A4 if 10 tiles fit, else
// landscape A4 (still 2×5 arrangement).
export function computePageCardEntries(cardW: number, cardH: number): PageLayout {
  // Cards are rotated 90° (clockwise) in the sheet: the long side
  // (cardW) becomes vertical, the short side (cardH) horizontal.
  // Therefore on the page the tile occupies (cardH × cardW) mm.
  const tileW = cardH;
  const tileH = cardW;
  // 5 columns × 2 rows on A4 landscape (297×210mm) with GAP=BLEED=3mm
  // and rotated tile. Math for EU 85×55: trimW = 5*55+4*3 = 287<297
  // (margin 5mm×2), trimH = 2*85+3 = 173<210 (margin 18.5mm×2).
  const build = (pageW: number, pageH: number): PageLayout => {
    const trimW = CARD_A4_COLS * tileW + (CARD_A4_COLS - 1) * CARD_A4_GAP_MM;
    const trimH = CARD_A4_ROWS * tileH + (CARD_A4_ROWS - 1) * CARD_A4_GAP_MM;
    const offsetX = (pageW - trimW) / 2;
    const offsetY = (pageH - trimH) / 2;
    const entries: PageCardEntry[] = [];
    for (let r = 0; r < CARD_A4_ROWS; r++) {
      for (let c = 0; c < CARD_A4_COLS; c++) {
        entries.push({
          x: offsetX + c * (tileW + CARD_A4_GAP_MM),
          y: offsetY + r * (tileH + CARD_A4_GAP_MM),
          w: tileW,
          h: tileH,
        });
      }
    }
    return { entries, pageOrientation: pageH >= pageW ? 'portrait' : 'landscape' };
  };
  // A4 landscape 297×210 is the primary layout (5×2 with rotated cards).
  const landscape = build(297, 210);
  const fits = landscape.entries.every(
    (e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= 297 && e.y + e.h <= 210,
  );
  if (fits) return landscape;
  // Fallback portrait A4 (rare: very large cards where 5×2 landscape
  // doesn't fit, e.g. 2 rows × 85=170 > 210? Never for supported presets).
  return build(210, 297);
}

export {
  SIZE_PRESETS_MM,
  CARD_A4_COLS,
  CARD_A4_ROWS,
  CARD_A4_GAP_MM,
  CARD_A4_MARGIN_MM,
};
