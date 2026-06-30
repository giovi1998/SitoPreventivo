import { describe, it, expect } from 'vitest';
import {
  collides,
  wouldCollideOnMove,
  wouldCollideOnResize,
  canMove,
  canResize,
  clampMove,
  clampResize,
  stepMove,
  stepResize,
  type GridRect,
} from '../gridUtils';
import type { CardGrid } from '../documentSchemas';

function rect(x: number, y: number, w: number, h: number): GridRect {
  return { x, y, w, h };
}

function makeGrid(elements: Record<string, GridRect>, cols = 4, rows = 4): CardGrid {
  return { cols, rows, elements } as unknown as CardGrid;
}

describe('gridUtils - collides', () => {
  it('returns false for two non-overlapping rectangles', () => {
    expect(collides(rect(0, 0, 1, 1), rect(2, 0, 1, 1))).toBe(false);
    expect(collides(rect(0, 0, 1, 1), rect(0, 2, 1, 1))).toBe(false);
    expect(collides(rect(0, 0, 1, 1), rect(1, 1, 1, 1))).toBe(false); // diagonale
  });

  it('returns true for two overlapping rectangles', () => {
    expect(collides(rect(0, 0, 2, 2), rect(1, 1, 2, 2))).toBe(true);
    expect(collides(rect(0, 0, 2, 2), rect(0, 1, 2, 2))).toBe(true);
    expect(collides(rect(0, 0, 1, 1), rect(0, 0, 1, 1))).toBe(true); // identici
  });

  it('returns true for fully nested rectangle', () => {
    expect(collides(rect(0, 0, 3, 3), rect(1, 1, 1, 1))).toBe(true);
  });

  it('returns false for rectangles sharing only an edge (no overlap area)', () => {
    expect(collides(rect(0, 0, 1, 1), rect(1, 0, 1, 1))).toBe(false);
    expect(collides(rect(0, 0, 1, 1), rect(0, 1, 1, 1))).toBe(false);
  });
});

describe('gridUtils - wouldCollideOnMove', () => {
  const grid = makeGrid({
    photo: rect(0, 0, 1, 4),
    name: rect(1, 1, 3, 1),
    title: rect(1, 2, 3, 1),
  });

  it('returns false when moving within empty space', () => {
    // name a (1,1,3,1): up va a y=0 libero (photo è in x=0)
    expect(wouldCollideOnMove(grid, 'name', 0, -1)).toBe(false);
  });

  it('returns true when move would cause overlap with another element', () => {
    // name a x=1, spostandosi a sx va in x=0 → collide con photo (x=0, w=1)
    expect(wouldCollideOnMove(grid, 'name', -1, 0)).toBe(true);
  });

  it('ignora l\'elemento stesso nel calcolo (spostare non collide con se stesso)', () => {
    // name a (1,1,3,1), title a (1,2,3,1) → spostare name in y di -1 (up) non collide
    expect(wouldCollideOnMove(grid, 'name', 0, -1)).toBe(false);
  });

  it('ignora elementi non presenti nella grid', () => {
    expect(wouldCollideOnMove(grid, 'logo' as keyof typeof grid.elements, 1, 0)).toBe(false);
  });

  it('handle caso diagonale: dx+dy che avvicina a un altro elemento', () => {
    // name (1,1,3,1) e title (1,2,3,1) — spostare name in giù di 1 collide con title
    expect(wouldCollideOnMove(grid, 'name', 0, 1)).toBe(true);
  });
});

describe('gridUtils - wouldCollideOnResize', () => {
  const grid = makeGrid({
    photo: rect(0, 0, 1, 4),
    name: rect(1, 0, 1, 1),
    title: rect(1, 1, 1, 1),
  });

  it('returns false when growing within empty space', () => {
    expect(wouldCollideOnResize(grid, 'name', 1, 0)).toBe(false);
  });

  it('returns true when growing w would overlap with neighbor on right', () => {
    // name a (1,0,1,1), title a (1,1,1,1) → grow h di 1 → collide con title
    expect(wouldCollideOnResize(grid, 'name', 0, 1)).toBe(true);
  });

  it('returns false when shrinking (shrinking can\'t cause new collision)', () => {
    expect(wouldCollideOnResize(grid, 'name', -1, 0)).toBe(false);
    expect(wouldCollideOnResize(grid, 'name', 0, -1)).toBe(false);
  });

  it('ignora l\'elemento stesso', () => {
    expect(wouldCollideOnResize(grid, 'name', 1, 0)).toBe(false);
  });
});

describe('gridUtils - canMove / canResize (BLOCK con collision)', () => {
  const grid = makeGrid({
    photo: rect(0, 0, 1, 4),
    name: rect(1, 1, 3, 1),
  });

  it('canMove ritorna true per direzioni libere (no collision, no edge)', () => {
    // name a (1,1,3,1): up va a y=0 OK, down va a y=2 OK
    expect(canMove(grid, 'name', 'up')).toBe(true);
    expect(canMove(grid, 'name', 'down')).toBe(true);
  });

  it('canMove ritorna false su edge della grid', () => {
    // name a x=1, w=3 → x+w=4 = cols → right blocked by edge
    expect(canMove(grid, 'name', 'right')).toBe(false);
  });

  it('canMove ritorna false su collisione', () => {
    // name a x=1, photo a x=0 → left causerebbe collision
    expect(canMove(grid, 'name', 'left')).toBe(false);
  });

  it('canMove ritorna false per elementi non presenti', () => {
    expect(canMove(grid, 'logo' as keyof typeof grid.elements, 'up')).toBe(false);
  });

  it('canResize: shrink sempre permesso', () => {
    expect(canResize(grid, 'name', 'shrinkW')).toBe(true);
    expect(canResize(grid, 'name', 'shrinkH')).toBe(true);
  });

  it('canResize: grow blocked da edge', () => {
    // name a w=3, cols=4 → growW blocked
    expect(canResize(grid, 'name', 'growW')).toBe(false);
  });

  it('canResize: grow blocked da collisione', () => {
    const g = makeGrid({
      photo: rect(0, 0, 1, 4),
      name: rect(1, 0, 1, 1),
      title: rect(1, 1, 1, 1),
    });
    // name growH → collide con title
    expect(canResize(g, 'name', 'growH')).toBe(false);
  });
});

