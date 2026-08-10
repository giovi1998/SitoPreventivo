import type { Flyer } from '../documentSchemas';
import { scaledFontBounds, type MmRect } from './geometry';
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
  /** Caratteri che effettivamente entrano al font reale scelto dal layout engine. */
  realHeadlineChars?: number;
  realSubheadlineChars?: number;
  realBodyChars?: number;
  /** Budget conservativo per il prompt AI: capacità al font MASSIMO con
   * margine di sicurezza. bodyMaxChars è calcolato al font minimo (hard
   * limit UI) ma un copy di quella lunghezza non entra al font reale e
   * viene clippato in anteprima (gotcha §7.6, design review auto-build). */
  bodyPromptMaxChars: number;
  /** True se il testo corrente viene troncato dal layout engine. */
  headlineTruncated?: boolean;
  subheadlineTruncated?: boolean;
  bodyTruncated?: boolean;
}

/**
 * Compute real character budgets based on the actual layout plan.
 * Max chars are computed at the minimum readable font size (hard limit),
 * so the UI can block input beyond that. Recommended budgets are computed
 * at the maximum font size (nice-looking copy).
 */
export function getFlyerCopyBudget(flyer: Flyer): FlyerCopyBudget {
  const plan = computeFlyerLayout(flyer);
  const bounds = scaledFontBounds(flyer.size, flyer.style.fontScale);
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

  // Budget per il prompt AI: stessa formula ma al font MASSIMO (quello che
  // il layout engine usa quando il copy ci sta) e con margine 0.85 per il
  // drift delle metriche reali (fontFamily Inter vs calibrazione Arial:
  // righe pre-wrapped più larghe del previsto → wrap CSS extra in
  // foreignObject → clip a metà riga senza ellipsis).
  const PROMPT_BUDGET_SAFETY = 0.85;
  const promptCharsPerLine = Math.max(1, Math.floor(bodyWidth / charWidthMm(bounds.body.max, 'body')));
  const promptMaxLines = bodyBox
    ? Math.max(1, Math.floor(bodyBox.h / (bounds.body.max * 1.3 * MM_PER_PT)))
    : 1;
  const bodyPromptMaxChars = Math.floor(promptCharsPerLine * promptMaxLines * columnCount * PROMPT_BUDGET_SAFETY);

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

  // Real char budgets at the font size the layout engine actually chose.
  // These reflect what really fits in the box for the current text.
  function realCharsFor(block: { fontSizePt: number; lines: string[] }, box: MmRect | undefined, lineHeight: number, kind: 'regular' | 'boldUpper' | 'boldUpperCta' | 'body'): number {
    if (!box || !block.fontSizePt) return 0;
    const charsPerLine = Math.max(1, Math.floor((box.w - 1) / charWidthMm(block.fontSizePt, kind)));
    const glyphH = block.fontSizePt * 1.15 * MM_PER_PT;
    const lineH = block.fontSizePt * lineHeight * MM_PER_PT;
    const maxLines = Math.max(1, Math.floor((box.h - glyphH) / lineH) + 1);
    return charsPerLine * maxLines;
  }
  const realHeadlineChars = realCharsFor(
    { fontSizePt: plan.text.headline.fontSizePt, lines: plan.text.headline.lines },
    plan.boxes.headline, 1.1, 'boldUpper',
  );
  const realSubheadlineChars = realCharsFor(
    { fontSizePt: plan.text.subheadline.fontSizePt, lines: plan.text.subheadline.lines },
    plan.boxes.subheadline, 1.2, 'regular',
  );
  const realBodyChars = realCharsFor(
    { fontSizePt: plan.text.body.fontSizePt, lines: plan.text.body.lines },
    plan.boxes.body, 1.3, 'body',
  );

  return {
    headlineMaxChars,
    subheadlineMaxChars,
    bodyMaxChars,
    bodyPromptMaxChars,
    bodyRecommendedParagraphs: bodyMaxChars < 200 ? 1 : bodyMaxChars < 500 ? 2 : 3,
    ctaMaxChars,
    qrLabelMaxChars,
    densityTarget: plan.density === 'high' || plan.density === 'overflow' ? 'low' : 'medium',
    warning: plan.density === 'overflow' ? 'Il formato selezionato è troppo piccolo per il contenuto attuale.' : undefined,
    realHeadlineChars,
    realSubheadlineChars,
    realBodyChars,
    headlineTruncated: plan.text.headline.truncated,
    subheadlineTruncated: plan.text.subheadline.truncated,
    bodyTruncated: plan.text.body.truncated,
  };
}