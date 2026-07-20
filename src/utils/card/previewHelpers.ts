import type { CSSProperties } from 'react';
import type { BusinessCard, BusinessCardSizePreset, CardGrid } from '../documentSchemas';
import { FONT_SCALE_MIN, FONT_SCALE_MAX, QR_SIZE_PX } from '../documentSchemas';
import { hasGridElements, type GridElementKey, type GridSide } from './gridElements';

export const SIZE_CLASS: Record<BusinessCardSizePreset, string> = {
  'eu-85x55': 'size-eu-85x55',
  'us-89x51': 'size-us-89x51',
  'square-65x65': 'size-square-65x65',
};

export function clampFontScale(v: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 1;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v));
}

export function isGridModeFor(side: GridSide, card: BusinessCard): boolean {
  const sideState = side === 'front' ? card.front : card.back;
  return !!sideState.useGrid && hasGridElements(side, card);
}

export function gridPlacement(
  el: { x: number; y: number; w: number; h: number; alignH?: 'left' | 'center' | 'right' | null; alignV?: 'top' | 'center' | 'bottom' | null; photoPlacement?: { x: number; y: number; scale: number } } | undefined,
): CSSProperties | undefined {
  if (!el) return undefined;
  const alignH = el.alignH ?? 'center';
  const alignV = el.alignV ?? 'center';
  const justifyMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };
  const alignMap: Record<string, string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  };
  const pp = el.photoPlacement;
  const transform = pp ? `translate(${(pp.x ?? 0) * 50}%, ${(pp.y ?? 0) * 50}%) scale(${pp.scale ?? 1})` : undefined;
  return {
    gridColumn: `${el.x + 1} / span ${el.w}`,
    gridRow: `${el.y + 1} / span ${el.h}`,
    justifyContent: justifyMap[alignH] ?? 'center',
    alignItems: alignMap[alignV] ?? 'center',
    textAlign: alignH,
    ...(transform ? { ['--card-photo-transform' as any]: transform } : {}),
  };
}

export function qrSizePxFor(card: BusinessCard): number {
  return QR_SIZE_PX[card.back.qrSize] ?? QR_SIZE_PX.medium;
}

export function sideGrid(side: GridSide, card: BusinessCard): CardGrid | undefined {
  return side === 'front' ? card.grid : card.backGrid;
}