describe('gridUtils - clampMove / clampResize (BLOCK con clamp)', () => {
  const grid = makeGrid({
    photo: rect(0, 0, 1, 4),
    name: rect(1, 1, 3, 1),
  });

  it('clampMove restituisce la posizione richiesta se non c\'è collisione', () => {
    // name a (1,1,3,1), sposta up di 1 → (1,0) OK
    expect(clampMove(grid, 'name', 0, -1)).toEqual({ x: 1, y: 0 });
  });

  it('clampMove blocca a posizione valida più vicina se collisione', () => {
    // name a x=1, vuole andare a x=0 ma collide con photo (x=0) → resta a x=1
    expect(clampMove(grid, 'name', -1, 0)).toEqual({ x: 1, y: 1 });
  });

  it('clampMove blocca su edge della grid', () => {
    // name a x=1, w=3, cols=4 → x+w=4 = cols → right blocked, x resta 1
    expect(clampMove(grid, 'name', 1, 0)).toEqual({ x: 1, y: 1 });
  });

  it('clampResize riduce size al massimo non-collisionante', () => {
    const g = makeGrid({
      photo: rect(0, 0, 1, 4),
      name: rect(1, 0, 1, 1),
      title: rect(1, 1, 1, 1),
    });
    // name growH di 1 → collide con title → w rimane 1, h rimane 1
    expect(clampResize(g, 'name', 0, 1)).toEqual({ x: 1, y: 0, w: 1, h: 1 });
  });

  it('clampResize shrink sempre funziona', () => {
    expect(clampResize(grid, 'name', -1, 0)).toEqual({ x: 1, y: 1, w: 2, h: 1 });
  });
});

describe('gridUtils - stepMove / stepResize (Phase 2.2 REQ-A06, gradual per-axis)', () => {
  it('stepMove con delta=±1 coincide con clampMove', () => {
    const grid = makeGrid({
      photo: rect(0, 0, 1, 4),
      name: rect(1, 1, 3, 1),
    });
    expect(stepMove(grid, 'name', 0, -1)).toEqual({ x: 1, y: 0 });
    expect(stepMove(grid, 'name', -1, 0)).toEqual({ x: 1, y: 1 });
    expect(stepMove(grid, 'name', 1, 0)).toEqual({ x: 1, y: 1 });
  });

  it('stepMove multi-step avanza fino all\'ultima cella valida', () => {
    // 6 colonne, name a x=0, niente altri elementi → può avanzare di 3
    const grid = makeGrid({ name: rect(0, 1, 1, 1) }, 6, 4);
    expect(stepMove(grid, 'name', 3, 0)).toEqual({ x: 3, y: 1 });
  });

  it('stepMove multi-step si ferma alla collisione (avanza parzialmente)', () => {
    // 4 colonne, name a x=0, blocco a x=2 (w=1) → può avanzare di 2 non di 3
    const grid = makeGrid({
      name: rect(0, 1, 1, 1),
      block: rect(2, 1, 1, 1),
    }, 4, 4);
    expect(stepMove(grid, 'name', 3, 0)).toEqual({ x: 1, y: 1 });
  });

  it('stepMove multi-step ferma a edge della grid', () => {
    const grid = makeGrid({ name: rect(0, 0, 1, 1) }, 4, 4);
    // x+w=1, può avanzare fino a x=3 (no elementi, no edge)
    expect(stepMove(grid, 'name', 10, 0)).toEqual({ x: 3, y: 0 });
  });

  it('stepMove con delta 0 ritorna posizione corrente', () => {
    const grid = makeGrid({ name: rect(2, 2, 1, 1) }, 4, 4);
    expect(stepMove(grid, 'name', 0, 0)).toEqual({ x: 2, y: 2 });
  });

  it('stepResize multi-step advance then stop su collisione', () => {
    const grid = makeGrid({
      name: rect(1, 0, 1, 1),
      title: rect(1, 1, 1, 1),
    }, 4, 4);
    // name vuole w=3: 1→2 OK, 2→3 OK (no elementi a destra). h=2: 1→2 collide con title.
    expect(stepResize(grid, 'name', 2, 1)).toEqual({ x: 1, y: 0, w: 3, h: 1 });
  });

  it('stepResize shrink non collide mai (coerente con clampResize)', () => {
    const grid = makeGrid({ name: rect(1, 0, 3, 1) }, 4, 4);
    expect(stepResize(grid, 'name', -1, 0)).toEqual({ x: 1, y: 0, w: 2, h: 1 });
  });

  it('stepResize ferma a edge della grid', () => {
    const grid = makeGrid({ name: rect(0, 0, 1, 1) }, 4, 4);
    // può crescere in w fino a 4 (x+w=4 = cols)
    expect(stepResize(grid, 'name', 10, 0)).toEqual({ x: 0, y: 0, w: 4, h: 1 });
  });
});
