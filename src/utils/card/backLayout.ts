/**
 * Shared back-side geometry for CardPreview (CSS) and svgRenderer (export).
 * Goal: hard WYSIWYG — same proportions in preview and SVG/PNG/PDF.
 *
 * Calibrated against cardPreviewSide.css on a ~340px-tall eu-85x55 preview:
 * - padding: 10px 14px
 * - header: eyebrow 0.7rem + bottom border + 6px margins ≈ 0.10–0.12 of height
 * - cell text padding: 6px 10px
 */
import { FONT_SCALE_MIN, FONT_SCALE_MAX, QR_SIZE_PX } from '../documentSchemas';
import type { BusinessCard, CardGrid } from '../documentSchemas';

export type AlignH = 'left' | 'center' | 'right';
export type AlignV = 'top' | 'center' | 'bottom';

/** Preview reference height (px) used historically for QR_SIZE_PX mapping. */
export const PREVIEW_REF_H = 340;

export function clampFontScale(v: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 1;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v));
}

export function scaleFs(base: number, fontScale: number): number {
  return Math.max(1, Math.round(base * clampFontScale(fontScale)));
}

export interface BackPad {
  /** Horizontal card padding (user units) */
  x: number;
  /** Vertical card padding (user units) */
  y: number;
  /** Inner cell padding for text blocks */
  cellX: number;
  cellY: number;
}

/**
 * Card padding matching CSS `.card-preview-back { padding: 10px 14px }`.
 */
export function backPad(pxW: number, pxH: number): BackPad {
  return {
    x: Math.max(8, Math.round(pxW * (14 / 512))),
    y: Math.max(6, Math.round(pxH * (10 / PREVIEW_REF_H))),
    cellX: Math.max(4, Math.round(pxW * (10 / 512))),
    cellY: Math.max(3, Math.round(pxH * (6 / PREVIEW_REF_H))),
  };
}

export interface BackHeaderMetrics {
  eyebrowSize: number;
  wordmarkSize: number;
  /** Y of baseline for header texts (from top of card) */
  textY: number;
  /** Y of dashed divider */
  dividerY: number;
  /** Top of body grid (below header + margin) */
  bodyTop: number;
  headerX: number;
}

/**
 * Header metrics matching `.card-back-header` + eyebrow/wordmark rem sizes.
 * eyebrow ≈ 0.7rem ≈ 11.2px on 16px root → ~0.033 of 340px height.
 */
export function backHeaderMetrics(
  pxW: number,
  pxH: number,
  fontScale: number,
  pad: BackPad,
): BackHeaderMetrics {
  const eyebrowSize = scaleFs(pxH * 0.033, fontScale);
  const wordmarkSize = scaleFs(pxH * 0.032, fontScale);
  const textH = Math.max(eyebrowSize, wordmarkSize);
  const textY = pad.y + textH;
  const dividerY = textY + Math.round(pxH * 0.018);
  const bodyTop = dividerY + Math.round(pxH * 0.018);
  return {
    eyebrowSize,
    wordmarkSize,
    textY,
    dividerY,
    bodyTop,
    headerX: pad.x,
  };
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Convert a grid element to a pixel rect inside the body area.
 */
export function gridCellRect(
  el: { x: number; y: number; w: number; h: number },
  cellW: number,
  cellH: number,
  bodyTop: number,
  pad: BackPad,
  inset = true,
): CellRect {
  const x = el.x * cellW + (inset ? pad.cellX * 0.5 : 0);
  const y = el.y * cellH + bodyTop + (inset ? pad.cellY * 0.5 : 0);
  const w = el.w * cellW - (inset ? pad.cellX : 0);
  const h = el.h * cellH - (inset ? pad.cellY : 0);
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

/**
 * Full cell box without inner padding (for clip-path / debug).
 */
export function gridCellBox(
  el: { x: number; y: number; w: number; h: number },
  cellW: number,
  cellH: number,
  bodyTop: number,
): CellRect {
  return {
    x: el.x * cellW,
    y: el.y * cellH + bodyTop,
    w: el.w * cellW,
    h: el.h * cellH,
  };
}

/**
 * Align a content box of size (cw, ch) inside a cell rect.
 */
export function alignBoxInCell(
  cell: CellRect,
  cw: number,
  ch: number,
  alignH: AlignH = 'center',
  alignV: AlignV = 'center',
): { x: number; y: number } {
  let x = cell.x + (cell.w - cw) / 2;
  let y = cell.y + (cell.h - ch) / 2;
  if (alignH === 'left') x = cell.x;
  else if (alignH === 'right') x = cell.x + cell.w - cw;
  if (alignV === 'top') y = cell.y;
  else if (alignV === 'bottom') y = cell.y + cell.h - ch;
  return { x, y };
}

/**
 * QR size in export: min(cell, qrSize enum), scaled to current pxH
 * so medium≈120 on a 340px-tall preview.
 */
export function backQrSizePx(
  card: BusinessCard,
  cellW: number,
  cellH: number,
  pxH: number,
): number {
  const enumPx = QR_SIZE_PX[card.back.qrSize] ?? QR_SIZE_PX.medium;
  const scaled = Math.round(pxH * (enumPx / PREVIEW_REF_H));
  return Math.max(24, Math.min(cellW, cellH, scaled));
}

/**
 * Effective back grid for rendering: when services are empty, collapse the
 * services row so socials sit under contacts (hard WYSIWYG with preview
 * density — empty services leave a ghost gap otherwise).
 *
 * Does not mutate the persisted card; only the render snapshot.
 */
export function effectiveBackGridForRender(
  grid: CardGrid,
  card: BusinessCard,
): CardGrid {
  const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
  if (services.length > 0) return grid;

  const servicesEl = grid.elements.services;
  const socialsEl = grid.elements.socials;
  const contactsEl = grid.elements.contacts;
  if (!socialsEl || !contactsEl) return grid;

  // Collapse: socials takes contacts.y+h through former socials bottom.
  const socialsBottom = socialsEl.y + socialsEl.h;
  const newSocialsY = contactsEl.y + contactsEl.h;
  const newSocialsH = Math.max(1, socialsBottom - newSocialsY);

  const elements = { ...grid.elements };
  delete elements.services;
  elements.socials = {
    ...socialsEl,
    y: newSocialsY,
    h: newSocialsH,
  };

  // If services existed above socials and we had no services content,
  // also let contacts keep original h (already). Done.
  void servicesEl;
  return { ...grid, elements };
}

export interface ContactFontMetrics {
  keySize: number;
  valSize: number;
  lineGap: number;
}

export function contactFontMetrics(
  cellW: number,
  cellH: number,
  fontScale: number,
): ContactFontMetrics {
  // Match CSS: .card-back-key ~0.58rem, .card-back-val ~0.78rem on ~340px card
  // Relative to min(cell) for shrink-to-fit later.
  const keySize = scaleFs(Math.min(cellW, cellH) * 0.14, fontScale);
  const valSize = scaleFs(Math.min(cellW, cellH) * 0.18, fontScale);
  return {
    keySize,
    valSize,
    lineGap: Math.max(keySize, valSize) * 1.25,
  };
}

export function servicesFontBase(cellW: number, cellH: number, fontScale: number) {
  return {
    labelSize: scaleFs(Math.min(cellW, cellH) * 0.16, fontScale),
    svcSize: scaleFs(Math.min(cellW, cellH) * 0.2, fontScale),
  };
}

export function socialsFontBase(cellW: number, cellH: number, fontScale: number) {
  return scaleFs(Math.min(cellW, cellH) * 0.18, fontScale);
}
