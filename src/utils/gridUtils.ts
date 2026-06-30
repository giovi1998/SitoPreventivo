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

// stepMove: variante per-asse di clampMove. Applica il delta un passo alla
// volta fermandosi alla prima collisione. Usata dall'AI per mosse multi-cella
// (REQ-A06): invece di scartare l'intera mossa se la destinazione collide,
// avanza fino all'ultima cella valida.
export function stepMove(
  grid: CardGrid,
  selfKey: string,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  const self = elements[selfKey];
  if (!self) return { x: 0, y: 0 };
  let x = self.x;
  let y = self.y;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (let i = 0; i < Math.abs(dx); i++) {
    const nextX = x + sx;
    if (nextX < 0 || nextX + self.w > grid.cols) break;
    if (wouldRectCollideWithOthers(grid, selfKey, nextX, y, self.w, self.h)) break;
    x = nextX;
  }
  for (let i = 0; i < Math.abs(dy); i++) {
    const nextY = y + sy;
    if (nextY < 0 || nextY + self.h > grid.rows) break;
    if (wouldRectCollideWithOthers(grid, selfKey, x, nextY, self.w, self.h)) break;
    y = nextY;
  }
  return { x, y };
}

// stepResize: variante per-asse di clampResize. Stesso principio di stepMove
// ma per i delta di w/h. Una richiesta AI di "+2 in larghezza" avanza di 2
// se entrambi gli step sono liberi, di 1 se il secondo collide, di 0 se il
// primo collide.
export function stepResize(
  grid: CardGrid,
  selfKey: string,
  dw: number,
  dh: number,
): { x: number; y: number; w: number; h: number } {
  const elements = (grid.elements ?? {}) as Record<string, GridRect>;
  const self = elements[selfKey];
  if (!self) return { x: 0, y: 0, w: 1, h: 1 };
  let w = self.w;
  let h = self.h;
  const sw = Math.sign(dw);
  const sh = Math.sign(dh);
  for (let i = 0; i < Math.abs(dw); i++) {
    const nextW = w + sw;
    if (nextW < 1 || self.x + nextW > grid.cols) break;
    if (wouldRectCollideWithOthers(grid, selfKey, self.x, self.y, nextW, h)) break;
    w = nextW;
  }
  for (let i = 0; i < Math.abs(dh); i++) {
    const nextH = h + sh;
    if (nextH < 1 || self.y + nextH > grid.rows) break;
    if (wouldRectCollideWithOthers(grid, selfKey, self.x, self.y, w, nextH)) break;
    h = nextH;
  }
  return { x: self.x, y: self.y, w, h };
}

// Helper interno: collision check contro TUTTI gli altri elementi (escluso
// selfKey), usando coordinate esplicite invece di leggere self.x/y dalla
// grid. Necessario per stepMove/stepResize che aggiornano una variabile
// locale ad ogni iterazione e non vogliono mutare la grid.
function wouldRectCollideWithOthers(
  grid: CardGrid,
  selfKey: string,
  px: number,
  py: number,
  pw: number,
  ph: number,
): boolean {
  const proposal: GridRect = { x: px, y: py, w: pw, h: ph };
  for (const [k, v] of Object.entries(grid.elements ?? {})) {
    if (k === selfKey) continue;
    if (!v || typeof v.w !== 'number') continue;
    if (collides(proposal, v)) return true;
  }
  return false;
}
