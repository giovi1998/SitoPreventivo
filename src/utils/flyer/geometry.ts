import type { Flyer, FlyerLayout, FlyerSize, FlyerOrientation } from '../documentSchemas';
import { getFlyerDimensions, FLYER_BLEED_MM, FONT_SCALE_MIN, FONT_SCALE_MAX } from '../documentSchemas';

export type FlyerElementId =
  | 'hero'
  | 'headline'
  | 'subheadline'
  | 'accent'
  | 'body'
  | 'cta'
  | 'qr'
  | 'qrLabel';

export interface MmRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FittedTextBlock {
  text: string;
  fontSizePt: number;
  lineHeight: number;
  lines: string[];
  truncated: boolean;
  hidden: boolean;
}

export interface FlyerLayoutWarning {
  code:
    | 'headline_truncated'
    | 'subheadline_truncated'
    | 'body_truncated'
    | 'cta_truncated'
    | 'qr_label_hidden'
    | 'qr_hidden'
    | 'layout_overflow'
    | 'headline_hidden'
    | 'subheadline_hidden'
    | 'body_hidden'
    | 'cta_hidden'
    | 'hero_hidden';
  severity: 'info' | 'warning' | 'error';
  message: string;
  element?: FlyerElementId;
}

export type FlyerDensity = 'low' | 'medium' | 'high' | 'overflow';

export interface FlyerLayoutPlan {
  page: { total: MmRect; trim: MmRect; safe: MmRect; bleedMm: number };
  layout: FlyerLayout;
  size: FlyerSize;
  orientation: FlyerOrientation;
  density: FlyerDensity;
  textArea: MmRect;
  boxes: Partial<Record<FlyerElementId, MmRect>>;
  text: {
    headline: FittedTextBlock;
    subheadline: FittedTextBlock;
    body: FittedTextBlock;
    cta: FittedTextBlock;
    qrLabel: FittedTextBlock;
  };
  visibility: Record<FlyerElementId, boolean>;
  warnings: FlyerLayoutWarning[];
  /** Has this element's content exceeded its box? */
  overflowFlags: Record<string, boolean>;
}

export const FONT_SIZE_BOUNDS: Record<FlyerSize, {
  headline: { min: number; max: number };
  subheadline: { min: number; max: number };
  body: { min: number; max: number };
  cta: { min: number; max: number };
}> = {
  A6: { headline: { min: 24, max: 28 }, subheadline: { min: 12, max: 14 }, body: { min: 10, max: 11 }, cta: { min: 10, max: 11 } },
  A5: { headline: { min: 24, max: 30 }, subheadline: { min: 12, max: 15 }, body: { min: 10, max: 11 }, cta: { min: 10, max: 11 } },
  A4: { headline: { min: 24, max: 44 }, subheadline: { min: 12, max: 22 }, body: { min: 10, max: 13 }, cta: { min: 10, max: 13 } },
  Letter: { headline: { min: 24, max: 42 }, subheadline: { min: 12, max: 21 }, body: { min: 10, max: 13 }, cta: { min: 10, max: 13 } },
  Square: { headline: { min: 24, max: 34 }, subheadline: { min: 12, max: 17 }, body: { min: 10, max: 11 }, cta: { min: 10, max: 11 } },
};

// Absolute print legibility floors (pt). fontScale must never push a
// minimum below these values (docs/design-criteria.md).
export const PRINT_FONT_MIN_PT = { headline: 24, subheadline: 12, body: 10, cta: 10 } as const;

/**
 * Font bounds scaled by the user's fontScale, with minimums clamped to the
 * absolute print floors. Shared by the layout engine and the copy budget so
 * the UI allowance always matches real layout capacity.
 */
export function scaledFontBounds(size: FlyerSize, fontScale: number | undefined): (typeof FONT_SIZE_BOUNDS)[FlyerSize] {
  const raw = FONT_SIZE_BOUNDS[size];
  const scale = clamp(fontScale ?? 1, FONT_SCALE_MIN, FONT_SCALE_MAX);
  const entry = (b: { min: number; max: number }, floor: number) => {
    const min = Math.max(b.min * scale, floor);
    return { min, max: Math.max(b.max * scale, min) };
  };
  return {
    headline: entry(raw.headline, PRINT_FONT_MIN_PT.headline),
    subheadline: entry(raw.subheadline, PRINT_FONT_MIN_PT.subheadline),
    body: entry(raw.body, PRINT_FONT_MIN_PT.body),
    cta: entry(raw.cta, PRINT_FONT_MIN_PT.cta),
  };
}

