export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type GridElementKey =
  | 'photo'
  | 'name'
  | 'title'
  | 'company'
  | 'logo'
  | 'qr'
  | 'contacts'
  | 'socials';

export type MoveDirection = 'up' | 'down' | 'left' | 'right';
export type ResizeAxis = 'growW' | 'growH' | 'shrinkW' | 'shrinkH';

import type { CardGrid } from './documentSchemas';

export function collides(a: GridRect, b: GridRect): boolean {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  if (ax2 <= b.x || bx2 <= a.x) return false;
  if (ay2 <= b.y || by2 <= a.y) return false;
  return true;
}

function getOtherElements(
  grid: CardGrid,
  selfKey: string,
): Array<{ key: string; rect: GridRect }> {
  const out: Array<{ key: string; rect: GridRect }> = [];
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  for (const [k, v] of Object.entries(elements)) {
    if (k === selfKey) continue;
    if (!v || typeof v.w !== 'number') continue;
    out.push({ key: k, rect: v });
  }
  return out;
}

export function wouldCollideOnMove(
  grid: CardGrid,
  selfKey: string,
  dx: number,
  dy: number,
): boolean {
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  const self = elements[selfKey];
  if (!self) return false;
  const next: GridRect = { x: self.x + dx, y: self.y + dy, w: self.w, h: self.h };
  if (next.x < 0 || next.y < 0) return true;
  if (next.x + next.w > grid.cols) return true;
  if (next.y + next.h > grid.rows) return true;
  for (const { rect } of getOtherElements(grid, selfKey)) {
    if (collides(next, rect)) return true;
  }
  return false;
}

export function wouldCollideOnResize(
  grid: CardGrid,
  selfKey: string,
  dw: number,
  dh: number,
): boolean {
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  const self = elements[selfKey];
  if (!self) return false;
  if (dw < 0 || dh < 0) return false; // shrinking can't introduce new collision
  const next: GridRect = {
    x: self.x,
    y: self.y,
    w: self.w + dw,
    h: self.h + dh,
  };
  if (next.x + next.w > grid.cols) return true;
  if (next.y + next.h > grid.rows) return true;
  for (const { rect } of getOtherElements(grid, selfKey)) {
    if (collides(next, rect)) return true;
  }
  return false;
}

export function canMove(
  grid: CardGrid,
  selfKey: string,
  dir: MoveDirection,
): boolean {
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  if (!elements[selfKey]) return false;
  const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  return !wouldCollideOnMove(grid, selfKey, dx, dy);
}

export function canResize(
  grid: CardGrid,
  selfKey: string,
  axis: ResizeAxis,
): boolean {
  const dw = axis === 'growW' ? 1 : axis === 'shrinkW' ? -1 : 0;
  const dh = axis === 'growH' ? 1 : axis === 'shrinkH' ? -1 : 0;
  return !wouldCollideOnResize(grid, selfKey, dw, dh);
}

export function clampMove(
  grid: CardGrid,
  selfKey: string,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  const self = elements[selfKey];
  if (!self) return { x: 0, y: 0 };
  if (!wouldCollideOnMove(grid, selfKey, dx, dy)) {
    return { x: self.x + dx, y: self.y + dy };
  }
  return { x: self.x, y: self.y };
}

export function clampResize(
  grid: CardGrid,
  selfKey: string,
  dw: number,
  dh: number,
): { x: number; y: number; w: number; h: number } {
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  const self = elements[selfKey];
  if (!self) return { x: 0, y: 0, w: 1, h: 1 };
  if (!wouldCollideOnResize(grid, selfKey, dw, dh)) {
    return { x: self.x, y: self.y, w: self.w + dw, h: self.h + dh };
  }
  return { x: self.x, y: self.y, w: self.w, h: self.h };
}
