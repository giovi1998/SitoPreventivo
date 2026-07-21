/**
 * Shared back-side geometry for CardPreview (CSS) and svgRenderer (export).
 * Goal: hard WYSIWYG — same proportions in preview and SVG/PNG/PDF.
 *
 * Calibrated against cardPreviewSide.css on a ~340px-tall eu-85x55 preview:
 * - padding: 10px 14px
 * - header: eyebrow 0.7rem + bottom border + 6px margins ≈ 0.10–0.12 of height
 * - cell text padding: 6px 10px
 */
import { FONT_SCALE_MIN, FONT_SCALE_MAX, QR_SIZE_PX, gridPresetBackDefault } from '../documentSchemas';
import type { BusinessCard, CardGrid } from '../documentSchemas';
import { getEffectiveQrPayload } from './qrPayload';

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
 * Effective back grid for rendering.
 *
 * v2.12: when services content is empty, do NOT move/expand socials. Moving
 * socials made the debug overlay disagree with the painted content, and 3×3
 * align acted on a different cell than the red SOCIALS box. Instead:
 * - drop the empty services element
 * - if contacts is adjacent above services in the same columns, expand
 *   contacts into that row (fills the ghost gap without stealing socials)
 * - socials stay at their persisted x/y/w/h so grid editor + 3×3 match preview
 *
 * v2.9.1: when services content exists but the persisted backGrid lacks a
 * services element (legacy card created before services grid support), inject
 * the default preset services cell so the export does not silently drop them.
 * Same for socials if they have content but no socials cell.
 *
 * Does not mutate the persisted card; only the render snapshot.
 */
export function effectiveBackGridForRender(
  grid: CardGrid,
  card: BusinessCard,
): CardGrid {
  const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
  const hasQr = !!getEffectiveQrPayload(card);

  // Count visible contact entries the same way the renderer does, so the
  // collapse decision reflects actual printed content.
  let contactCount = 0;
  if (card.back.phone) contactCount += 1;
  if (card.back.email) contactCount += 1;
  if (card.back.website && !hasQr) contactCount += 1;
  if (card.back.address) contactCount += 1;
  if (card.back.vatNumber) contactCount += 1;

  const elements = { ...grid.elements };
  const contactsEl = elements.contacts;

  // v2.9.1: inject a missing services cell from the default preset when
  // services content exists but the element is absent (legacy grids created
  // before services grid support). This prevents silent data loss in export.
  const preset = gridPresetBackDefault();
  if (services.length > 0 && !elements.services && preset.elements.services) {
    elements.services = preset.elements.services;
  }

  // v2.15: when contacts are short (≤2 entries), collapse the contacts
  // cell by one row and move services/socials up to fill the gap. This keeps
  // the left column dense and avoids the large empty space below phone/email
  // that looked broken in export.
  if (contactsEl && contactCount <= 2 && contactsEl.h >= 2) {
    const servicesEl = elements.services;
    const socialsEl = elements.socials;
    const servicesBelow = servicesEl
      && servicesEl.x === contactsEl.x
      && servicesEl.w === contactsEl.w
      && servicesEl.y === contactsEl.y + contactsEl.h;
    const socialsBelowServices = socialsEl
      && servicesBelow
      && socialsEl.x === servicesEl.x
      && socialsEl.w === servicesEl.w
      && socialsEl.y === servicesEl.y + servicesEl.h;
    const socialsDirectlyBelow = !servicesEl
      && socialsEl
      && socialsEl.x === contactsEl.x
      && socialsEl.w === contactsEl.w
      && socialsEl.y === contactsEl.y + contactsEl.h;

    if (servicesBelow || socialsDirectlyBelow) {
      elements.contacts = { ...contactsEl, h: contactsEl.h - 1 };
      if (servicesBelow) {
        elements.services = { ...servicesEl, y: servicesEl.y - 1 };
      }
      if (socialsBelowServices) {
        elements.socials = { ...socialsEl, y: socialsEl.y - 1 };
      }
      if (socialsDirectlyBelow) {
        elements.socials = { ...socialsEl, y: socialsEl.y - 1 };
      }
    }
  }

  // Drop empty services cell. Only expand contacts into the freed row when
  // there is no socials cell directly below to absorb the space (otherwise
  // the collapse logic above already made the layout dense).
  if (services.length === 0) {
    const servicesEl = elements.services;
    if (servicesEl) {
      delete elements.services;
      const currentContacts = elements.contacts;
      const socialsEl = elements.socials;
      const socialsBelow = socialsEl
        && socialsEl.x === servicesEl.x
        && socialsEl.w === servicesEl.w
        && socialsEl.y === servicesEl.y + servicesEl.h;
      if (
        !socialsBelow
        && currentContacts
        && currentContacts.x === servicesEl.x
        && currentContacts.w === servicesEl.w
        && currentContacts.y + currentContacts.h === servicesEl.y
      ) {
        elements.contacts = {
          ...currentContacts,
          h: currentContacts.h + servicesEl.h,
        };
      }
    }
  }

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
