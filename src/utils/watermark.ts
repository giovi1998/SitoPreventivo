/**
 * Phase 5 — Tier system watermark utilities.
 *
 * For `free` users, all generated PDF/PNG deliverables get a
 * diagonal text watermark "PRECISIONQUOTE" + a footer promoting
 * the platform. For `unlocked` users, the watermark is a no-op
 * and full quality is preserved.
 *
 * DPI / size limits are also gated here so generators can clamp
 * export resolution without re-implementing tier logic.
 */

export type Tier = 'free' | 'unlocked';

export const FREE_PDF_DPI = 150;
export const UNLOCKED_PDF_DPI = 300;
export const FREE_PNG_DPI = 72;
export const UNLOCKED_PNG_DPI = 300;
export const FREE_PNG_MAX_SIDE = 1200;
export const UNLOCKED_PNG_MAX_SIDE = 4096;
export const FREE_DOCUMENT_LIMIT = 3;

export const WATERMARK_TEXT = 'PRECISIONQUOTE';
export const WATERMARK_FOOTER = 'Crea il tuo con PrecisionQuote · precisionquote.vercel.app';

const WATERMARK_SPACING_X = 200;
const WATERMARK_SPACING_Y = 80;
const WATERMARK_OPACITY = 0.1;
const WATERMARK_FONT = 'Helvetica';
const WATERMARK_PDF_FONT_SIZE = 40;
const WATERMARK_PDF_GRAY: [number, number, number] = [204, 204, 204];
const FOOTER_FONT_SIZE = 10;
const FOOTER_GRAY = '#999999';

/**
 * pdfmake background functions receive `(currentPage, pageSize)` and
 * operate on a pdfmake canvas-like context. The `this` binding exposes
 * `save`, `restore`, `translate`, `rotate`, `fill`, `fillColor`, `fontSize`,
 * and `text` (printString).
 *
 * We don't import pdfmake types because the project uses `any` for
 * `TDocumentDefinitions` (no @types/pdfmain installed). Callers pass
 * in their own `docDefinition` and we return a new one with the
 * watermark pre-attached.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyWatermarkToPdf<T extends Record<string, any>>(
  doc: T,
  tier: Tier
): T {
  if (tier === 'unlocked') return doc;
  return {
    ...doc,
    background: pdfWatermarkBackground(),
    footer: pdfWatermarkFooter(),
  } as T;
}

function pdfWatermarkBackground() {
  return function (this: any, _currentPage: number, pageSize: { width: number; height: number }) {
    const ctx = this;
    ctx.save();
    ctx.translate(pageSize.width / 2, pageSize.height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillColor(WATERMARK_PDF_GRAY[0], WATERMARK_PDF_GRAY[1], WATERMARK_PDF_GRAY[2]);
    ctx.fillOpacity(WATERMARK_OPACITY);
    ctx.fontSize(WATERMARK_PDF_FONT_SIZE);
    const cols = Math.ceil((pageSize.width * 2) / WATERMARK_SPACING_X) + 2;
    const rows = Math.ceil((pageSize.height * 2) / WATERMARK_SPACING_Y) + 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -pageSize.width + c * WATERMARK_SPACING_X;
        const y = -pageSize.height + r * WATERMARK_SPACING_Y;
        ctx.text(WATERMARK_TEXT, x, y);
      }
    }
    ctx.fillOpacity(1);
    ctx.restore();
  };
}

function pdfWatermarkFooter() {
  return function (this: any, _currentPage: number, pageSize: { width: number; height: number }) {
    const ctx = this;
    ctx.save();
    ctx.fillColor(FOOTER_GRAY);
    ctx.fontSize(FOOTER_FONT_SIZE - 2);
    ctx.text(
      WATERMARK_FOOTER,
      { x: 0, y: pageSize.height - 20, width: pageSize.width, align: 'center' }
    );
    ctx.restore();
  };
}

/**
 * Apply watermark to a Canvas2D rendering context. Draws the same
 * diagonal pattern + footer as `applyWatermarkToPdf`, but on a
 * raster surface (used for PNG exports).
 *
 * Caller MUST have finished drawing the actual content before
 * invoking this — we paint on top.
 */
export function applyWatermarkToCanvas(
  ctx: CanvasRenderingContext2D,
  tier: Tier,
  width: number,
  height: number
): void {
  if (tier === 'unlocked') return;
  ctx.save();
  ctx.globalAlpha = WATERMARK_OPACITY;
  ctx.fillStyle = FOOTER_GRAY;
  ctx.font = `bold 20px sans-serif`;
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  const cols = Math.ceil((width * 2) / WATERMARK_SPACING_X) + 2;
  const rows = Math.ceil((height * 2) / WATERMARK_SPACING_Y) + 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -width + c * WATERMARK_SPACING_X;
      const y = -height + r * WATERMARK_SPACING_Y;
      ctx.fillText(WATERMARK_TEXT, x, y);
    }
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = FOOTER_GRAY;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(WATERMARK_FOOTER, width / 2, height - 4);
  ctx.restore();
}

/**
 * Clamp the DPI used for an export to the tier limit.
 * - PDF: unlocked=300, free=150
 * - PNG: unlocked=300, free=72
 */
export function getDpiForTier(tier: Tier, defaultDpi: number, media: 'pdf' | 'png' = 'pdf'): number {
  if (tier === 'unlocked') return defaultDpi;
  const cap = media === 'pdf' ? FREE_PDF_DPI : FREE_PNG_DPI;
  return Math.min(defaultDpi, cap);
}

/**
 * Clamp the max side length (in pixels) of a PNG export to the tier
 * limit. Free = 1200, unlocked = 4096.
 */
export function getMaxPngSideForTier(tier: Tier): number {
  return tier === 'unlocked' ? UNLOCKED_PNG_MAX_SIDE : FREE_PNG_MAX_SIDE;
}

/**
 * Tier limit for saved documents (free users only). Null = unlimited.
 */
export function getDocumentLimitForTier(tier: Tier): number | null {
  return tier === 'unlocked' ? null : FREE_DOCUMENT_LIMIT;
}

/**
 * Mask an unlock code for display in SettingsPage: first 4 chars + "****".
 * E.g. `PQ-ABCDEFGH-12345678-AAAAFFFF` → `PQ-A****`.
 */
export function maskUnlockCode(code: string | null | undefined): string {
  if (!code) return '****';
  const trimmed = code.trim();
  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 4)}****`;
}
