import type { FlyerElementId, FittedTextBlock, MmRect, FlyerLayoutWarning } from './geometry';
import { wrapTextToLines, emptyFitted, clamp, charWidthMm, measureTextWidth, BOX_SAFETY_MM, GLYPH_HEIGHT_FACTOR } from './geometry';

export interface FitTextOptions {
  id: FlyerElementId;
  text: string;
  box: MmRect;
  minFontSizePt: number;
  maxFontSizePt: number;
  lineHeight: number;
  align?: 'left' | 'center';
  upperCase?: boolean;
  hidden?: boolean;
  maxLines?: number;
  debugName?: string;
  kind?: 'regular' | 'boldUpper' | 'boldUpperCta' | 'body';
}

const MM_PER_PT = 0.352777778;

function lineCountFits(lines: string[], fontSizePt: number, lineHeight: number, boxH: number): boolean {
  // Last line only needs glyph height; previous lines need full line height.
  if (lines.length === 0) return true;
  const glyphH = fontSizePt * GLYPH_HEIGHT_FACTOR * MM_PER_PT;
  const lineH = fontSizePt * lineHeight * MM_PER_PT;
  const neededH = (lines.length - 1) * lineH + glyphH;
  return neededH <= boxH;
}

const WIDTH_SAFETY: Record<NonNullable<FitTextOptions['kind']>, number> = {
  regular: 1.0,
  body: 1.0,
  boldUpper: 1.0,
  boldUpperCta: 1.0,
};

function linesFitWidth(lines: string[], boxW: number, fontSizePt: number, kind: FitTextOptions['kind']): boolean {
  if (!lines.length) return true;
  const k = kind || 'regular';
  return lines.every((line) => measureTextWidth(line, fontSizePt, k) * WIDTH_SAFETY[k] <= boxW);
}

function truncateLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[kept.length - 1];
  if (last) {
    kept[kept.length - 1] = last.length > 3 ? last.slice(0, -3) + '…' : last;
  }
  return kept;
}

function makeWarning(id: FlyerElementId, name: string, kind: 'truncated' | 'hidden'): FlyerLayoutWarning {
  const codeMap: Record<typeof kind, FlyerLayoutWarning['code']> = {
    truncated: `${id}_truncated` as FlyerLayoutWarning['code'],
    hidden: `${id}_hidden` as FlyerLayoutWarning['code'],
  };
  return {
    code: codeMap[kind],
    severity: 'warning',
    message: kind === 'truncated'
      ? `${name}: testo troppo lungo, riduci o scegli un formato più grande.`
      : `${name}: nascosto per mancanza di spazio.`,
    element: id,
  };
}

/**
 * Fit text by shrinking font size from max to min in 0.5pt steps.
 * At each step, rewrap text and check if it fits in the box (line count + height).
 * Only truncate as a last resort at min font size.
 */
export function fitText(opts: FitTextOptions): { block: FittedTextBlock; warnings: FlyerLayoutWarning[] } {
  const warnings: FlyerLayoutWarning[] = [];
  if (opts.hidden || !opts.text) {
    return { block: emptyFitted(opts.minFontSizePt), warnings };
  }

  const displayText = opts.upperCase ? opts.text.toUpperCase() : opts.text;
  const kind = opts.kind || (opts.upperCase ? 'boldUpper' : 'regular');
  const fitBoxW = Math.max(3, opts.box.w - BOX_SAFETY_MM);

  // Try font sizes from max to min, step 0.5pt
  let fontSizePt = opts.maxFontSizePt;
  while (fontSizePt >= opts.minFontSizePt) {
    const lines = wrapTextToLines(displayText, fitBoxW, fontSizePt, true, kind);
    const maxLinesAtThisFont = opts.maxLines !== undefined
      ? Math.min(opts.maxLines, Math.max(1, Math.floor(opts.box.h / (fontSizePt * opts.lineHeight * MM_PER_PT))))
      : Math.max(1, Math.floor(opts.box.h / (fontSizePt * opts.lineHeight * MM_PER_PT)));
    const fits = lines.length <= maxLinesAtThisFont
      && lineCountFits(lines, fontSizePt, opts.lineHeight, opts.box.h)
      && linesFitWidth(lines, fitBoxW, fontSizePt, kind);
    if (fits) {
      return {
        block: {
          text: lines.join('\n'),
          fontSizePt,
          lineHeight: opts.lineHeight,
          lines,
          truncated: false,
          hidden: false,
        },
        warnings: [],
      };
    }
    fontSizePt -= 0.5;
  }

  // Last resort: at min font size, truncate to max lines that fit
  const minFont = opts.minFontSizePt;
  const lines = wrapTextToLines(displayText, fitBoxW, minFont, true, kind);
  const maxLinesAtMin = opts.maxLines !== undefined
    ? Math.min(opts.maxLines, Math.max(1, Math.floor(opts.box.h / (minFont * opts.lineHeight * MM_PER_PT))))
    : Math.max(1, Math.floor(opts.box.h / (minFont * opts.lineHeight * MM_PER_PT)));
  const maxLinesByRealHeight = Math.max(1, Math.floor((opts.box.h - minFont * GLYPH_HEIGHT_FACTOR * MM_PER_PT) / (minFont * opts.lineHeight * MM_PER_PT)) + 1);
  const effectiveMaxLines = Math.min(maxLinesAtMin, maxLinesByRealHeight);
  const visibleLines = truncateLines(lines, effectiveMaxLines);
  const truncated = lines.length > visibleLines.length;

  if (truncated) {
    warnings.push(makeWarning(opts.id, opts.debugName || opts.id, 'truncated'));
  }

  return {
    block: {
      text: visibleLines.join('\n'),
      fontSizePt: minFont,
      lineHeight: opts.lineHeight,
      lines: visibleLines,
      truncated,
      hidden: false,
    },
    warnings,
  };
}

function ellipsisMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const keep = Math.max(3, Math.floor((maxChars - 1) / 2));
  return `${text.slice(0, keep)}…${text.slice(-keep)}`;
}

export function fitCtaText(
  label: string,
  box: MmRect,
  minFontSizePt: number,
  maxFontSizePt: number,
): { text: string; fontSizePt: number; truncated: boolean } {
  if (!label) return { text: '', fontSizePt: minFontSizePt, truncated: false };
  const display = label.toUpperCase();
  const fitBoxW = Math.max(3, box.w - BOX_SAFETY_MM);
  let fontSizePt = maxFontSizePt;
  while (fontSizePt >= minFontSizePt) {
    const width = measureTextWidth(display, fontSizePt, 'boldUpperCta');
    if (width <= fitBoxW) {
      return { text: display, fontSizePt, truncated: false };
    }
    fontSizePt -= 0.5;
  }
  // Last resort: shrink to min and truncate with middle ellipsis if still too long.
  const minWidth = measureTextWidth(display, minFontSizePt, 'boldUpperCta');
  if (minWidth <= fitBoxW) {
    return { text: display, fontSizePt: minFontSizePt, truncated: false };
  }
  const charWidth = charWidthMm(minFontSizePt, 'boldUpperCta');
  const maxChars = Math.max(5, Math.floor(fitBoxW / charWidth));
  return { text: ellipsisMiddle(display, maxChars), fontSizePt: minFontSizePt, truncated: true };
}

/**
 * Fit body text with progressive font shrinking and multi-column support.
 */
export function fitBodyText(
  text: string,
  box: MmRect,
  minFontSizePt: number,
  maxFontSizePt: number,
  lineHeight: number,
  columnCount: number,
  maxLines?: number,
): { block: FittedTextBlock; warnings: FlyerLayoutWarning[] } {
  if (!text) return { block: emptyFitted(minFontSizePt), warnings: [] };

  const colW = columnCount > 1 ? (box.w - (columnCount - 1) * 3) / columnCount : box.w;

  // Try font sizes from max to min, step 0.5pt
  let fontSizePt = maxFontSizePt;
  while (fontSizePt >= minFontSizePt) {
    const lineHeightMm = fontSizePt * lineHeight * MM_PER_PT;
    const glyphH = fontSizePt * GLYPH_HEIGHT_FACTOR * MM_PER_PT;
    const maxLinesByHeight = Math.max(1, Math.floor((box.h - glyphH) / lineHeightMm) + 1);
    const maxLinesTotal = maxLines !== undefined ? Math.min(maxLines, maxLinesByHeight) : maxLinesByHeight;
    const lines = wrapBodyLines(text, colW, fontSizePt);
    if (lines.length <= maxLinesTotal) {
      return {
        block: { text: lines.join('\n'), fontSizePt, lineHeight, lines, truncated: false, hidden: false },
        warnings: [],
      };
    }
    fontSizePt -= 0.5;
  }

  // Last resort: min font, truncate
  const minFont = minFontSizePt;
  const lineHeightMm = minFont * lineHeight * MM_PER_PT;
  const glyphH = minFont * GLYPH_HEIGHT_FACTOR * MM_PER_PT;
  const maxLinesByHeight = Math.max(1, Math.floor((box.h - glyphH) / lineHeightMm) + 1);
  const maxLinesTotal = maxLines !== undefined ? Math.min(maxLines, maxLinesByHeight) : maxLinesByHeight;
  const lines = wrapBodyLines(text, colW, minFont);
  const kept = truncateLines(lines, maxLinesTotal);
  const truncated = lines.length > kept.length;

  return {
    block: { text: kept.join('\n'), fontSizePt: minFont, lineHeight, lines: kept, truncated, hidden: false },
    warnings: truncated
      ? [{ code: 'body_truncated', severity: 'warning', message: 'Corpo del testo troppo lungo: riduci o scegli un formato più grande.', element: 'body' }]
      : [],
  };
}

function wrapBodyLines(text: string, colW: number, fontSizePt: number): string[] {
  const safeW = Math.max(3, colW - BOX_SAFETY_MM);
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    if (!para) continue;
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (!w) continue;
      const wordWidth = measureTextWidth(w, fontSizePt, 'body');
      if (wordWidth > safeW) {
        if (line) { out.push(line); line = ''; }
        let frag = '';
        for (const ch of w) {
          const next = frag + ch;
          if (measureTextWidth(next, fontSizePt, 'body') > safeW && frag) {
            out.push(frag);
            frag = ch;
          } else {
            frag = next;
          }
        }
        if (frag) line = frag;
        continue;
      }
      const nextLine = line ? `${line} ${w}` : w;
      if (line && measureTextWidth(nextLine, fontSizePt, 'body') > safeW) {
        out.push(line);
        line = w;
      } else {
        line = nextLine;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export function approxCharsPerLine(widthMm: number, fontSizePt: number): number {
  return Math.max(3, Math.floor(widthMm / (0.42 * fontSizePt * MM_PER_PT)));
}