import type { Flyer } from '../documentSchemas';
import { FONT_SIZE_BOUNDS } from './geometry';
import { computeFlyerLayout, magazineColumnCount } from './layoutEngine';
import { charWidthMm, MM_PER_PT } from './geometry';

export interface FlyerCopyBudget {
  headlineMaxChars: number;
  subheadlineMaxChars: number;
  bodyMaxChars: number;
  bodyRecommendedParagraphs: 1 | 2 | 3;
  ctaMaxChars: number;
  qrLabelMaxChars: number;
  densityTarget: 'low' | 'medium';
  warning?: string;
}

/**
 * Compute real character budgets based on the actual layout plan.
 * Max chars are computed at the minimum readable font size (hard limit),
 * so the UI can block input beyond that. Recommended budgets are computed
 * at the maximum font size (nice-looking copy).
 */
export function getFlyerCopyBudget(flyer: Flyer): FlyerCopyBudget {
  const plan = computeFlyerLayout(flyer);
  const bounds = FONT_SIZE_BOUNDS[flyer.size];
  const bodyBox = plan.boxes.body;
  const columnCount = flyer.style.layout === 'magazine' ? magazineColumnCount(flyer.size, bodyBox?.h ?? 0) : 1;
  const bodyWidth = columnCount > 1 && bodyBox
    ? (bodyBox.w - (columnCount - 1) * 3) / columnCount
    : (bodyBox?.w ?? 50);

  function charsInBox(boxW: number, boxH: number, fontSizePt: number, lineHeight: number, kind: 'regular' | 'boldUpper' | 'boldUpperCta' | 'body'): number {
    const charsPerLine = Math.max(1, Math.floor(boxW / charWidthMm(fontSizePt, kind)));
    const maxLines = Math.max(1, Math.floor(boxH / (fontSizePt * lineHeight * MM_PER_PT)));
    return charsPerLine * maxLines;
  }

  // Headline
  const headlineBox = plan.boxes.headline;
  const headlineMaxChars = headlineBox
    ? charsInBox(headlineBox.w, headlineBox.h, bounds.headline.min, 1.1, 'boldUpper')
    : 20;
  const subBox = plan.boxes.subheadline;
  const subheadlineMaxChars = subBox
    ? charsInBox(subBox.w, subBox.h, bounds.subheadline.min, 1.2, 'boldUpper')
    : 30;

  // Body
  const bodyFontPt = bounds.body.min;
  const bodyCharsPerLine = Math.max(1, Math.floor(bodyWidth / charWidthMm(bodyFontPt, 'body')));
  const bodyMaxLines = bodyBox
    ? Math.max(1, Math.floor(bodyBox.h / (bodyFontPt * 1.3 * MM_PER_PT)))
    : 1;
  const bodyMaxChars = bodyCharsPerLine * Math.max(1, bodyMaxLines) * columnCount;

  // CTA
  const ctaBox = plan.boxes.cta;
  const ctaMaxChars = ctaBox
    ? Math.max(6, Math.floor(ctaBox.w / charWidthMm(bounds.cta.min, 'boldUpperCta')))
    : 12;

  // QR label
  const qrLabelBox = plan.boxes.qrLabel;
  const qrLabelMaxChars = qrLabelBox
    ? charsInBox(qrLabelBox.w, qrLabelBox.h, 5, 1.1, 'regular')
    : 20;

  return {
    headlineMaxChars,
    subheadlineMaxChars,
    bodyMaxChars,
    bodyRecommendedParagraphs: bodyMaxChars < 200 ? 1 : bodyMaxChars < 500 ? 2 : 3,
    ctaMaxChars,
    qrLabelMaxChars,
    densityTarget: plan.density === 'high' || plan.density === 'overflow' ? 'low' : 'medium',
    warning: plan.density === 'overflow' ? 'Il formato selezionato è troppo piccolo per il contenuto attuale.' : undefined,
  };
}