export const SAFE_AREA_INSET_MM = 5;
export const GAP_MM = 3;
export const CTA_BUTTON_H_MM = 7;
export const CTA_BUTTON_MIN_W_MM = 24;
export const CTA_BUTTON_MAX_W_RATIO = 0.6;
export const QR_MIN_MM: Record<FlyerSize, number> = { A6: 16, A5: 18, A4: 18, Letter: 18, Square: 16 };
export const QR_MAX_MM_RATIO = 0.22;

export const HERO_HEIGHT_RATIO = {
  classic: { A6: 0.30, A5: 0.36, A4: 0.40, Letter: 0.40, Square: 0.28 },
  centered: { A6: 0.16, A5: 0.16, A4: 0.16, Letter: 0.16, Square: 0.16 },
  magazine: { A6: 0.22, A5: 0.24, A4: 0.26, Letter: 0.26, Square: 0.22 },
  split: { A6: 1.0, A5: 1.0, A4: 1.0, Letter: 1.0, Square: 1.0 }, // split uses width/height logic
};

export const FOOTER_H_MM = 18;
export const FOOTER_SAFE_GAP_MM = 4;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mm(v: number): string { return v.toFixed(3); }

export function rectsOverlap(a: MmRect, b: MmRect, margin = 0): boolean {
  return a.x < b.x + b.w + margin && a.x + a.w > b.x - margin &&
    a.y < b.y + b.h + margin && a.y + a.h > b.y - margin;
}

export function rectInside(rect: MmRect, container: MmRect, margin = 0): boolean {
  return rect.x >= container.x - margin && rect.y >= container.y - margin &&
    rect.x + rect.w <= container.x + container.w + margin &&
    rect.y + rect.h <= container.y + container.h + margin;
}

export function buildPageRects(flyer: Flyer): FlyerLayoutPlan['page'] {
  const dims = getFlyerDimensions(flyer);
  const total: MmRect = { x: 0, y: 0, w: dims.w + FLYER_BLEED_MM * 2, h: dims.h + FLYER_BLEED_MM * 2 };
  const trim: MmRect = { x: FLYER_BLEED_MM, y: FLYER_BLEED_MM, w: dims.w, h: dims.h };
  const safe: MmRect = {
    x: FLYER_BLEED_MM + SAFE_AREA_INSET_MM,
    y: FLYER_BLEED_MM + SAFE_AREA_INSET_MM,
    w: Math.max(20, dims.w - SAFE_AREA_INSET_MM * 2),
    h: Math.max(20, dims.h - SAFE_AREA_INSET_MM * 2),
  };
  return { total, trim, safe, bleedMm: FLYER_BLEED_MM };
}

export function normalizeContent(flyer: Flyer): {
  headline: string;
  subheadline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  qrPayload: string;
  qrLabel: string;
  heroImage: string | null;
} {
  return {
    headline: (flyer.content.headline || '').trim(),
    subheadline: (flyer.content.subheadline || '').trim(),
    body: (flyer.content.body || '').trim(),
    ctaLabel: (flyer.content.cta.label || '').trim(),
    ctaUrl: (flyer.content.cta.url || '').trim(),
    qrPayload: (flyer.content.qrPayload || '').trim(),
    qrLabel: (flyer.content.qrLabel || '').trim(),
    heroImage: flyer.content.heroImage || null,
  };
}

export function hasQrUrl(content: ReturnType<typeof normalizeContent>): boolean {
  return !!content.qrPayload && /^https?:\/\//i.test(content.qrPayload);
}

export function isCtaValid(content: ReturnType<typeof normalizeContent>): boolean {
  return !!content.ctaLabel && !!content.ctaUrl && /^https?:\/\//i.test(content.ctaUrl);
}

