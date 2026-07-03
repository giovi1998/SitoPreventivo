// Unit constants shared by card export modules.
// pdfmake uses points (1 pt = 1/72 inch = 25.4/72 mm).
export const MM_TO_PT = 72 / 25.4;

export function mm2pt(mm: number): number {
  return mm * MM_TO_PT;
}

export const BLEED_HALF_MM = 1.5;
export const TARGET_PX_PER_MM = 4;
export const QR_RENDER_PX = 512;