export function emptyFitted(fontSizePt: number): FittedTextBlock {
  return { text: '', fontSizePt, lineHeight: 1.25, lines: [], truncated: false, hidden: true };
}

export function estimateTextHeight(text: string, fontSizePt: number, lineHeight: number, maxWidthMm: number, singleColumn = true): number {
  if (!text) return 0;
  const lines = wrapTextToLines(text, maxWidthMm, fontSizePt, singleColumn);
  return lines.length * fontSizePt * lineHeight * 0.352777778; // pt -> mm
}

export const FONT_METRICS = {
  // Width factors calibrated against real Chromium SVG rendering with Arial,
  // using unitless font-size (user units = mm, matching the viewBox).
  // Factor = charWidthMm / (fontSizeMm * charCount).
  // Source: scripts/flyer-calibrate-real.mjs.
  MM_PER_PT: 0.352777778,
  // Bold uppercase single word (700): ~0.656× font-size per char.
  boldUpper: 0.69,
  // CTA uppercase bold phrase (700): ~0.635× per char.
  boldUpperCta: 0.67,
  // Body mixed-case (400): ~0.43× per char.
  regularBody: 0.46,
  // Regular mixed-case (400): ~0.46× per char.
  regularMixed: 0.50,
};

// Safety margin subtracted from box width during fitting to cover kerning,
// glyph side-bearings, and minor OS/browser metric differences.
export const BOX_SAFETY_MM = 1.0;

// Real glyph bounding-box height is ~1.06-1.13× the font-size due to ascenders/descenders.
// Used when checking vertical fit so the last line does not spill out.
export const GLYPH_HEIGHT_FACTOR = 1.15;

export const MM_PER_PT = 0.352777778;

export function charWidthMm(fontSizePt: number, kind: 'regular' | 'boldUpper' | 'boldUpperCta' | 'body' = 'regular'): number {
  const factor = {
    regular: FONT_METRICS.regularMixed,
    boldUpper: FONT_METRICS.boldUpper,
    boldUpperCta: FONT_METRICS.boldUpperCta,
    body: FONT_METRICS.regularBody,
  }[kind];
  return factor * fontSizePt * FONT_METRICS.MM_PER_PT;
}

export function measureTextWidth(text: string, fontSizePt: number, kind: 'regular' | 'boldUpper' | 'boldUpperCta' | 'body' = 'regular'): number {
  return text.length * charWidthMm(fontSizePt, kind);
}

export function wrapTextToLines(
  text: string,
  maxWidthMm: number,
  fontSizePt: number,
  singleColumn = true,
  kind: 'regular' | 'boldUpper' | 'boldUpperCta' | 'body' = 'regular',
): string[] {
  if (!text) return [];
  const mmPerChar = charWidthMm(fontSizePt, kind);
  const maxChars = Math.max(3, Math.floor(maxWidthMm / mmPerChar));
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    if (!para) continue;
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (!w) continue;
      const wordWidth = measureTextWidth(w, fontSizePt, kind);
      if (wordWidth > maxWidthMm) {
        // Word wider than box: flush current line, then split word into fragments.
        if (line) { out.push(line); line = ''; }
        let frag = '';
        for (const ch of w) {
          const next = frag + ch;
          if (measureTextWidth(next, fontSizePt, kind) > maxWidthMm && frag) {
            out.push(frag);
            frag = ch;
          } else {
            frag = next;
          }
        }
        if (frag) line = frag;
        continue;
      }
      if (line && line.length + 1 + w.length > maxChars) {
        out.push(line);
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) out.push(line);
    if (!singleColumn) {
      // For column flow we don't add paragraph breaks; lines are continuous.
    }
  }
  return out;
}

export function classDensity(plan: FlyerLayoutPlan): FlyerDensity {
  const hasOverflow = Object.values(plan.overflowFlags || {}).some(Boolean);
  if (hasOverflow) return 'overflow';
  const bodyLines = plan.text.body.lines.length;
  const visibleCount = Object.values(plan.visibility).filter(Boolean).length;
  if (bodyLines <= 3 && visibleCount <= 4) return 'low';
  if (bodyLines <= 8) return 'medium';
  return 'high';
}

export type OverflowFlags = Record<string, boolean>;
